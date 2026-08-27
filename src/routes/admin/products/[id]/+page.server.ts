import { error, fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { listCategoriesWithCounts } from "$lib/server/admin/categories";
import { deleteVariant, getProductForEdit, upsertVariant } from "$lib/server/admin/products";
import { logAdminAction } from "$lib/server/admin/audit";
import {
  applyProductForm,
  parseVariantForm,
  productFormFailure,
} from "$lib/server/admin/product-form";
import { saveProductImage } from "$lib/server/admin/upload";
import { localized, t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { getLang } from "$lib/server/lang";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const detail = await getProductForEdit(db, event.params.id);
  if (!detail) error(404, t(lang, "products.notFound"));

  // The shared admin row omits nameEn, the legacy cover column and categoryId;
  // one PK-indexed select feeds the form's prefills and the current-image thumb.
  const [extra] = await db
    .select({
      image: schema.product.image,
      categoryId: schema.product.categoryId,
      nameEn: schema.product.nameEn,
    })
    .from(schema.product)
    .where(eq(schema.product.id, event.params.id));

  const categoryRows = await listCategoriesWithCounts(db);
  return {
    ...detail,
    image: extra?.image ?? "",
    categoryId: extra?.categoryId ?? "",
    nameEn: extra?.nameEn ?? "",
    categories: categoryRows.map((row) => ({
      id: row.id,
      name: row.nameEn.trim() !== "" ? localized(row.name, row.nameEn, lang) : row.name,
      department: row.department,
    })),
    department: detail.product.department ?? "honey",
    lang,
  };
};

export const actions: Actions = {
  details: async (event) => {
    const lang = getLang(event);
    // Defense-in-depth: the /admin layout guard only covers page loads, not
    // POSTs, so every mutating action re-checks the role server-side.
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(lang, "errors.unexpected") });

    // Same pipeline as create (shared helper), minus the redirect.
    const result = await applyProductForm(db, event, event.params.id);
    if (!result.ok) {
      const failure = productFormFailure(result.reason);
      return fail(failure.status, { message: t(lang, failure.messageKey) });
    }

    // Best-effort audit log — must not fail the originating operation.
    logAdminAction(db, {
      action: "product.update",
      targetType: "product",
      targetId: event.params.id,
      userId: event.locals.user?.id,
    });

    return { saved: t(lang, "admin.products.saved") };
  },

  uploadImage: async (event) => {
    const lang = getLang(event);
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(lang, "errors.unexpected") });

    // File-only action: swap the cover image without touching other fields.
    const form = await event.request.formData();
    const raw = form.get("image");
    if (!(raw instanceof File) || raw.size === 0)
      return fail(400, { message: t(lang, "errors.unexpected") });

    const platform = event.platform;
    if (!platform) return fail(503, { message: t(lang, "errors.storageUnavailable") });
    const upload = await saveProductImage(platform.env.MEDIA, raw);
    if (!upload.ok) {
      const failure = productFormFailure(upload.reason);
      return fail(failure.status, { message: t(lang, failure.messageKey) });
    }

    const updated = await db
      .update(schema.product)
      .set({ image: upload.url })
      .where(eq(schema.product.id, event.params.id))
      .returning({ id: schema.product.id });
    if (updated.length === 0) return fail(404, { message: t(lang, "errors.unexpected") });
    return { uploaded: t(lang, "admin.products.uploadedImage") };
  },

  variantSave: async (event) => {
    const lang = getLang(event);
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(lang, "errors.unexpected") });

    const form = await event.request.formData();
    const parsed = parseVariantForm(form);
    if (!parsed.ok) return fail(400, { message: t(lang, "errors.unexpected") });

    const result = await upsertVariant(
      db,
      event.params.id,
      parsed.id === undefined ? parsed.input : { ...parsed.input, id: parsed.id },
    );
    if (!result.ok) {
      // A forged cross-product variantId is rejected by the service — surface
      // it like any vanished row instead of leaking which ids exist.
      if (result.reason === "name_taken")
        return fail(409, { message: t(lang, "admin.products.variantNameTaken") });
      return fail(404, { message: t(lang, "errors.unexpected") });
    }
    return { variantSaved: t(lang, "admin.products.variantSaved") };
  },

  variantDelete: async (event) => {
    const lang = getLang(event);
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(lang, "errors.unexpected") });

    const form = await event.request.formData();
    const rawId = form.get("variantId");
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (id === "") return fail(400, { message: t(lang, "errors.unexpected") });

    const result = await deleteVariant(db, id, event.params.id);
    if (!result.ok) return fail(404, { message: t(lang, "errors.unexpected") });
    return { variantDeleted: t(lang, "admin.products.variantDeleted") };
  },
};
