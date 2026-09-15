import { error, fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { listCategoriesWithCounts } from "$lib/server/admin/categories";
import {
  addProductImage,
  deleteProductImage,
  listProductImages,
  reorderProductImages,
  setCoverUrl,
} from "$lib/server/admin/product-images";
import { deleteVariant, getProductForEdit, upsertVariant } from "$lib/server/admin/products";
import { logAdminAction } from "$lib/server/admin/audit";
import { isAdminRole } from "$lib/server/admin/roles";
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
import type { Department } from "$lib/server/store";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const detail = await getProductForEdit(db, event.params.id);
  if (!detail) error(404, t(lang, "products.notFound"));

  const [extra] = await db
    .select({
      categoryId: schema.product.categoryId,
      nameEn: schema.product.nameEn,
    })
    .from(schema.product)
    .where(eq(schema.product.id, event.params.id));

  const categoryRows = await listCategoriesWithCounts(db);
  const images = await listProductImages(db, event.params.id);
  return {
    ...detail,
    image: images[0]?.url ?? "",
    categoryId: extra?.categoryId ?? "",
    nameEn: extra?.nameEn ?? "",
    categories: categoryRows.map((row) => ({
      id: row.id,
      name: row.nameEn.trim() !== "" ? localized(row.name, row.nameEn, lang) : row.name,
      department: row.department,
    })),
    images,
    department: (detail.product.department ?? "honey") as Department,
    lang,
  };
};

export const actions: Actions = {
  details: async (event) => {
    const lang = getLang(event);
    // Defense-in-depth: the /admin layout guard only covers page loads, not
    // POSTs, so every mutating action re-checks the role server-side.
    if (!isAdminRole(event.locals.user?.role))
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
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });

    // File-only action: swap the cover image without touching other fields.
    // setCoverUrl (D1/D2) also mirrors a single-variant image so the
    // storefront cards + first gallery slot reflect the upload immediately.
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

    const existing = await db
      .select({ id: schema.product.id })
      .from(schema.product)
      .where(eq(schema.product.id, event.params.id))
      .get();
    if (!existing) return fail(404, { message: t(lang, "errors.unexpected") });

    await setCoverUrl(db, event.params.id, upload.url);
    return { uploaded: t(lang, "admin.products.uploadedImage") };
  },

  galleryAdd: async (event) => {
    const lang = getLang(event);
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });

    // Either an uploaded file or a pasted URL feed a new gallery row.
    const form = await event.request.formData();
    const raw = form.get("image");
    const pasted = typeof form.get("imageUrl") === "string" ? form.get("imageUrl") : "";
    const pastedUrl = typeof pasted === "string" ? pasted.trim() : "";

    let url: string;
    if (raw instanceof File && raw.size > 0) {
      const platform = event.platform;
      if (!platform) return fail(503, { message: t(lang, "errors.storageUnavailable") });
      const upload = await saveProductImage(platform.env.MEDIA, raw);
      if (!upload.ok) {
        const failure = productFormFailure(upload.reason);
        return fail(failure.status, { message: t(lang, failure.messageKey) });
      }
      url = upload.url;
    } else if (pastedUrl !== "") {
      // https-only (M4-6): http, data, and javascript: URLs never reach the gallery.
      const parsed = z.string().url().startsWith("https://").safeParse(pastedUrl);
      if (!parsed.success) return fail(400, { message: t(lang, "errors.unexpected") });
      url = parsed.data;
    } else {
      return fail(400, { message: t(lang, "errors.unexpected") });
    }

    const result = await addProductImage(db, event.params.id, url);
    if (!result.ok) return fail(404, { message: t(lang, "errors.unexpected") });

    logAdminAction(db, {
      action: "product.gallery_add",
      targetType: "product",
      targetId: event.params.id,
      details: { imageId: result.id },
      userId: event.locals.user?.id,
    });

    return { galleryAdded: t(lang, "admin.products.galleryImageAdded") };
  },

  galleryDelete: async (event) => {
    const lang = getLang(event);
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });

    const form = await event.request.formData();
    const rawId = form.get("imageId");
    const imageId = typeof rawId === "string" ? rawId.trim() : "";
    if (imageId === "") return fail(400, { message: t(lang, "errors.unexpected") });

    const result = await deleteProductImage(db, event.params.id, imageId);
    if (!result.ok) return fail(404, { message: t(lang, "errors.unexpected") });

    logAdminAction(db, {
      action: "product.gallery_delete",
      targetType: "product",
      targetId: event.params.id,
      details: { imageId },
      userId: event.locals.user?.id,
    });

    return { galleryRemoved: t(lang, "admin.products.galleryImageRemoved") };
  },

  galleryReorder: async (event) => {
    const lang = getLang(event);
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });

    const form = await event.request.formData();
    const raw = form.get("order");
    const orderedIds =
      typeof raw === "string"
        ? raw
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id !== "")
        : [];
    if (orderedIds.length === 0) return fail(400, { message: t(lang, "errors.unexpected") });

    const result = await reorderProductImages(db, event.params.id, orderedIds);
    if (!result.ok) return fail(400, { message: t(lang, "errors.unexpected") });

    logAdminAction(db, {
      action: "product.gallery_reorder",
      targetType: "product",
      targetId: event.params.id,
      details: { count: orderedIds.length },
      userId: event.locals.user?.id,
    });

    return { galleryOrdered: t(lang, "admin.products.galleryOrderSaved") };
  },

  variantSave: async (event) => {
    const lang = getLang(event);
    if (!isAdminRole(event.locals.user?.role))
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
    logAdminAction(db, {
      action: "product.variant_save",
      targetType: "product",
      targetId: event.params.id,
      details: { variantId: result.id },
      userId: event.locals.user?.id,
    });
    return { variantSaved: t(lang, "admin.products.variantSaved") };
  },

  variantDelete: async (event) => {
    const lang = getLang(event);
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });

    const form = await event.request.formData();
    const rawId = form.get("variantId");
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (id === "") return fail(400, { message: t(lang, "errors.unexpected") });

    const result = await deleteVariant(db, id, event.params.id);
    if (!result.ok && result.reason === "referenced") {
      return fail(409, {
        message: localized(
          "لا يمكن حذف متغير مرتبط بطلبات أو تحويلات مخزون. يمكنك تعديل مخزونه بدلاً من حذفه.",
          "Cannot delete a variant linked to orders or stock conversions. You can adjust its stock instead.",
          lang,
        ),
      });
    }
    if (!result.ok) return fail(404, { message: t(lang, "errors.unexpected") });
    logAdminAction(db, {
      action: "product.variant_delete",
      targetType: "product",
      targetId: event.params.id,
      details: { variantId: id },
      userId: event.locals.user?.id,
    });
    return { variantDeleted: t(lang, "admin.products.variantDeleted") };
  },
};
