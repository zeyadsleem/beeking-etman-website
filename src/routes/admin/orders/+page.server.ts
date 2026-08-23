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
  const lang = getLang(event);
  // URL search params are untrusted input: normalize `page` here so a malformed
  // value (e.g. "?page=abc" → NaN) can never reach listOrders, whose offset
  // math cannot recover from a NaN page.
  const requestedPage = pageParam.parse(event.url.searchParams.get("page"));
  const listAt = (p: number) => listOrders(db, { status: status ?? undefined, page: p });

  let { items, total } = await listAt(requestedPage);
  let page = requestedPage;
  if (items.length === 0 && page > 1 && total > 0) {
    // An out-of-range page (stale deep link, or a float64-huge value that
    // survived zod as an integer) must not render as a false "No orders."
    // dead end with no way back — clamp to the last page, matching the
    // /account/orders pagination behavior.
    page = Math.ceil(total / ORDERS_PAGE_SIZE);
    ({ items } = await listAt(page));
  }
  // `pageSize` feeds the view's next-page visibility check without importing
  // the server module into client code.
  return { items, total, page, pageSize: ORDERS_PAGE_SIZE, status: status ?? null, lang };
};
