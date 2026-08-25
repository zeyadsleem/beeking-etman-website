import type { MessageKey } from "$lib/i18n/messages";
import type { OrderStatus } from "$lib/server/admin/orders";

// Single source of truth for admin order-status presentation, shared by the
// orders list and the order detail page.
export const ADMIN_ORDER_STATUS_LABEL_KEY: Record<OrderStatus, MessageKey> = {
  paid: "admin.orders.paid",
  shipped: "admin.orders.shipped",
  delivered: "admin.orders.delivered",
  cancelled: "admin.orders.cancelled",
};

// Badge tones reuse the project palette tokens only (the theme has no blue):
// paid=honey, shipped=neutral cocoa, delivered=olive green, cancelled=muted
// clay red. The label text carries the meaning; color is a secondary cue.
export const ADMIN_ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  paid: "bg-honey-50 text-honey-800",
  shipped: "border border-cocoa-200 bg-parchment text-cocoa-700",
  delivered: "bg-olive-100 text-olive-800",
  cancelled: "bg-clay-100 text-clay-800",
};
