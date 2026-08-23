import { fail } from "@sveltejs/kit";
import {
  CATEGORY_SLUG_INVALID,
  CATEGORY_SLUG_REQUIRED,
  categoryInputSchema,
  deleteCategory,
  listCategoriesWithCounts,
  upsertCategory,
} from "$lib/server/admin/categories";
import { t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  return { categories: await listCategoriesWithCounts(db), lang: getLang(event) };
};

export const actions: Actions = {
  save: async (event) => {
    // Defense-in-depth: the /admin layout guard only covers page loads, not
    // POSTs, so every mutating action re-checks the role server-side.
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(getLang(event), "errors.unexpected") });

    const lang = getLang(event);
    const form = await event.request.formData();

    // Form fields are untrusted boundary input: coerce to strings and let the
    // schema validate shape, limits, slug syntax, and auto-slug generation.
    const parsed = categoryInputSchema.safeParse({
      name: String(form.get("name") ?? ""),
      nameEn: String(form.get("nameEn") ?? ""),
      slug: String(form.get("slug") ?? ""),
    });
    // Slug failures carry their own i18n key (see the schema constants): the
    // Arabic-first workflow — Arabic-only name, blank slug — gets actionable
    // guidance instead of a generic error. Anything else stays generic.
    if (!parsed.success) {
      const slugIssue = parsed.error.issues.find((issue) => issue.path[0] === "slug");
      if (!slugIssue) return fail(400, { message: t(lang, "errors.unexpected") });
      const key =
        slugIssue.message === CATEGORY_SLUG_REQUIRED
          ? CATEGORY_SLUG_REQUIRED
          : CATEGORY_SLUG_INVALID;
      return fail(400, { message: t(lang, key) });
    }

    const idRaw = String(form.get("id") ?? "").trim();
    const result = await upsertCategory(db, {
      id: idRaw === "" ? undefined : idRaw,
      ...parsed.data,
    });
    if (!result.ok) return fail(409, { message: t(lang, "admin.categories.slugTaken") });

    // Non-empty payload keeps Kit's ActionData union usable in the view.
    return { saved: true };
  },

  delete: async (event) => {
    const lang = getLang(event);
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(lang, "errors.unexpected") });

    const form = await event.request.formData();
    const id = String(form.get("id") ?? "");
    if (id === "") return fail(400, { message: t(lang, "errors.unexpected") });

    const result = await deleteCategory(db, id);
    if (!result.ok) {
      if (result.reason === "has_products")
        return fail(409, { message: t(lang, "admin.categories.hasProductsError") });
      return fail(404, { message: t(lang, "errors.unexpected") });
    }
    return { deleted: true };
  },
};
