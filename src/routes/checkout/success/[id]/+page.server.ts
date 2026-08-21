import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { getOrderAccessSecret, readOrderAccessCookie } from "$lib/server/order-access";
import { getLang } from "$lib/server/lang";
import * as schema from "$lib/server/db/schema";
import { t } from "$lib/i18n/messages";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const { params, setHeaders, locals, cookies } = event;
  setHeaders({ "cache-control": "private, no-store" });
  const lang = getLang(event);
  // Project only what the page renders; nonce, userId, email, and status
  // never leave the server.
  const row = await db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      createdAt: schema.order.createdAt,
      name: schema.order.name,
      phone: schema.order.phone,
      address: schema.order.address,
      city: schema.order.city,
      total: schema.order.total,
      userId: schema.order.userId,
    })
    .from(schema.order)
    .where(eq(schema.order.id, params.id))
    .get();
  if (!row) error(404, t(lang, "order.notFound"));

  const ownsOrder = row.userId !== null && row.userId === locals.user?.id;
  const hasCapability = await readOrderAccessCookie(cookies, row.id, getOrderAccessSecret(env));
  if (!ownsOrder && !hasCapability) error(404, t(lang, "order.notFound"));

  const order = {
    id: row.id,
    number: row.number,
    createdAt: row.createdAt,
    name: row.name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    total: row.total,
  };
  const items = await db
    .select({
      id: schema.orderItem.id,
      productName: schema.orderItem.productName,
      variantName: schema.orderItem.variantName,
      quantity: schema.orderItem.quantity,
      unitPrice: schema.orderItem.unitPrice,
    })
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, order.id))
    .orderBy(schema.orderItem.id);
  return { order, items };
};
