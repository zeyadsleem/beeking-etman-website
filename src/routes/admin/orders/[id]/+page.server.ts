import { error, fail } from "@sveltejs/kit";
import {
  allowedTransitions,
  getOrderWithItems,
  parseOrderStatus,
  transitionOrderStatus,
  type TransitionResult,
} from "$lib/server/admin/orders";
import { logAdminAction } from "$lib/server/admin/audit";
import { t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import { isAdminRole } from "$lib/server/admin/roles";
import { sendOrderStatusUpdate } from "$lib/server/email";
import {
  adminOrderWhatsappText,
  normalizeWhatsappNumber,
  whatsappLink,
} from "$lib/server/settlement/whatsapp";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const detail = await getOrderWithItems(db, event.params.id);
  if (!detail) error(404, t(getLang(event), "order.notFound"));
  const lang = getLang(event);

  const customerNumber = normalizeWhatsappNumber(detail.order.phone);
  return {
    order: detail.order,
    items: detail.items,
    transitions: allowedTransitions(detail.order.status),
    customerWhatsappUrl: customerNumber
      ? whatsappLink(
          customerNumber,
          adminOrderWhatsappText({ number: detail.order.number, name: detail.order.name }, lang),
        )
      : null,
    lang,
  };
};

export const actions: Actions = {
  update: async (event) => {
    // Defense-in-depth: the /admin layout guard only covers page loads, not
    // POSTs, so every mutating action re-checks the role server-side.
    if (!isAdminRole(event.locals.user?.role))
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
      if (result.reason === "inventory_reconciliation_required") {
        return fail(409, {
          message:
            getLang(event) === "ar"
              ? "يجب ربط أصناف هذا الطلب القديم بالمخزون قبل إلغائه. تواصل مع مسؤول النظام لمراجعة الأصناف."
              : "This legacy order needs its inventory items reconciled before cancellation. Contact the system administrator.",
        });
      }
      return fail(409, { message: t(getLang(event), "admin.order.invalidTransition") });
    }

    // Best-effort status-update email — never block the admin action.
    try {
      await sendOrderStatusUpdate(event.platform, db, id, next);
    } catch (e) {
      console.error("[admin/order] status update email failed", e);
    }

    // Best-effort audit log — must not fail the originating operation.
    logAdminAction(db, {
      action: "order.status_change",
      targetType: "order",
      targetId: id,
      details: { to: next },
      userId: event.locals.user?.id,
    });

    return { success: t(getLang(event), "admin.order.updated") };
  },
};
