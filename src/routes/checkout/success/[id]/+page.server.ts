import { error, fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { getOrderAccessSecret, readOrderAccessCookie } from "$lib/server/order-access";
import { getLang } from "$lib/server/lang";
import * as schema from "$lib/server/db/schema";
import { t, type MessageKey } from "$lib/i18n/messages";
import { receivingAccountFor, settlementConfig } from "$lib/server/settlement/config";
import { submitClaim, type ClaimResult } from "$lib/server/settlement/claims";
import { parsePaymentMethod, parsePaymentStatus } from "$lib/settlement/types";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import type { Actions, PageServerLoad, RequestEvent } from "./$types";

// Spec §3.4.3: 5 claims per order per hour, 20 per IP per hour.
const CLAIM_ORDER_LIMIT = createDbRateLimiter(db, { windowMs: 3_600_000, max: 5 });
const CLAIM_IP_LIMIT = createDbRateLimiter(db, { windowMs: 3_600_000, max: 20 });

const CLAIM_FAILURE_KEYS: Record<Extract<ClaimResult, { ok: false }>["reason"], MessageKey> = {
  order_not_found: "order.notFound",
  not_transfer_method: "success.claim.error.notTransfer",
  already_claimed: "success.claim.alreadyClaimed",
  not_claimable: "success.claim.error.notClaimable",
};

type OrderRow = {
  id: string;
  number: string;
  createdAt: number;
  name: string;
  phone: string;
  address: string;
  city: string;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentReference: string | null;
  userId: string | null;
};

async function loadAccessibleOrder(event: RequestEvent, id: string): Promise<OrderRow | null> {
  // Project only what the page renders; nonce and email never leave the server.
  const row = await db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      createdAt: schema.order.createdAt,
      name: schema.order.name,
      phone: schema.order.phone,
      address: schema.order.address,
      city: schema.order.city,
      total: schema.order.total,
      status: schema.order.status,
      paymentStatus: schema.order.paymentStatus,
      paymentMethod: schema.order.paymentMethod,
      paymentReference: schema.order.paymentReference,
      userId: schema.order.userId,
    })
    .from(schema.order)
    .where(eq(schema.order.id, id))
    .get();
  if (!row) return null;
  const ownsOrder = row.userId !== null && row.userId === event.locals.user?.id;
  const hasCapability = await readOrderAccessCookie(
    event.cookies,
    row.id,
    getOrderAccessSecret(env),
  );
  if (!ownsOrder && !hasCapability) return null;
  return row;
}

export const load: PageServerLoad = async (event) => {
  const { params, setHeaders } = event;
  setHeaders({ "cache-control": "private, no-store" });
  const lang = getLang(event);
  const row = await loadAccessibleOrder(event, params.id);
  if (!row) error(404, t(lang, "order.notFound"));

  const config = settlementConfig(env);
  const method = parsePaymentMethod(row.paymentMethod);
  const isTransfer = method === "instapay" || method === "wallet";
  const paymentStatus = parsePaymentStatus(row.paymentStatus);

  const order = {
    id: row.id,
    number: row.number,
    createdAt: row.createdAt,
    name: row.name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    total: row.total,
  };
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
    .orderBy(schema.orderItem.id);

  return {
    order,
    items,
    claim: {
      isTransfer,
      method: isTransfer ? method : null,
      account: isTransfer && method ? receivingAccountFor(config, method) : null,
      status: paymentStatus ?? "unknown",
      reference: row.paymentReference,
      claimable:
        isTransfer &&
        row.status !== "cancelled" &&
        (paymentStatus === "unpaid" || paymentStatus === "failed"),
      claimed: paymentStatus === "pending_review",
      paid: paymentStatus === "paid",
      refunded: paymentStatus === "refunded",
    },
  };
};

export const actions: Actions = {
  claim: async (event) => {
    const lang = getLang(event);
    const row = await loadAccessibleOrder(event, event.params.id);
    if (!row) error(404, t(lang, "order.notFound"));

    const [orderAllowed, ipAllowed] = await Promise.all([
      CLAIM_ORDER_LIMIT.allow(`claim:${row.id}`),
      CLAIM_IP_LIMIT.allow(`claim-ip:${clientAddressKey(event)}`),
    ]);
    if (!orderAllowed || !ipAllowed) {
      return fail(429, { claimError: t(lang, "errors.tooManyAttempts") });
    }

    const rawReference = (await event.request.formData()).get("reference");
    const result = await submitClaim(db, {
      orderId: row.id,
      reference: typeof rawReference === "string" ? rawReference : null,
      actorUserId: event.locals.user?.id ?? null,
    });
    if (!result.ok) {
      return fail(400, { claimError: t(lang, CLAIM_FAILURE_KEYS[result.reason]) });
    }
    return { claimSubmitted: true };
  },
};
