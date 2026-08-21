import { redirect } from "@sveltejs/kit";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import type { PageServerLoad } from "./$types";

const ORDERS_PAGE_SIZE = 12;

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user) redirect(302, "/login");
  const rawPage = Number.parseInt(event.url.searchParams.get("page") ?? "1", 10);
  const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.order)
    .where(eq(schema.order.userId, event.locals.user.id));
  const total = countRow?.count ?? 0;
  const totalPages = Math.ceil(total / ORDERS_PAGE_SIZE);
  const page = Math.min(requestedPage, Math.max(1, totalPages));

  // Project only the columns the page renders — never nonce/userId or the
  // customer PII snapshot (email/name/phone/address/city).
  const orders = await db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      status: schema.order.status,
      total: schema.order.total,
      createdAt: schema.order.createdAt,
    })
    .from(schema.order)
    .where(eq(schema.order.userId, event.locals.user.id))
    .orderBy(desc(schema.order.createdAt))
    .limit(ORDERS_PAGE_SIZE)
    .offset((page - 1) * ORDERS_PAGE_SIZE);

  return { orders, page, pageSize: ORDERS_PAGE_SIZE, totalPages };
};
