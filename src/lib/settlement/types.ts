import type { MessageKey } from "$lib/i18n/messages";

// --- Fulfillment lifecycle (spec docs/superpowers/specs/2026-09-17-manual-settlement-design.md §3.1) ---

export const ORDER_STATUSES = [
  "pending_confirmation",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_SET: ReadonlySet<string> = new Set(ORDER_STATUSES);

/**
 * Legacy rows wrote `placed` (pre-0016 fulfillment state) and `paid` (the
 * 0016-era default). Both read as `confirmed`; new code never writes them.
 */
export function parseOrderStatus(value: string): OrderStatus | null {
  if (value === "placed" || value === "paid") return "confirmed";
  return STATUS_SET.has(value) ? (value as OrderStatus) : null;
}

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function allowedTransitions(status: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[status];
}

/** Admin list ordering; kept as a named alias of the canonical list. */
export const STATUS_ORDER = ORDER_STATUSES;

export const ADMIN_ORDER_STATUS_LABEL_KEY: Record<OrderStatus, MessageKey> = {
  pending_confirmation: "admin.orders.pending_confirmation",
  confirmed: "admin.orders.confirmed",
  processing: "admin.orders.processing",
  shipped: "admin.orders.shipped",
  delivered: "admin.orders.delivered",
  cancelled: "admin.orders.cancelled",
};

export const CUSTOMER_ORDER_STATUS_LABEL_KEY: Record<OrderStatus, MessageKey> = {
  pending_confirmation: "orders.pending_confirmation",
  confirmed: "orders.confirmed",
  processing: "orders.processing",
  shipped: "orders.shipped",
  delivered: "orders.delivered",
  cancelled: "orders.cancelled",
};

/** Label key for a stored value, falling back to the unknown label. */
export function customerOrderStatusLabelKey(value: string): MessageKey {
  const status = parseOrderStatus(value);
  return status ? CUSTOMER_ORDER_STATUS_LABEL_KEY[status] : "orders.unknown";
}

export const ADMIN_ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending_confirmation: "border border-cocoa-200 bg-parchment text-cocoa-700",
  confirmed: "bg-honey-50 text-honey-800",
  processing: "bg-honey-100 text-honey-900",
  shipped: "bg-cocoa-100 text-cocoa-800",
  delivered: "bg-olive-100 text-olive-800",
  cancelled: "bg-clay-100 text-clay-800",
};

export const ADMIN_ORDER_STATUS_BAR_CLASS: Record<OrderStatus, string> = {
  pending_confirmation: "bg-cocoa-300",
  confirmed: "bg-honey-500",
  processing: "bg-honey-600",
  shipped: "bg-cocoa-400",
  delivered: "bg-olive-500",
  cancelled: "bg-clay-500",
};

// --- Payment lifecycle (spec §3.2) ---

export const PAYMENT_STATUSES = [
  "unpaid",
  "pending_review",
  "paid",
  "failed",
  "refunded",
  "simulated",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_STATUS_SET: ReadonlySet<string> = new Set(PAYMENT_STATUSES);

/** `simulated` is legacy-only: rows created before the settlement pivot. */
export function parsePaymentStatus(value: string): PaymentStatus | null {
  return PAYMENT_STATUS_SET.has(value) ? (value as PaymentStatus) : null;
}

export const PAYMENT_METHODS = ["cod", "instapay", "wallet", "simulated", "paymob"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Methods the v1 checkout can offer; `paymob` is reserved for phase 2. */
export const V1_PAYMENT_METHODS = ["cod", "instapay", "wallet"] as const;
export type V1PaymentMethod = (typeof V1_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL_KEY: Record<V1PaymentMethod, MessageKey> = {
  cod: "checkout.method.cod",
  instapay: "checkout.method.instapay",
  wallet: "checkout.method.wallet",
};

export const PAYMENT_METHOD_HINT_KEY: Record<V1PaymentMethod, MessageKey> = {
  cod: "checkout.method.codHint",
  instapay: "checkout.method.instapayHint",
  wallet: "checkout.method.walletHint",
};

const PAYMENT_METHOD_SET: ReadonlySet<string> = new Set(PAYMENT_METHODS);

/** `simulated` is legacy-only; `paymob` is reserved for phase 2. */
export function parsePaymentMethod(value: string): PaymentMethod | null {
  return PAYMENT_METHOD_SET.has(value) ? (value as PaymentMethod) : null;
}

// --- Settlement event vocabulary (must match the 0019 trigger guard) ---

export const PAYMENT_EVENT_TYPES = [
  "claim",
  "verified",
  "rejected",
  "refund",
  "expiry",
  "note",
] as const;
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

export const PAYMENT_EVENT_ACTORS = ["customer", "admin", "system"] as const;
export type PaymentEventActor = (typeof PAYMENT_EVENT_ACTORS)[number];
