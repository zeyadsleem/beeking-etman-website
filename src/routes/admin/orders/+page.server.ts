import { z } from "zod";
import { listOrders, ORDERS_PAGE_SIZE, parseOrderStatus } from "$lib/server/admin/orders";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

// URL search params are untrusted input: normalize `page` here so a malformed
// value (e.g. "?page=abc" → NaN) can never reach listOrders, whose offset
// math cannot recover from a NaN page.
const pageParam = z.coerce
  .number()
  .catch(1)
  .transform((value) => Math.max(1, Math.trunc(value)));

export const load: PageServerLoad = async (event) => {
  const statusParam = event.url.searchParams.get("status");
  const status = statusParam === null ? undefined : parseOrderStatus(statusParam);
  const page = pageParam.parse(event.url.searchParams.get("page"));
  const lang = getLang(event);
  const { items, total } = await listOrders(db, { status: status ?? undefined, page });
  // `pageSize` feeds the view's next-page visibility check without importing
  // the server module into client code.
  return { items, total, page, pageSize: ORDERS_PAGE_SIZE, status: status ?? null, lang };
};
