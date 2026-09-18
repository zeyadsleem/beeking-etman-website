import { and, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { affectedRowCount } from "$lib/server/sqlite";
import {
  allowedTransitions,
  type OrderStatus,
  type PaymentEventActor,
  type PaymentEventType,
  type PaymentMethod,
  type PaymentStatus,
} from "$lib/settlement/types";

export { parseOrderStatus, parsePaymentStatus } from "$lib/settlement/types";

// --- Transition guards ---

const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  unpaid: ["pending_review", "paid", "failed"],
  pending_review: ["paid", "failed"],
  failed: ["pending_review", "paid"],
  paid: ["refunded"],
  refunded: [],
  // Pre-pivot rows are settled history; v1 services never move them.
  simulated: [],
};

export function allowedPaymentTransitions(status: PaymentStatus): readonly PaymentStatus[] {
  return PAYMENT_TRANSITIONS[status];
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

// --- Fulfillment transitions ---

/** Stored values that read as the given canonical status (legacy aliases included). */
export function storedOrderStatusValues(status: OrderStatus): string[] {
  return status === "confirmed" ? ["confirmed", "placed", "paid"] : [status];
}

/** A missing row and a moved-on row both report `invalid_transition`. */
export type TransitionResult = { ok: true } | { ok: false; reason: "invalid_transition" };

/**
 * Conditional fulfillment transition. The caller passes the statuses it
 * believes the order may hold; the conditional UPDATE makes concurrent writes
 * and replayed requests safe. Legacy stored values are matched for `confirmed`.
 */
export async function applyOrderTransition(
  db: LibSQLDatabase<typeof schema>,
  params: { orderId: string; from: readonly OrderStatus[]; to: OrderStatus },
): Promise<TransitionResult> {
  // Only statuses that may legally reach `to` take part in the match; a mixed
  // `from` array can never move an illegal stored state.
  const validFrom = params.from.filter((from) => canTransitionOrder(from, params.to));
  if (validFrom.length === 0) {
    return { ok: false, reason: "invalid_transition" };
  }
  const stored = [...new Set(validFrom.flatMap(storedOrderStatusValues))];
  const [flip] = await db.batch([
    db
      .update(schema.order)
      .set({ status: params.to })
      .where(and(eq(schema.order.id, params.orderId), inArray(schema.order.status, stored))),
  ]);
  if (affectedRowCount(flip) !== 1) {
    return { ok: false, reason: "invalid_transition" };
  }
  return { ok: true };
}

// --- Payment transitions ---

export interface PaymentTransitionInput {
  orderId: string;
  from: readonly PaymentStatus[];
  to: PaymentStatus;
  /** Transfer reference or admin note recorded with the decision. */
  reference?: string | null;
  reviewedBy?: string | null;
  /** Injectable clock for tests. */
  now?: number;
}

/**
 * Conditional payment transition with the settlement stamps. `paid` is only
 * reachable through this function's callers (admin verification); customer
 * claims may only reach `pending_review`.
 */
export async function applyPaymentTransition(
  db: LibSQLDatabase<typeof schema>,
  input: PaymentTransitionInput,
): Promise<TransitionResult> {
  const validFrom = input.from.filter((from) => canTransitionPayment(from, input.to));
  if (validFrom.length === 0) {
    return { ok: false, reason: "invalid_transition" };
  }
  const now = input.now ?? Date.now();
  const set: Partial<typeof schema.order.$inferInsert> = { paymentStatus: input.to };
  if (input.reference !== undefined) set.paymentReference = input.reference;
  if (input.reviewedBy !== undefined) set.paymentReviewedBy = input.reviewedBy;
  // Timestamps record the latest action of their kind; re-claiming a failed
  // order updates the claim time.
  if (input.to === "pending_review") set.paymentClaimedAt = now;
  if (input.to === "paid") {
    set.paidAt = now;
    set.paymentReviewedAt = now;
  }
  // `payment_reviewed_at` records the latest settlement decision.
  if (input.to === "failed" || input.to === "refunded") set.paymentReviewedAt = now;

  const [flip] = await db.batch([
    db
      .update(schema.order)
      .set(set)
      .where(
        and(eq(schema.order.id, input.orderId), inArray(schema.order.paymentStatus, validFrom)),
      ),
  ]);
  if (affectedRowCount(flip) !== 1) {
    return { ok: false, reason: "invalid_transition" };
  }
  return { ok: true };
}

// --- Settlement event log ---

export interface PaymentEventInput {
  orderId: string;
  type: PaymentEventType;
  actor: PaymentEventActor;
  actorUserId?: string | null;
  method?: PaymentMethod | null;
  reference?: string | null;
  note?: string | null;
  now?: number;
}

/**
 * Appends a settlement event. The 0019 triggers reject updates and deletes
 * with `PAYMENT_EVENT_APPEND_ONLY` (covered by the migration replay test), so
 * this is the only write path.
 */
export async function recordPaymentEvent(
  db: LibSQLDatabase<typeof schema>,
  event: PaymentEventInput,
): Promise<void> {
  await db.insert(schema.paymentEvent).values({
    orderId: event.orderId,
    type: event.type,
    actor: event.actor,
    actorUserId: event.actorUserId ?? null,
    method: event.method ?? null,
    reference: event.reference ?? null,
    note: event.note ?? null,
    createdAt: event.now ?? Date.now(),
  });
}
