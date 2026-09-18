import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { parsePaymentMethod, parsePaymentStatus } from "$lib/settlement/types";
import { applyPaymentTransition, recordPaymentEvent } from "./lifecycle";

export type ClaimResult =
  | { ok: true }
  | {
      ok: false;
      reason: "order_not_found" | "not_transfer_method" | "already_claimed" | "not_claimable";
    };

export interface ClaimInput {
  orderId: string;
  /** Transfer reference the customer's bank app shows; optional. */
  reference?: string | null;
  now?: number;
}

/**
 * Records the customer's claim that a transfer was sent. A claim can only
 * move `unpaid`/`failed` to `pending_review`; it never reaches `paid`.
 * Callers own authentication and the per-order/per-IP rate limits.
 */
export async function submitClaim(
  db: LibSQLDatabase<typeof schema>,
  input: ClaimInput,
): Promise<ClaimResult> {
  const order = await db
    .select({
      id: schema.order.id,
      status: schema.order.status,
      paymentStatus: schema.order.paymentStatus,
      paymentMethod: schema.order.paymentMethod,
    })
    .from(schema.order)
    .where(eq(schema.order.id, input.orderId))
    .get();
  if (!order) return { ok: false, reason: "order_not_found" };

  const method = parsePaymentMethod(order.paymentMethod);
  if (method !== "instapay" && method !== "wallet") {
    return { ok: false, reason: "not_transfer_method" };
  }
  if (order.status === "cancelled") return { ok: false, reason: "not_claimable" };

  const paymentStatus = parsePaymentStatus(order.paymentStatus);
  if (paymentStatus === "pending_review") return { ok: false, reason: "already_claimed" };
  if (paymentStatus !== "unpaid" && paymentStatus !== "failed") {
    return { ok: false, reason: "not_claimable" };
  }

  const transition = await applyPaymentTransition(db, {
    orderId: order.id,
    from: [paymentStatus],
    to: "pending_review",
    reference: input.reference ?? null,
    now: input.now,
  });
  if (!transition.ok) return { ok: false, reason: "not_claimable" };

  await recordPaymentEvent(db, {
    orderId: order.id,
    type: "claim",
    actor: "customer",
    method,
    reference: input.reference ?? null,
    now: input.now,
  });
  return { ok: true };
}
