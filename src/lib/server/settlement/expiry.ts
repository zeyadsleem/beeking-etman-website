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
 * The UPDATE status set for the rule that selected the row. The selection can
 * only return these three statuses; a stored value outside them means corrupt
 * data, so fail loudly instead of cancelling an order with no restock.
 */
function expiryRuleStatuses(storedStatus: string): readonly string[] {
  if (storedStatus === "pending_confirmation") return AWAITING_CONFIRMATION_STATUSES;
  if (storedStatus === "confirmed" || storedStatus === "processing") return ACCEPTED_STATUSES;
  throw new Error(`[settlement/expiry] unexpected hold status: "${storedStatus}"`);
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
 * the ids cancelled in this run. The caller supplies the clock so tests and
 * the worker share one deterministic deadline.
 */
export async function releaseExpiredHolds(
  db: LibSQLDatabase<typeof schema>,
  now: number = Date.now(),
): Promise<string[]> {
  const cutoff = now - HOLD_EXPIRY_GRACE_MS;
  const expired = await db
    .select({ id: schema.order.id, status: schema.order.status })
    .from(schema.order)
    .where(expiredHoldSelection(cutoff))
    .orderBy(schema.order.holdExpiresAt, schema.order.id);

  const released: string[] = [];
  for (const order of expired) {
    if (await cancelExpiredHold(db, order.id, order.status, cutoff, now)) {
      released.push(order.id);
    }
  }
  return released;
}
