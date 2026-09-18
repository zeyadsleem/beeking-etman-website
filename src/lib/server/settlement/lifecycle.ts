import { and, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { affectedRowCount } from "$lib/server/orders";
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

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: "invalid_transition" | "not_found" };

/**
 * Conditional fulfillment transition. The caller passes the statuses it
 * believes the order may hold; the conditional UPDATE makes concurrent writes
 * and replayed requests safe. Legacy stored values are matched for `confirmed`.
 */
export async function applyOrderTransition(
  db: LibSQLDatabase<typeof schema>,
  params: { orderId: string; from: readonly OrderStatus[]; to: OrderStatus },
): Promise<TransitionResult> {
  if (!params.from.some((from) => canTransitionOrder(from, params.to))) {
    return { ok: false, reason: "invalid_transition" };
  }
  const stored = [...new Set(params.from.flatMap(storedOrderStatusValues))];
  const result = await db
    .update(schema.order)
    .set({ status: params.to })
    .where(and(eq(schema.order.id, params.orderId), inArray(schema.order.status, stored)));
  if (affectedRowCount(result) !== 1) {
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
  if (!input.from.some((from) => canTransitionPayment(from, input.to))) {
    return { ok: false, reason: "invalid_transition" };
  }
  const now = input.now ?? Date.now();
  const set: Partial<typeof schema.order.$inferInsert> = { paymentStatus: input.to };
  if (input.reference !== undefined) set.paymentReference = input.reference;
  if (input.reviewedBy !== undefined) set.paymentReviewedBy = input.reviewedBy;
  if (input.to === "pending_review") set.paymentClaimedAt = now;
  if (input.to === "paid") {
    set.paidAt = now;
    set.paymentReviewedAt = now;
  }
  if (input.to === "failed" || input.to === "refunded") set.paymentReviewedAt = now;

  const result = await db
    .update(schema.order)
    .set(set)
    .where(
      and(eq(schema.order.id, input.orderId), inArray(schema.order.paymentStatus, [...input.from])),
    );
  if (affectedRowCount(result) !== 1) {
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
 * Appends a settlement event. The table rejects updates and deletes with
 * `PAYMENT_EVENT_APPEND_ONLY`, so this is the only write path.
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
