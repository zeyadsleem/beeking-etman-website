import { error, fail, type ActionFailure } from "@sveltejs/kit";
import { asc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  allowedTransitions,
  getOrderWithItems,
  parseOrderStatus,
  transitionOrderStatus,
  type TransitionResult,
} from "$lib/server/admin/orders";
import {
  cleanSettlementText,
  extendHold,
  rejectClaim,
  refundPayment,
  verifyPayment,
  type SettlementActionResult,
} from "$lib/server/admin/settlement";
import { HOLD_EXTENSION_HOURS } from "$lib/settlement/types";
import { logAdminAction } from "$lib/server/admin/audit";
import { t } from "$lib/i18n/messages";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { getLang } from "$lib/server/lang";
import { isAdminRole } from "$lib/server/admin/roles";
import { sendOrderStatusUpdate } from "$lib/server/email";
import {
  adminOrderWhatsappText,
  normalizeWhatsappNumber,
  whatsappLink,
} from "$lib/server/settlement/whatsapp";
import type { Actions, PageServerLoad, RequestEvent } from "./$types";

/** Display label for the reviewing admin; falls back to the stored user id. */
async function resolveReviewerLabel(
  db: LibSQLDatabase<typeof schema>,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const reviewer = await db
    .select({ name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get();
  return reviewer?.name || reviewer?.email || userId;
}

export const load: PageServerLoad = async (event) => {
  const detail = await getOrderWithItems(db, event.params.id);
  if (!detail) error(404, t(getLang(event), "order.notFound"));
  const lang = getLang(event);

  const events = await db
    .select({
      id: schema.paymentEvent.id,
      type: schema.paymentEvent.type,
      reference: schema.paymentEvent.reference,
      note: schema.paymentEvent.note,
      createdAt: schema.paymentEvent.createdAt,
    })
    .from(schema.paymentEvent)
    .where(eq(schema.paymentEvent.orderId, detail.order.id))
    .orderBy(asc(schema.paymentEvent.createdAt), asc(schema.paymentEvent.id));

  const paymentStatus = detail.order.paymentStatus;
  const status = detail.order.status;
  const customerNumber = normalizeWhatsappNumber(detail.order.phone);
  return {
    order: detail.order,
    items: detail.items,
    events,
    reviewerLabel: await resolveReviewerLabel(db, detail.order.paymentReviewedBy),
    settlement: {
      canVerify: paymentStatus === "unpaid" || paymentStatus === "pending_review",
      canReject: paymentStatus === "pending_review",
      canRefund: paymentStatus === "paid",
      canExtendHold:
        status === "pending_confirmation" || status === "confirmed" || status === "processing",
    },
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

interface SettlementPlan {
  run: (actorUserId: string | null, now: number) => Promise<SettlementActionResult>;
  auditDetails: Record<string, unknown>;
}

// The failure payload stays concrete: `ReturnType<typeof fail>` would widen it
// to `ActionFailure<unknown>`, which collapses the generated `ActionData` to {}.
async function runSettlementAction(
  event: RequestEvent,
  action: "mark_paid" | "reject_claim" | "refund" | "extend_hold",
  plan: (form: FormData) => SettlementPlan,
): Promise<{ success: string } | ActionFailure<{ message: string }>> {
  // Defense-in-depth: the /admin layout guard only covers page loads, not
  // POSTs, so every mutating action re-checks the role before reading the body.
  const lang = getLang(event);
  if (!isAdminRole(event.locals.user?.role)) {
    return fail(403, { message: t(lang, "errors.unexpected") });
  }
  const { run, auditDetails } = plan(await event.request.formData());

  let result: SettlementActionResult;
  try {
    result = await run(event.locals.user?.id ?? null, Date.now());
  } catch (e) {
    console.error(`[admin/order] ${action} failed`, e);
    return fail(500, { message: t(lang, "errors.unexpected") });
  }
  if (!result.ok) {
    return fail(result.reason === "invalid_input" ? 400 : 409, {
      message: t(
        lang,
        result.reason === "invalid_input"
          ? "admin.order.invalidInput"
          : "admin.order.invalidTransition",
      ),
    });
  }

  logAdminAction(db, {
    action: `order.payment_${action}`,
    targetType: "order",
    targetId: event.params.id,
    details: auditDetails,
    userId: event.locals.user?.id,
  });
  return { success: t(lang, "admin.order.paymentRecorded") };
}

export const actions: Actions = {
  update: async (event) => {
    // Defense-in-depth: the /admin layout guard only covers page loads, not
    // POSTs, so every mutating action re-checks the role server-side.
    if (!isAdminRole(event.locals.user?.role))
      return fail(403, { message: t(getLang(event), "errors.unexpected") });

    // Form fields are untrusted boundary input: coerce and re-validate the
    // status. The order id is the route param, never the submitted value.
    const form = await event.request.formData();
    const id = event.params.id;
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

  mark_paid: (event) =>
    runSettlementAction(event, "mark_paid", (form) => {
      const reference = String(form.get("reference") ?? "");
      const note = String(form.get("note") ?? "");
      return {
        run: (actorUserId, now) =>
          verifyPayment(db, { orderId: event.params.id, reference, note, actorUserId, now }),
        auditDetails: {
          to: "paid",
          reference: cleanSettlementText(reference),
          note: cleanSettlementText(note),
        },
      };
    }),

  reject_claim: (event) =>
    runSettlementAction(event, "reject_claim", (form) => {
      const note = String(form.get("note") ?? "");
      return {
        run: (actorUserId, now) =>
          rejectClaim(db, { orderId: event.params.id, note, actorUserId, now }),
        auditDetails: { to: "failed", note: cleanSettlementText(note) },
      };
    }),

  refund: (event) =>
    runSettlementAction(event, "refund", (form) => {
      const reference = String(form.get("reference") ?? "");
      const note = String(form.get("note") ?? "");
      return {
        run: (actorUserId, now) =>
          refundPayment(db, { orderId: event.params.id, reference, note, actorUserId, now }),
        auditDetails: {
          to: "refunded",
          reference: cleanSettlementText(reference),
          note: cleanSettlementText(note),
        },
      };
    }),

  extend_hold: (event) =>
    runSettlementAction(event, "extend_hold", () => ({
      run: (actorUserId, now) => extendHold(db, { orderId: event.params.id, actorUserId, now }),
      auditDetails: { hours: HOLD_EXTENSION_HOURS },
    })),
};
