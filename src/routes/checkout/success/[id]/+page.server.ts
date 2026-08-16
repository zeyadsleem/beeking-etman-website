import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import * as schema from "$lib/server/db/schema";
import { t } from "$lib/i18n/messages";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const { params, setHeaders, locals } = event;
  setHeaders({ "cache-control": "private, no-store" });
  const lang = getLang(event);
  const order = await db.select().from(schema.order).where(eq(schema.order.id, params.id)).get();
  if (!order) error(404, t(lang, "order.notFound"));
  if (order.userId !== null && order.userId !== locals.user?.id)
    error(404, t(lang, "order.notFound"));
  const items = await db
    .select()
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, order.id))
    .orderBy(schema.orderItem.id);
  return { order, items };
};
