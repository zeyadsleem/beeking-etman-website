import { error } from "@sveltejs/kit";
import { getOrderWithItems } from "$lib/server/admin/orders";
import { generateInvoiceHtml } from "$lib/server/invoice";
import { db } from "$lib/server/db";
import { isAdminRole } from "$lib/server/admin/roles";
import { logAdminAction } from "$lib/server/admin/audit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  if (!isAdminRole(event.locals.user?.role)) error(403, "Forbidden");

  const detail = await getOrderWithItems(db, event.params.id);
  if (!detail) error(404, "Order not found");

  // Read-side audit (T7): invoice views carry customer PII.
  logAdminAction(db, {
    action: "order.invoice_view",
    targetType: "order",
    targetId: event.params.id,
    userId: event.locals.user?.id,
  });

  const html = generateInvoiceHtml(detail.order, detail.items);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
