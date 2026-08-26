import { error, fail } from "@sveltejs/kit";
import {
  allowedTransitions,
  getOrderWithItems,
  parseOrderStatus,
  transitionOrderStatus,
  type TransitionResult,
} from "$lib/server/admin/orders";
import { t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const detail = await getOrderWithItems(db, event.params.id);
  if (!detail) error(404, t(getLang(event), "order.notFound"));

  return {
    order: detail.order,
    items: detail.items,
    transitions: allowedTransitions(detail.order.status),
    lang: getLang(event),
  };
};

export const actions: Actions = {
  update: async (event) => {
    // Defense-in-depth: the /admin layout guard only covers page loads, not
    // POSTs, so every mutating action re-checks the role server-side.
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(getLang(event), "errors.unexpected") });

    // Form fields are untrusted boundary input: coerce and re-validate both.
    const form = await event.request.formData();
    const id = String(form.get("id") ?? "");
    const nextRaw = String(form.get("status") ?? "");
    const next = parseOrderStatus(nextRaw);
    if (!next) return fail(400, { message: t(getLang(event), "errors.unexpected") });

    let result: TransitionResult;
    try {
      result = await transitionOrderStatus(db, id, next);
    } catch {
      // Restock failure after a committed cancel flip is already logged
      // loudly by the service; surface it as a retryable server failure.
      return fail(500, { message: t(getLang(event), "errors.unexpected") });
    }
    if (!result.ok) {
      if (result.reason === "not_found") error(404, t(getLang(event), "order.notFound"));
      return fail(409, { message: t(getLang(event), "admin.order.invalidTransition") });
    }

    return { success: t(getLang(event), "admin.order.updated") };
  },
};
