import type { MessageKey } from "$lib/i18n/messages";

export const ORDER_STATUSES = ["placed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_SET: ReadonlySet<string> = new Set(ORDER_STATUSES);

export function parseOrderStatus(value: string): OrderStatus | null {
  if (value === "paid") return "placed";
  return STATUS_SET.has(value) ? (value as OrderStatus) : null;
}

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  placed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function allowedTransitions(status: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[status];
}

export const STATUS_ORDER = ["placed", "shipped", "delivered", "cancelled"] as const;

export const ADMIN_ORDER_STATUS_LABEL_KEY: Record<OrderStatus, MessageKey> = {
  placed: "admin.orders.placed",
  shipped: "admin.orders.shipped",
  delivered: "admin.orders.delivered",
  cancelled: "admin.orders.cancelled",
};

export const CUSTOMER_ORDER_STATUS_LABEL_KEY: Record<OrderStatus, MessageKey> = {
  placed: "orders.placed",
  shipped: "orders.shipped",
  delivered: "orders.delivered",
  cancelled: "orders.cancelled",
};

export const ADMIN_ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  placed: "bg-honey-50 text-honey-800",
  shipped: "border border-cocoa-200 bg-parchment text-cocoa-700",
  delivered: "bg-olive-100 text-olive-800",
  cancelled: "bg-clay-100 text-clay-800",
};

export const ADMIN_ORDER_STATUS_BAR_CLASS: Record<OrderStatus, string> = {
  placed: "bg-honey-500",
  shipped: "bg-cocoa-400",
  delivered: "bg-olive-500",
  cancelled: "bg-clay-500",
};
