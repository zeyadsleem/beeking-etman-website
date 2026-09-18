import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { parsePaymentMethod, parsePaymentStatus } from "$lib/settlement/types";
import { applyPaymentTransition } from "./lifecycle";

export type ClaimResult =
  | { ok: true }
  | {
      ok: false;
      reason: "order_not_found" | "not_transfer_method" | "already_claimed" | "not_claimable";
    };

const REFERENCE_MAX_CHARS = 120;
// Control and bidi-formatting characters would let a customer forge the
// direction or layout of the reference an admin reads later.
const STRIPPED_CHARS = /[\u0000-\u001F\u007F\u061C\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

/** Bounds and cleans a customer-supplied transfer reference. */
export function sanitizeReference(value: string | null | undefined): string | null {
  if (!value) return null;
  const stripped = value.slice(0, 500).replace(STRIPPED_CHARS, "").trim();
  if (stripped === "") return null;
  return Array.from(stripped).slice(0, REFERENCE_MAX_CHARS).join("");
}

export interface ClaimInput {
  orderId: string;
  /** Raw customer input; sanitized here. */
  reference?: string | null;
  actorUserId?: string | null;
  now?: number;
}

/**
 * Records the customer's claim that a transfer was sent. A claim can only
 * move `unpaid`/`failed` to `pending_review`, and the status change and its
 * event commit in one transaction; a claim never reaches `paid`. Callers own
 * authentication and the per-order/per-IP rate limits.
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

  const reference = sanitizeReference(input.reference);
  const transition = await applyPaymentTransition(db, {
    orderId: order.id,
    from: [paymentStatus],
    to: "pending_review",
    reference,
    now: input.now,
    event: {
      type: "claim",
      actor: "customer",
      actorUserId: input.actorUserId ?? null,
      method,
      reference,
    },
  });
  if (!transition.ok) {
    // A concurrent claim may have won between the read and the conditional
    // update; report that as the friendly already-claimed state.
    const current = await db
      .select({ paymentStatus: schema.order.paymentStatus })
      .from(schema.order)
      .where(eq(schema.order.id, order.id))
      .get();
    if (current && parsePaymentStatus(current.paymentStatus) === "pending_review") {
      return { ok: false, reason: "already_claimed" };
    }
    return { ok: false, reason: "not_claimable" };
  }
  return { ok: true };
}
