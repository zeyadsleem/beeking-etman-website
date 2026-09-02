import { fail, redirect } from "@sveltejs/kit";
import { listCategoriesWithCounts } from "$lib/server/admin/categories";
import { applyProductForm, productFormFailure } from "$lib/server/admin/product-form";
import { logAdminAction } from "$lib/server/admin/audit";
import { isAdminRole } from "$lib/server/admin/roles";
import { localized, t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const rows = await listCategoriesWithCounts(db);
  return {
    categories: rows.map((row) => ({
      id: row.id,
      name: row.nameEn.trim() !== "" ? localized(row.name, row.nameEn, lang) : row.name,
      department: row.department,
    })),
    lang,
  };
};

export const actions: Actions = {
  default: async (event) => {
    const lang = getLang(event);
    // Defense-in-depth: the /admin layout guard only covers page loads, not
    // POSTs, so every mutating action re-checks the role server-side.
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(lang, "errors.unexpected") });

    // Parse → upload → create → persist image lives in the shared pipeline so
    // create and edit stay behaviorally identical.
    const result = await applyProductForm(db, event);
    if (!result.ok) {
      const failure = productFormFailure(result.reason);
      return fail(failure.status, { message: t(lang, failure.messageKey) });
    }

    // Best-effort audit log — must not fail the originating operation.
    logAdminAction(db, {
      action: "product.create",
      targetType: "product",
      targetId: result.id,
      userId: event.locals.user?.id,
    });

    redirect(303, `/admin/products/${result.id}`);
  },
};
