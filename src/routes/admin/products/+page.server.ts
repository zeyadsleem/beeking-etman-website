import { fail } from "@sveltejs/kit";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { deleteProduct, listAdminProducts, PRODUCTS_PAGE_SIZE } from "$lib/server/admin/products";
import { logAdminAction } from "$lib/server/admin/audit";
import { isAdminRole } from "$lib/server/admin/roles";
import { t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { getLang } from "$lib/server/lang";
import type { Actions, PageServerLoad } from "./$types";

// URL search params are untrusted input: normalize `page` here so a malformed
// value (e.g. "?page=abc" → NaN) can never reach listAdminProducts' offset math.
const MAX_SAFE_INTEGER = 2 ** 53 - 1;
const pageParam = z.coerce
  .number()
  .finite()
  .catch(1)
  .transform((value) => Math.min(Math.max(1, Math.trunc(value)), MAX_SAFE_INTEGER));

const DEPT_PATTERN = /^(honey|equipment)$/;
const deptParam = z
  .string()
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return undefined;
    return DEPT_PATTERN.test(v) ? v : undefined;
  });

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const query = event.url.searchParams.get("q")?.trim() ?? "";
  const requestedPage = pageParam.parse(event.url.searchParams.get("page"));
  const department = deptParam.parse(event.url.searchParams.get("dept"));
  const listAt = (p: number) =>
    listAdminProducts(db, { query: query === "" ? undefined : query, page: p, department });

  let { items, total } = await listAt(requestedPage);
  let page = requestedPage;
  if (items.length === 0 && page > 1 && total > 0) {
    // An out-of-range page (stale deep link, or a float64-huge value that
    // survived zod as an integer) must not render as a false "No products."
    // dead end with no way back — clamp to the last page, matching the
    // orders list behavior.
    page = Math.ceil(total / PRODUCTS_PAGE_SIZE);
    ({ items } = await listAt(page));
  }

  // The admin row shape carries no image column, so one batched lookup over
  // the page's ids feeds each row's thumbnail without an N+1 per row.
  const images: Record<string, string> = {};
  if (items.length > 0) {
    const rows = await db
      .select({ id: schema.product.id, image: schema.product.image })
      .from(schema.product)
      .where(
        inArray(
          schema.product.id,
          items.map((item) => item.id),
        ),
      );
    for (const row of rows) images[row.id] = row.image;
  }

  return {
    items,
    total,
    page,
    pageSize: PRODUCTS_PAGE_SIZE,
    query,
    images,
    lang,
    department: department ?? "",
  };
};

export const actions: Actions = {
  delete: async (event) => {
    const lang = getLang(event);
    // Defense-in-depth: the /admin layout guard only covers page loads, not
    // POSTs, so every mutating action re-checks the role server-side.
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });

    const form = await event.request.formData();
    // Narrow instead of String()-coercing so a File entry can never stringify
    // into a truthy garbage id.
    const rawId = form.get("id");
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (id === "") return fail(400, { message: t(lang, "errors.unexpected") });

    const result = await deleteProduct(db, id);
    if (!result.ok) {
      // Historical line items denormalize productId, so a purchased product is
      // undeletable — surface the typed guard instead of a generic error.
      if (result.reason === "referenced_by_orders")
        return fail(409, { message: t(lang, "admin.products.referencedByOrders") });
      return fail(404, { message: t(lang, "errors.unexpected") });
    }

    // Best-effort audit log — must not fail the originating operation.
    logAdminAction(db, {
      action: "product.delete",
      targetType: "product",
      targetId: id,
      userId: event.locals.user?.id,
    });

    // Non-empty payload keeps Kit's ActionData union usable in the view.
    return { deleted: true };
  },
};
