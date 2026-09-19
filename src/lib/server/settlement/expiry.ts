import { and, eq, inArray, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { affectedRowCount, retryOnBusy } from "$lib/server/sqlite";
import { TRANSFER_PAYMENT_METHODS } from "$lib/settlement/types";
import { paymentEventStatement } from "./lifecycle";

/**
 * The job acts only after the deadline plus this grace period, so a slow
 * 5-minute run never cancels a hold that checkout is still settling.
 */
export const HOLD_EXPIRY_GRACE_MS = 5 * 60_000;

const AWAITING_CONFIRMATION_STATUSES = ["pending_confirmation"] as const;
const ACCEPTED_STATUSES = ["confirmed", "processing"] as const;
const OPEN_PAYMENT_STATUSES = ["unpaid", "pending_review"] as const;

/** Pre-cancel status of a released hold; it selects the rule-specific copy. */
export type ReleasedHoldStatus = "pending_confirmation" | "confirmed" | "processing";

/** A hold this run cancelled; `previousStatus` distinguishes rule 1 from rule 2. */
export interface ReleasedHold {
  id: string;
  previousStatus: ReleasedHoldStatus;
}

/**
 * Rule 1: the shop never accepted the order (any method).
 * Rule 2: the shop accepted a transfer order but the money never arrived.
 */
function expiredHoldSelection(cutoff: number): SQL | undefined {
  return and(
    or(
      eq(schema.order.status, "pending_confirmation"),
      and(
        inArray(schema.order.paymentMethod, TRANSFER_PAYMENT_METHODS),
        inArray(schema.order.status, ACCEPTED_STATUSES),
        inArray(schema.order.paymentStatus, OPEN_PAYMENT_STATUSES),
      ),
    ),
    eq(schema.order.stockVersion, "atomic"),
    isNotNull(schema.order.holdExpiresAt),
    lte(schema.order.holdExpiresAt, cutoff),
  );
}

/**
 * The single canonical status a selected row can hold. A stored value outside
 * the three means corrupt data, so fail loudly instead of cancelling an order
 * with no restock.
 */
function releasedHoldStatus(storedStatus: string): ReleasedHoldStatus {
  if (storedStatus === "pending_confirmation") return "pending_confirmation";
  if (storedStatus === "confirmed" || storedStatus === "processing") return storedStatus;
  throw new Error(`[settlement/expiry] unexpected hold status: "${storedStatus}"`);
}

/** The UPDATE status set for the rule that selected the row. */
function expiryRuleStatuses(storedStatus: string): readonly ReleasedHoldStatus[] {
  return releasedHoldStatus(storedStatus) === "pending_confirmation"
    ? AWAITING_CONFIRMATION_STATUSES
    : ACCEPTED_STATUSES;
}

/**
 * Conditional cancellation gated on the rule's statuses and the deadline; the
 * UPDATE match (`changes() = 1`) gates its expiry event, and the 0019 restock
 * trigger releases the reservation. Both a replayed run and a concurrent one
 * therefore cancel nothing and append nothing after the first match.
 */
async function cancelExpiredHold(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  storedStatus: string,
  cutoff: number,
  now: number,
): Promise<boolean> {
  const statuses = expiryRuleStatuses(storedStatus);
  const [flip] = await retryOnBusy(() =>
    db.batch([
      db
        .update(schema.order)
        .set({
          status: "cancelled",
          // An open claim failed with the hold; an untouched `unpaid` row stays
          // honest, so the funnel never counts a payment that never arrived.
          paymentStatus: sql`CASE WHEN ${schema.order.paymentStatus} = 'pending_review' THEN 'failed' ELSE ${schema.order.paymentStatus} END`,
          // Mirror `applyPaymentTransition`'s `failed` stamp: only a rejected
          // claim records a review decision; a plain `unpaid` row keeps null.
          paymentReviewedAt: sql`CASE WHEN ${schema.order.paymentStatus} = 'pending_review' THEN ${now} ELSE ${schema.order.paymentReviewedAt} END`,
        })
        .where(
          and(
            eq(schema.order.id, orderId),
            inArray(schema.order.status, statuses),
            isNotNull(schema.order.holdExpiresAt),
            lte(schema.order.holdExpiresAt, cutoff),
          ),
        ),
      paymentEventStatement(db, { orderId, type: "expiry", actor: "system", now }),
    ]),
  );
  return affectedRowCount(flip) === 1;
}

/**
 * Releases every stock hold that expired beyond the grace window, returning
 * the holds cancelled in this run. The optional `onReleased` notifier runs
 * once after the loop and is best-effort: a notification failure is logged
 * and never undoes or aborts a released hold. The caller supplies the clock
 * so tests and the worker share one deterministic deadline.
 */
export async function releaseExpiredHolds(
  db: LibSQLDatabase<typeof schema>,
  now: number = Date.now(),
  onReleased?: (released: readonly ReleasedHold[]) => Promise<void>,
): Promise<ReleasedHold[]> {
  const cutoff = now - HOLD_EXPIRY_GRACE_MS;
  const expired = await db
    .select({ id: schema.order.id, status: schema.order.status })
    .from(schema.order)
    .where(expiredHoldSelection(cutoff))
    .orderBy(schema.order.holdExpiresAt, schema.order.id);

  const released: ReleasedHold[] = [];
  for (const order of expired) {
    if (await cancelExpiredHold(db, order.id, order.status, cutoff, now)) {
      released.push({ id: order.id, previousStatus: releasedHoldStatus(order.status) });
    }
  }

  if (onReleased) {
    try {
      await onReleased(released);
    } catch (e) {
      console.error("[settlement/expiry] release notification failed", e);
    }
  }
  return released;
}
