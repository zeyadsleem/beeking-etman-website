import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import { t } from "$lib/i18n/messages";
import { isAdminRole } from "$lib/server/admin/roles";
import {
  createTransfer,
  listTransfers,
  listWarehouses,
  completeTransfer,
  INVENTORY_PAGE_SIZE,
} from "$lib/server/admin/inventory";
import type { Actions, PageServerLoad } from "./$types";

const pageParam = z.coerce
  .number()
  .finite()
  .catch(1)
  .transform((v) => Math.min(Math.max(1, Math.trunc(v)), 2 ** 53 - 1));

export const load: PageServerLoad = async (event) => {
  if (!isAdminRole(event.locals.user?.role)) redirect(302, "/login");
  const lang = getLang(event);
  const url = new URL(event.url);
  const requestedPage = pageParam.parse(url.searchParams.get("page"));
  const initial = await listTransfers(db, { page: requestedPage });
  let { items, total } = initial;
  let page = requestedPage;
  if (items.length === 0 && page > 1 && total > 0) {
    page = Math.ceil(total / INVENTORY_PAGE_SIZE);
    const clamped = await listTransfers(db, { page });
    items = clamped.items;
    total = clamped.total;
  }
  const warehouses = await listWarehouses(db);
  return { items, total, page, pageSize: INVENTORY_PAGE_SIZE, warehouses, lang };
};

const createSchema = z
  .object({
    fromWarehouseId: z.string().min(1),
    toWarehouseId: z.string().min(1),
    itemType: z.enum(["variant", "batch", "material"]),
    itemId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, { message: "sameWarehouse" });

export const actions: Actions = {
  create: async (event) => {
    const lang = getLang(event);
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });
    const form = await event.request.formData();
    const parsed = createSchema.safeParse({
      fromWarehouseId: String(form.get("fromWarehouseId") ?? ""),
      toWarehouseId: String(form.get("toWarehouseId") ?? ""),
      itemType: String(form.get("itemType") ?? ""),
      itemId: String(form.get("itemId") ?? ""),
      quantity: String(form.get("quantity") ?? ""),
    });
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message ?? "invalid";
      return fail(400, { message: t(lang, `admin.transfers.${key}`) });
    }
    const result = await createTransfer(db, {
      fromWarehouseId: parsed.data.fromWarehouseId,
      toWarehouseId: parsed.data.toWarehouseId,
      items: [
        {
          itemType: parsed.data.itemType,
          itemId: parsed.data.itemId,
          quantity: parsed.data.quantity,
        },
      ],
      userId: event.locals.user?.id,
    });
    if (!result.ok) {
      const key = result.reason === "invalid" ? "invalidTransition" : result.reason;
      return fail(400, { message: t(lang, `admin.transfers.${key}`) });
    }
    return { ok: true };
  },
  advance: async (event) => {
    const lang = getLang(event);
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });
    const form = await event.request.formData();
    const transferId = String(form.get("transferId") ?? "");
    const next = String(form.get("next") ?? "");
    if (next !== "outbound" && next !== "completed" && next !== "cancelled") {
      return fail(400, { message: t(lang, "admin.transfers.invalidTransition") });
    }
    const result = await completeTransfer(db, transferId, next, { userId: event.locals.user?.id });
    if (!result.ok) {
      const key = result.reason === "notFound" ? "notFound" : "invalidTransition";
      return fail(400, { message: t(lang, `admin.transfers.${key}`) });
    }
    return { ok: true };
  },
};
