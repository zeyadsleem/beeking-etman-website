import { error } from "@sveltejs/kit";
import { getOrderWithItems } from "$lib/server/admin/orders";
import { generateInvoiceHtml } from "$lib/server/invoice";
import { db } from "$lib/server/db";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  if (event.locals.user?.role !== "admin") error(403, "Forbidden");

  const detail = await getOrderWithItems(db, event.params.id);
  if (!detail) error(404, "Order not found");

  const html = generateInvoiceHtml(detail.order, detail.items);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
