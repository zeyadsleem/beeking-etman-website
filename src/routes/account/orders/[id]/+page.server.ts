import { error, redirect } from "@sveltejs/kit";
import { and, asc, eq } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { t } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";
import { loginRedirectPath } from "$lib/server/login-redirect";
import { receivingAccountFor, settlementConfig } from "$lib/server/settlement/config";
import { customerOrderWhatsappText, whatsappLink } from "$lib/server/settlement/whatsapp";
import {
  isV1PaymentMethod,
  parsePaymentMethod,
  parsePaymentStatus,
  PAYMENT_METHOD_LABEL_KEY,
} from "$lib/settlement/types";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user) redirect(302, loginRedirectPath(event.url));
  const lang = getLang(event);
  // Ownership comes from the session only — a client-supplied id that does not
  // belong to locals.user.id is indistinguishable from a missing order (404).
  // Project only the columns the page renders — never nonce/userId or email.
  const orderRows = await db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      createdAt: schema.order.createdAt,
      status: schema.order.status,
      paymentStatus: schema.order.paymentStatus,
      paymentMethod: schema.order.paymentMethod,
      total: schema.order.total,
      name: schema.order.name,
      phone: schema.order.phone,
      address: schema.order.address,
      city: schema.order.city,
    })
    .from(schema.order)
    .where(and(eq(schema.order.id, event.params.id), eq(schema.order.userId, event.locals.user.id)))
    .limit(1);
  const order = orderRows[0];
  if (!order) error(404, t(lang, "order.notFound"));
  const items = await db
    .select({
      id: schema.orderItem.id,
      productName: schema.orderItem.productName,
      variantName: schema.orderItem.variantName,
      quantity: schema.orderItem.quantity,
      unitPrice: schema.orderItem.unitPrice,
    })
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, order.id))
    .orderBy(asc(schema.orderItem.productName));

  const config = settlementConfig(env);
  const method = parsePaymentMethod(order.paymentMethod);
  const isTransfer = method === "instapay" || method === "wallet";
  const paymentStatus = parsePaymentStatus(order.paymentStatus);
  const claimable =
    isTransfer &&
    order.status !== "cancelled" &&
    (paymentStatus === "unpaid" || paymentStatus === "failed");
  const whatsappUrl = config.whatsappNumber
    ? whatsappLink(
        config.whatsappNumber,
        customerOrderWhatsappText({ number: order.number, total: order.total, method }, lang),
      )
    : null;

  return {
    lang,
    order: {
      id: order.id,
      number: order.number,
      createdAt: order.createdAt,
      status: order.status,
      total: order.total,
      name: order.name,
      phone: order.phone,
      address: order.address,
      city: order.city,
    },
    items,
    payment: {
      methodLabelKey: method && isV1PaymentMethod(method) ? PAYMENT_METHOD_LABEL_KEY[method] : null,
      account: isTransfer && method && claimable ? receivingAccountFor(config, method) : null,
      claimable,
    },
    whatsappUrl,
  };
};
