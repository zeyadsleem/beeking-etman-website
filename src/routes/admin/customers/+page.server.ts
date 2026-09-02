import { z } from "zod";
import { listCustomers, CUSTOMERS_PAGE_SIZE } from "$lib/server/admin/customers";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

// URL search params are untrusted input: normalize `page` here so a malformed
// value (e.g. "?page=abc" → NaN) can never reach listCustomers, whose offset
// math cannot recover from a NaN page.
const MAX_SAFE_INTEGER = 2 ** 53 - 1;
const pageParam = z.coerce
  .number()
  .finite()
  .catch(1)
  .transform((value) => Math.min(Math.max(1, Math.trunc(value)), MAX_SAFE_INTEGER));

export const load: PageServerLoad = async (event) => {
  const q = event.url.searchParams.get("q")?.trim() || undefined;
  const lang = getLang(event);
  const requestedPage = pageParam.parse(event.url.searchParams.get("page"));
  const listAt = (p: number) => listCustomers(db, { query: q, page: p });

  let { items, total } = await listAt(requestedPage);
  let page = requestedPage;
  if (items.length === 0 && page > 1 && total > 0) {
    page = Math.ceil(total / CUSTOMERS_PAGE_SIZE);
    ({ items } = await listAt(page));
  }
  return { items, total, page, pageSize: CUSTOMERS_PAGE_SIZE, q, lang };
};
