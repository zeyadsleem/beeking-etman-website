import { and, eq, inArray, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { applyPaymentTransition, paymentEventStatement } from "$lib/server/settlement/lifecycle";
import { affectedRowCount, retryOnBusy } from "$lib/server/sqlite";

export type SettlementActionResult =
  | { ok: true }
  | { ok: false; reason: "invalid_input" | "invalid_transition" };

export interface AdminSettlementInput {
  orderId: string;
  reference?: string | null;
  note?: string | null;
  actorUserId?: string | null;
  now?: number;
}

/** Trim and length-cap admin free text; `null` when nothing usable remains. */
export function cleanSettlementText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

/**
 * Confirms that money arrived. The only path to `paid`; the reference or the
 * note makes the decision auditable.
 */
export async function verifyPayment(
  db: LibSQLDatabase<typeof schema>,
  input: AdminSettlementInput,
): Promise<SettlementActionResult> {
  const reference = cleanSettlementText(input.reference);
  const note = cleanSettlementText(input.note);
  if (!reference && !note) return { ok: false, reason: "invalid_input" };

  const result = await retryOnBusy(() =>
    applyPaymentTransition(db, {
      orderId: input.orderId,
      from: ["unpaid", "pending_review"],
      to: "paid",
      // A note-only verification must not wipe the customer's claim reference.
      reference: reference ?? undefined,
      reviewedBy: input.actorUserId ?? null,
      now: input.now,
      event: {
        type: "verified",
        actor: "admin",
        actorUserId: input.actorUserId ?? null,
        reference,
        note,
      },
    }),
  );
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

/** Rejects an open claim; the customer may re-claim with corrected details. */
export async function rejectClaim(
  db: LibSQLDatabase<typeof schema>,
  input: AdminSettlementInput,
): Promise<SettlementActionResult> {
  const note = cleanSettlementText(input.note);
  if (!note) return { ok: false, reason: "invalid_input" };

  const result = await retryOnBusy(() =>
    applyPaymentTransition(db, {
      orderId: input.orderId,
      from: ["pending_review"],
      to: "failed",
      reviewedBy: input.actorUserId ?? null,
      now: input.now,
      event: {
        type: "rejected",
        actor: "admin",
        actorUserId: input.actorUserId ?? null,
        note,
      },
    }),
  );
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

/** Records a full refund; the money moves outside the system. */
export async function refundPayment(
  db: LibSQLDatabase<typeof schema>,
  input: AdminSettlementInput,
): Promise<SettlementActionResult> {
  const reference = cleanSettlementText(input.reference);
  const note = cleanSettlementText(input.note);
  if (!reference || !note) return { ok: false, reason: "invalid_input" };

  const result = await retryOnBusy(() =>
    applyPaymentTransition(db, {
      orderId: input.orderId,
      from: ["paid"],
      to: "refunded",
      reference,
      reviewedBy: input.actorUserId ?? null,
      now: input.now,
      event: {
        type: "refund",
        actor: "admin",
        actorUserId: input.actorUserId ?? null,
        reference,
        note,
      },
    }),
  );
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

export const HOLD_EXTENSION_HOURS = 24;

const HOLD_EXTENSION_MS = HOLD_EXTENSION_HOURS * 3_600_000;

export interface ExtendHoldInput {
  orderId: string;
  actorUserId?: string | null;
  now?: number;
}

/** Extends the hold window by 24 h while the order is still pre-shipment. */
export async function extendHold(
  db: LibSQLDatabase<typeof schema>,
  input: ExtendHoldInput,
): Promise<SettlementActionResult> {
  const now = input.now ?? Date.now();
  const [flip] = await retryOnBusy(() =>
    db.batch([
      db
        .update(schema.order)
        .set({
          // An already-expired deadline restarts from now; a future one is
          // pushed 24 h further out.
          holdExpiresAt: sql`max(coalesce(${schema.order.holdExpiresAt}, ${now}), ${now}) + ${HOLD_EXTENSION_MS}`,
        })
        .where(
          and(
            eq(schema.order.id, input.orderId),
            inArray(schema.order.status, ["pending_confirmation", "confirmed", "processing"]),
          ),
        ),
      paymentEventStatement(db, {
        orderId: input.orderId,
        type: "note",
        actor: "admin",
        actorUserId: input.actorUserId ?? null,
        note: `hold extended ${HOLD_EXTENSION_HOURS}h`,
        now,
      }),
    ]),
  );
  if (affectedRowCount(flip) !== 1) return { ok: false, reason: "invalid_transition" };
  return { ok: true };
}
