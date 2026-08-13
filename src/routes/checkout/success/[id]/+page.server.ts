import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const { params, setHeaders, locals } = event;
  setHeaders({ "cache-control": "private, no-store" });
  const order = await db.select().from(schema.order).where(eq(schema.order.id, params.id)).get();
  if (!order) error(404, "الطلب غير موجود");
  if (order.userId !== null && order.userId !== locals.user?.id) error(404, "الطلب غير موجود");
  const items = await db
    .select()
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, order.id))
    .orderBy(schema.orderItem.id);
  return { order, items };
};
