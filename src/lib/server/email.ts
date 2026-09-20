/**
 * Transactional email via the durable outbox. Senders resolve their data,
 * build the HTML/text, and enqueue a `pending` row; the email worker's drain
 * delivers it. `sendEmail` is the direct binding path used by `flushOutbox`
 * and password reset, and is a warning-only no-op when the EMAIL binding is
 * absent. Callers wrap senders in try-catch so a transient DB failure never
 * blocks an order or status change.
 */

import { eq, or, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { env } from "$env/dynamic/private";
import * as schema from "$lib/server/db/schema";
import type { OrderStatus } from "$lib/server/admin/orders";
import { localized } from "$lib/i18n/messages";
import { formatEGP } from "$lib/currency";
import { isV1PaymentMethod, parsePaymentMethod, type V1PaymentMethod } from "$lib/settlement/types";
import { receivingAccountFor, settlementConfig } from "$lib/server/settlement/config";
import type { ReleasedHoldStatus } from "$lib/server/settlement/expiry";

// ---------------------------------------------------------------------------
// Email sending
// ---------------------------------------------------------------------------

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a single email through the Cloudflare Email Service binding.
 * When the binding is missing, logs a warning and returns silently.
 */
export async function sendEmail(
  platform: Readonly<App.Platform> | undefined,
  params: SendEmailParams,
): Promise<void> {
  const binding = platform?.env.EMAIL;
  if (!binding) {
    console.warn("[email] EMAIL binding unavailable — skipping send to", params.to);
    return;
  }

  const fromAddress = env.EMAIL_FROM || "Beeking Etman <noreply@beeking-etman-website.pages.dev>";

  await binding.send({
    to: params.to,
    from: fromAddress,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

// ---------------------------------------------------------------------------
// Durable email outbox (store_notification table)
// ---------------------------------------------------------------------------

interface OutboxEmail {
  recipient: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Canonical outbox types emitted by the app (email delivery spec §3.3) plus
 * `payment_claimed`, which the manual settlement spec §3.7 adds; that spec
 * postdates the EM union, so the two lists reconcile when enqueueEmail moves
 * to the shared outbox module.
 */
export type OutboxType =
  | "order_received"
  | "status_update"
  | "payment_claimed"
  | "payment_confirmed"
  | "payment_failed"
  | "refund"
  | "admin_alert";

/**
 * Persist an email in the durable outbox (`store_notification`) as a
 * `pending` row so a transient failure never loses the message; the email
 * worker's drain delivers it. The body stores a JSON payload `{html,text}`.
 */
export async function enqueueEmail(
  db: LibSQLDatabase<typeof schema>,
  email: OutboxEmail,
  type: OutboxType,
): Promise<void> {
  await db.insert(schema.notification).values({
    type,
    channel: "email",
    recipient: email.recipient,
    subject: email.subject,
    body: JSON.stringify({ html: email.html, text: email.text }),
    status: "pending",
  });
}

/**
 * Attempt to send every pending row in the outbox. Marks each row `sent`
 * (with `sentAt`) on success, or `failed` if the send throws. Best-effort:
 * individual failures never abort the rest of the queue.
 */
export async function flushOutbox(
  platform: Readonly<App.Platform> | undefined,
  db: LibSQLDatabase<typeof schema>,
): Promise<void> {
  const pending = await db
    .select()
    .from(schema.notification)
    .where(or(eq(schema.notification.status, "pending"), isNull(schema.notification.status)));

  for (const row of pending) {
    try {
      const payload = JSON.parse(row.body) as { html?: string; text?: string };
      await sendEmail(platform, {
        to: row.recipient,
        subject: row.subject,
        html: payload.html ?? "",
        text: payload.text ?? "",
      });
      await db
        .update(schema.notification)
        .set({ status: "sent", sentAt: Date.now() })
        .where(eq(schema.notification.id, row.id));
    } catch (e) {
      console.error("[email] outbox send failed", row.id, e);
      await db
        .update(schema.notification)
        .set({ status: "failed" })
        .where(eq(schema.notification.id, row.id));
    }
  }
}

// ---------------------------------------------------------------------------
// HTML helpers — inline styles only, no external CSS
// ---------------------------------------------------------------------------

const BRAND = {
  amber: "#d97706",
  amberLight: "#fef3c7",
  amberDark: "#92400e",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#fffbeb",
} as const;

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:${BRAND.text};">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${BRAND.border};">
${bodyHtml}
</table>
<p style="font-size:12px;color:${BRAND.muted};margin-top:16px;text-align:center;">${escapeHtml(localized("مملكة النحل — عسل نقي 100%", "Kingdom of Honey — 100% Pure Honey", "ar"))}</p>
</td></tr>
</table>
</body>
</html>`;
}

function headerRow(): string {
  return `<tr>
<td style="background-color:${BRAND.amber};padding:20px 32px;text-align:center;">
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(localized("مملكة النحل", "Kingdom of Honey", "ar"))}</h1>
</td>
</tr>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Currency formatting for the emails. Order amounts are integer piasters, so
 * render them through the shared `formatEGP` helper instead of re-implementing
 * the conversion.
 */
function formatPrice(price: number): string {
  return formatEGP(price, "ar");
}

function origin(): string {
  return env.ORIGIN || "https://beeking-etman-website.pages.dev";
}

function trackingUrlFor(orderId: string): string {
  return `${origin()}/checkout/success/${orderId}`;
}

function adminRecipients(): string[] {
  return (env.ADMIN_NOTIFY_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Order confirmation email
// ---------------------------------------------------------------------------

interface OrderConfirmationItem {
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
}

export async function sendOrderConfirmation(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
): Promise<void> {
  const row = await db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      email: schema.order.email,
      name: schema.order.name,
      phone: schema.order.phone,
      city: schema.order.city,
      governorate: schema.order.governorate,
      address: schema.order.address,
      total: schema.order.total,
      paymentMethod: schema.order.paymentMethod,
      createdAt: schema.order.createdAt,
    })
    .from(schema.order)
    .where(eq(schema.order.id, orderId))
    .get();
  if (!row) {
    console.error("[email] order confirmation skipped — order not found:", orderId);
    return;
  }

  const items = await db
    .select({
      productName: schema.orderItem.productName,
      variantName: schema.orderItem.variantName,
      quantity: schema.orderItem.quantity,
      unitPrice: schema.orderItem.unitPrice,
    })
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, orderId));

  const trackingUrl = trackingUrlFor(row.id);
  const subject = localized(
    `تم استلام الطلب ${row.number} — مملكة النحل`,
    `Order ${row.number} received — Kingdom of Honey`,
    "ar",
  );

  // Payment instructions are the point of this email: a transfer order needs
  // the receiving account and the exact amount, a COD order needs the amount
  // due on delivery. No copy claims a payment was received.
  const parsedMethod = parsePaymentMethod(row.paymentMethod);
  const method = parsedMethod && isV1PaymentMethod(parsedMethod) ? parsedMethod : null;
  const transferAccount = method ? receivingAccountFor(settlementConfig(env), method) : null;

  const html = buildOrderConfirmationHtml(row, items, trackingUrl, method, transferAccount);
  const text = buildOrderConfirmationText(row, items, trackingUrl, method, transferAccount);

  await enqueueEmail(db, { recipient: row.email, subject, html, text }, "order_received");

  await enqueueAdminNotification(db, row, items, trackingUrl);
}

/**
 * Enqueue a new-order notification to every address in ADMIN_NOTIFY_EMAILS
 * (comma-separated). No-ops when the env var is unset/empty.
 */
async function enqueueAdminNotification(
  db: LibSQLDatabase<typeof schema>,
  order: {
    id: string;
    number: string;
    email: string;
    name: string;
    phone?: string | null;
    city?: string | null;
    governorate?: string | null;
    address?: string | null;
    total: number;
  },
  items: OrderConfirmationItem[],
  trackingUrl: string,
): Promise<void> {
  const recipients = adminRecipients();
  if (recipients.length === 0) return;

  const subject = localized(
    `طلب جديد ${order.number} — ${order.name}`,
    `New order ${order.number} — ${order.name}`,
    "ar",
  );
  const html = buildAdminNotificationHtml(order, items, trackingUrl);
  const text = buildAdminNotificationText(order, items, trackingUrl);

  for (const recipient of recipients) {
    await enqueueEmail(db, { recipient, subject, html, text }, "admin_alert");
  }
}

function buildAdminNotificationHtml(
  order: {
    number: string;
    name: string;
    email: string;
    phone?: string | null;
    city?: string | null;
    governorate?: string | null;
    address?: string | null;
    total: number;
  },
  items: OrderConfirmationItem[],
  trackingUrl: string,
): string {
  const itemRows = items
    .map(
      (item) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">
  <span style="font-weight:600;">${escapeHtml(item.productName)}</span>
  ${item.variantName ? `<span style="color:${BRAND.muted};margin-right:8px;">(${escapeHtml(item.variantName)})</span>` : ""}
</td>
<td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};text-align:center;">×${item.quantity}</td>
<td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};text-align:left;">${formatPrice(item.unitPrice * item.quantity)}</td>
</tr>`,
    )
    .join("\n");

  return wrapHtml(
    localized("طلب جديد", "New order", "ar"),
    `${headerRow()}
<tr>
<td style="padding:32px;">
  <h2 style="margin:0 0 8px;color:${BRAND.amberDark};font-size:20px;">
    ${escapeHtml(order.number)} — ${escapeHtml(order.name)}
  </h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px;">
    <tr>
      <td style="padding:8px 12px;background-color:${BRAND.amberLight};border-radius:4px;font-weight:600;">${escapeHtml(localized("البريد", "Email", "ar"))}</td>
      <td style="padding:8px 12px;text-align:left;">${escapeHtml(order.email)}</td>
    </tr>
    ${order.phone ? `<tr><td style="padding:8px 12px;font-weight:600;">${escapeHtml(localized("الهاتف", "Phone", "ar"))}</td><td style="padding:8px 12px;text-align:left;">${escapeHtml(order.phone)}</td></tr>` : ""}
    ${order.governorate ? `<tr><td style="padding:8px 12px;font-weight:600;">${escapeHtml(localized("المحافظة", "Governorate", "ar"))}</td><td style="padding:8px 12px;text-align:left;">${escapeHtml(order.governorate)}</td></tr>` : ""}
    ${order.city ? `<tr><td style="padding:8px 12px;font-weight:600;">${escapeHtml(localized("المدينة", "City", "ar"))}</td><td style="padding:8px 12px;text-align:left;">${escapeHtml(order.city)}</td></tr>` : ""}
    ${order.address ? `<tr><td style="padding:8px 12px;font-weight:600;">${escapeHtml(localized("العنوان", "Address", "ar"))}</td><td style="padding:8px 12px;text-align:left;">${escapeHtml(order.address)}</td></tr>` : ""}
  </table>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <thead>
      <tr style="border-bottom:2px solid ${BRAND.amber};">
        <th style="padding:8px 0;text-align:right;font-size:13px;color:${BRAND.muted};">${escapeHtml(localized("المنتج", "Product", "ar"))}</th>
        <th style="padding:8px 0;text-align:center;font-size:13px;color:${BRAND.muted};">${escapeHtml(localized("الكمية", "Qty", "ar"))}</th>
        <th style="padding:8px 0;text-align:left;font-size:13px;color:${BRAND.muted};">${escapeHtml(localized("السعر", "Price", "ar"))}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:12px 0;border-top:2px solid ${BRAND.amber};font-weight:700;font-size:17px;">${escapeHtml(localized("الإجمالي", "Total", "ar"))}</td>
      <td style="padding:12px 0;border-top:2px solid ${BRAND.amber};text-align:left;font-weight:700;font-size:17px;color:${BRAND.amberDark};">${formatPrice(order.total)}</td>
    </tr>
  </table>

  <p style="margin:24px 0 0;text-align:center;">
    <a href="${trackingUrl}" style="display:inline-block;background-color:${BRAND.amber};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;">
      ${escapeHtml(localized("فتح الطلب", "Open order", "ar"))}
    </a>
  </p>
</td>
</tr>`,
  );
}

function buildAdminNotificationText(
  order: {
    number: string;
    name: string;
    email: string;
    phone?: string | null;
    city?: string | null;
    governorate?: string | null;
    address?: string | null;
    total: number;
  },
  items: OrderConfirmationItem[],
  trackingUrl: string,
): string {
  const lines = [
    `${order.number} — ${order.name}`,
    "",
    `${localized("البريد", "Email", "ar")}: ${order.email}`,
  ];
  if (order.phone) lines.push(`${localized("الهاتف", "Phone", "ar")}: ${order.phone}`);
  if (order.governorate)
    lines.push(`${localized("المحافظة", "Governorate", "ar")}: ${order.governorate}`);
  if (order.city) lines.push(`${localized("المدينة", "City", "ar")}: ${order.city}`);
  if (order.address) lines.push(`${localized("العنوان", "Address", "ar")}: ${order.address}`);
  lines.push(
    "",
    localized("المنتجات:", "Products:", "ar"),
    ...items.map(
      (i) =>
        `  ${i.productName}${i.variantName ? ` (${i.variantName})` : ""} ×${i.quantity} — ${formatPrice(i.unitPrice * i.quantity)}`,
    ),
    "",
    `${localized("الإجمالي", "Total", "ar")}: ${formatPrice(order.total)}`,
    "",
    trackingUrl,
  );
  return lines.join("\n");
}

function buildPaymentInstructionsHtml(
  method: V1PaymentMethod | null,
  transferAccount: string | null,
  total: number,
): string {
  if (method === "instapay" || method === "wallet") {
    const label = localized(
      method === "instapay" ? "حساب إنستاباي" : "رقم محفظة فودافون كاش",
      method === "instapay" ? "InstaPay account" : "Vodafone Cash wallet",
      "ar",
    );
    const account = transferAccount
      ? `<tr>
      <td style="padding:8px 12px;font-weight:600;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;text-align:left;font-weight:700;">${escapeHtml(transferAccount)}</td>
    </tr>`
      : "";
    return `<div style="background-color:${BRAND.amberLight};border-radius:6px;padding:16px;margin-bottom:24px;">
  <h3 style="margin:0 0 12px;color:${BRAND.amberDark};font-size:16px;">
    ${escapeHtml(localized("تعليمات التحويل", "Transfer instructions", "ar"))}
  </h3>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:8px 12px;font-weight:600;">${escapeHtml(localized("المبلغ المطلوب", "Exact amount", "ar"))}</td>
      <td style="padding:8px 12px;text-align:left;font-weight:700;">${formatPrice(total)}</td>
    </tr>
    ${account}
  </table>
  <p style="margin:12px 0 0;color:${BRAND.muted};font-size:13px;">
    ${escapeHtml(
      localized(
        'حوّل المبلغ بالظبط، ثم اضغط "تم التحويل" من صفحة الطلب.',
        'Transfer the exact amount, then press "I transferred" on the order page.',
        "ar",
      ),
    )}
  </p>
</div>`;
  }
  if (method === "cod") {
    return `<div style="background-color:${BRAND.amberLight};border-radius:6px;padding:16px;margin-bottom:24px;">
  <h3 style="margin:0 0 12px;color:${BRAND.amberDark};font-size:16px;">
    ${escapeHtml(localized("الدفع عند الاستلام", "Cash on delivery", "ar"))}
  </h3>
  <p style="margin:0 0 8px;font-size:14px;">
    ${escapeHtml(localized("المبلغ المستحق عند الاستلام", "Amount due on delivery", "ar"))}:
    <strong>${formatPrice(total)}</strong>
  </p>
  <p style="margin:0;color:${BRAND.muted};font-size:13px;">
    ${escapeHtml(
      localized("هنكلمك لتأكيد الطلب.", "We will contact you to confirm the order.", "ar"),
    )}
  </p>
</div>`;
  }
  return "";
}

function buildOrderConfirmationHtml(
  order: {
    number: string;
    name: string;
    total: number;
    createdAt: number;
  },
  items: OrderConfirmationItem[],
  trackingUrl: string,
  method: V1PaymentMethod | null,
  transferAccount: string | null,
): string {
  const itemRows = items
    .map(
      (item) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">
  <span style="font-weight:600;">${escapeHtml(item.productName)}</span>
  ${item.variantName ? `<span style="color:${BRAND.muted};margin-right:8px;">(${escapeHtml(item.variantName)})</span>` : ""}
</td>
<td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};text-align:center;">×${item.quantity}</td>
<td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};text-align:left;">${formatPrice(item.unitPrice * item.quantity)}</td>
</tr>`,
    )
    .join("\n");

  return wrapHtml(
    localized(`تم استلام الطلب ${order.number}`, `Order ${order.number} received`, "ar"),
    `${headerRow()}
<tr>
<td style="padding:32px;">
  <h2 style="margin:0 0 8px;color:${BRAND.amberDark};font-size:20px;">
    ${escapeHtml(localized("شكراً لك!", "Thank you!", "ar"))} 🍯
  </h2>
  <p style="margin:0 0 24px;color:${BRAND.muted};font-size:15px;">
    ${escapeHtml(localized("تم استلام طلبك وجاري التجهيز.", "Your order has been received and is being prepared.", "ar"))}
  </p>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td style="padding:8px 12px;background-color:${BRAND.amberLight};border-radius:4px;font-weight:600;">
        ${escapeHtml(localized("رقم الطلب", "Order number", "ar"))}
      </td>
      <td style="padding:8px 12px;background-color:${BRAND.amberLight};border-radius:4px;text-align:left;">
        ${escapeHtml(order.number)}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 12px;font-weight:600;">
        ${escapeHtml(localized("العميل", "Customer", "ar"))}
      </td>
      <td style="padding:8px 12px;text-align:left;">
        ${escapeHtml(order.name)}
      </td>
    </tr>
  </table>

  <h3 style="margin:0 0 12px;color:${BRAND.text};font-size:16px;">
    ${escapeHtml(localized("المنتجات", "Products", "ar"))}
  </h3>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <thead>
      <tr style="border-bottom:2px solid ${BRAND.amber};">
        <th style="padding:8px 0;text-align:right;font-size:13px;color:${BRAND.muted};">${escapeHtml(localized("المنتج", "Product", "ar"))}</th>
        <th style="padding:8px 0;text-align:center;font-size:13px;color:${BRAND.muted};">${escapeHtml(localized("الكمية", "Qty", "ar"))}</th>
        <th style="padding:8px 0;text-align:left;font-size:13px;color:${BRAND.muted};">${escapeHtml(localized("السعر", "Price", "ar"))}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:12px 0;border-top:2px solid ${BRAND.amber};font-weight:700;font-size:17px;">
        ${escapeHtml(localized("الإجمالي", "Total", "ar"))}
      </td>
      <td style="padding:12px 0;border-top:2px solid ${BRAND.amber};text-align:left;font-weight:700;font-size:17px;color:${BRAND.amberDark};">
        ${formatPrice(order.total)}
      </td>
    </tr>
  </table>

  ${buildPaymentInstructionsHtml(method, transferAccount, order.total)}

  <p style="margin:24px 0 0;text-align:center;">
    <a href="${trackingUrl}" style="display:inline-block;background-color:${BRAND.amber};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;">
      ${escapeHtml(localized("تتبع الطلب", "Track your order", "ar"))}
    </a>
  </p>

  <p style="margin:16px 0 0;font-size:13px;color:${BRAND.muted};text-align:center;">
    ${escapeHtml(localized("سنراجع طلبك ونتواصل معك لتأكيد الطلب وطريقة الدفع.", "We will review your order and contact you to confirm it and the payment method.", "ar"))}
  </p>
</td>
</tr>`,
  );
}

function buildOrderConfirmationText(
  order: { number: string; name: string; total: number },
  items: OrderConfirmationItem[],
  trackingUrl: string,
  method: V1PaymentMethod | null,
  transferAccount: string | null,
): string {
  const lines = [
    localized("شكراً لك! تم استلام طلبك", "Thank you! Your order has been received", "ar"),
    "",
    `${localized("رقم الطلب", "Order", "ar")}: ${order.number}`,
    `${localized("العميل", "Customer", "ar")}: ${order.name}`,
    "",
    localized("المنتجات:", "Products:", "ar"),
    ...items.map(
      (item) =>
        `  ${item.productName}${item.variantName ? ` (${item.variantName})` : ""} ×${item.quantity} — ${formatPrice(item.unitPrice * item.quantity)}`,
    ),
    "",
    `${localized("الإجمالي", "Total", "ar")}: ${formatPrice(order.total)}`,
  ];

  if (method === "instapay" || method === "wallet") {
    lines.push("", localized("تعليمات التحويل", "Transfer instructions", "ar"));
    lines.push(`${localized("المبلغ المطلوب", "Exact amount", "ar")}: ${formatPrice(order.total)}`);
    if (transferAccount) {
      lines.push(
        `${localized(method === "instapay" ? "حساب إنستاباي" : "رقم المحفظة", method === "instapay" ? "InstaPay account" : "Wallet number", "ar")}: ${transferAccount}`,
      );
    }
    lines.push(
      localized(
        'حوّل المبلغ بالظبط، ثم اضغط "تم التحويل" من صفحة الطلب.',
        'Transfer the exact amount, then press "I transferred" on the order page.',
        "ar",
      ),
    );
  } else if (method === "cod") {
    lines.push(
      "",
      `${localized("المبلغ المستحق عند الاستلام", "Amount due on delivery", "ar")}: ${formatPrice(order.total)}`,
      localized("هنكلمك لتأكيد الطلب.", "We will contact you to confirm the order.", "ar"),
    );
  }

  lines.push("", `${localized("تتبع الطلب", "Track order", "ar")}: ${trackingUrl}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Order status-update email
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<OrderStatus, { ar: string; en: string }> = {
  pending_confirmation: { ar: "تم استلام الطلب ⏳", en: "Order received ⏳" },
  confirmed: { ar: "تم تأكيد الطلب ✓", en: "Order confirmed ✓" },
  processing: { ar: "جاري تجهيز الطلب", en: "Preparing your order" },
  shipped: { ar: "تم الشحن 📦", en: "Shipped 📦" },
  delivered: { ar: "تم التسليم ✅", en: "Delivered ✅" },
  cancelled: { ar: "تم الإلغاء ❌", en: "Cancelled ❌" },
};

type StatusUpdateKind = "status" | "expiry" | "expiry_payment";

export async function sendOrderStatusUpdate(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  newStatus: OrderStatus,
): Promise<void> {
  await enqueueStatusUpdate(db, orderId, newStatus, "status");
}

/**
 * Enqueue-only status update shared by the admin status action and the expiry
 * job; the email worker's drain delivers it.
 */
async function enqueueStatusUpdate(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  newStatus: OrderStatus,
  kind: StatusUpdateKind,
): Promise<void> {
  const row = await db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      email: schema.order.email,
      name: schema.order.name,
    })
    .from(schema.order)
    .where(eq(schema.order.id, orderId))
    .get();
  if (!row) {
    console.error("[email] status update skipped — order not found:", orderId);
    return;
  }

  const trackingUrl = trackingUrlFor(row.id);
  const statusLabel = STATUS_LABELS[newStatus];

  const subject = localized(
    `${row.number} — ${statusLabel.ar} | مملكة النحل`,
    `${row.number} — ${statusLabel.en} | Kingdom of Honey`,
    "ar",
  );

  const html = buildStatusUpdateHtml(row, newStatus, statusLabel, trackingUrl, kind);
  const text = buildStatusUpdateText(row, newStatus, statusLabel, trackingUrl, kind);

  await enqueueEmail(db, { recipient: row.email, subject, html, text }, "status_update");
}

/**
 * Extra paragraph for a hold-expiry cancellation, picked by the rule that
 * selected the order: rule 1 was never accepted, rule 2 was accepted but the
 * transfer never arrived. The plain status update has none.
 */
function statusUpdateNote(newStatus: OrderStatus, kind: StatusUpdateKind): string {
  if (newStatus !== "cancelled") return "";
  if (kind === "expiry") {
    return localized(
      "انتهت مهلة حجز الطلب قبل تأكيده، فتم إلغاؤه تلقائيًا. تقدر تعمل طلب جديد في أي وقت.",
      "The order hold expired before the shop accepted it, so the order was cancelled automatically. You can place a new order at any time.",
      "ar",
    );
  }
  if (kind === "expiry_payment") {
    return localized(
      "انتهت مهلة استلام التحويل ولم نتمكن من تأكيد وصول المبلغ، فتم إلغاء الطلب. لو كنت حوّلت المبلغ، تواصل معنا لمراجعته.",
      "The transfer window ended before we could confirm the funds, so the order was cancelled. If you already transferred the amount, contact us so we can review it.",
      "ar",
    );
  }
  return "";
}

function buildStatusUpdateHtml(
  order: { number: string; name: string },
  newStatus: OrderStatus,
  statusLabel: { ar: string; en: string },
  trackingUrl: string,
  kind: StatusUpdateKind,
): string {
  const message = localized(
    `تم تحديث حالة طلبك إلى:`,
    `Your order status has been updated to:`,
    "ar",
  );
  const note = statusUpdateNote(newStatus, kind);

  return wrapHtml(
    localized(`تحديث الطلب ${order.number}`, `Order ${order.number} update`, "ar"),
    `${headerRow()}
<tr>
<td style="padding:32px;text-align:center;">
  <h2 style="margin:0 0 8px;color:${BRAND.amberDark};font-size:20px;">
    ${escapeHtml(localized("تحديث حالة الطلب", "Order status update", "ar"))}
  </h2>
  <p style="margin:0 0 24px;color:${BRAND.muted};font-size:15px;">
    ${escapeHtml(message)}
  </p>

  <div style="display:inline-block;background-color:${BRAND.amberLight};border:2px solid ${BRAND.amber};border-radius:8px;padding:16px 32px;margin-bottom:24px;">
    <p style="margin:0;font-size:22px;font-weight:700;color:${BRAND.amberDark};">
      ${escapeHtml(statusLabel.ar)}
    </p>
    <p style="margin:4px 0 0;font-size:13px;color:${BRAND.muted};">
      ${escapeHtml(order.number)}
    </p>
  </div>

  <p style="margin:0 0 8px;color:${BRAND.text};">
    ${escapeHtml(localized("مرحباً", "Hello", "ar"))} ${escapeHtml(order.name)},
  </p>
  ${
    note
      ? `<p style="margin:0 0 24px;color:${BRAND.text};font-size:14px;background-color:${BRAND.amberLight};border-radius:6px;padding:12px;">
    ${escapeHtml(note)}
  </p>`
      : ""
  }
  <p style="margin:0 0 24px;color:${BRAND.muted};font-size:14px;">
    ${escapeHtml(
      localized(
        "يمكنك متابعة حالة طلبك من الرابط أدناه.",
        "You can track your order status using the link below.",
        "ar",
      ),
    )}
  </p>

  <p style="margin:0;">
    <a href="${trackingUrl}" style="display:inline-block;background-color:${BRAND.amber};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;">
      ${escapeHtml(localized("تتبع الطلب", "Track your order", "ar"))}
    </a>
  </p>
</td>
</tr>`,
  );
}

function buildStatusUpdateText(
  order: { number: string; name: string },
  newStatus: OrderStatus,
  statusLabel: { ar: string; en: string },
  trackingUrl: string,
  kind: StatusUpdateKind,
): string {
  const lines = [
    localized("تحديث حالة الطلب", "Order status update", "ar"),
    "",
    `${order.number} — ${statusLabel.ar}`,
    "",
    `${localized("مرحباً", "Hello", "ar")} ${order.name},`,
    localized(
      "يمكنك متابعة حالة طلبك من الرابط أدناه.",
      "You can track your order status using the link below.",
      "ar",
    ),
  ];
  const note = statusUpdateNote(newStatus, kind);
  if (note) lines.push("", note);
  lines.push("", trackingUrl);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Settlement notification emails (manual settlement spec §3.7)
// ---------------------------------------------------------------------------

interface SettlementOrder {
  id: string;
  number: string;
  email: string;
  name: string;
  total: number;
}

async function loadSettlementOrder(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
): Promise<SettlementOrder | null> {
  const row = await db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      email: schema.order.email,
      name: schema.order.name,
      total: schema.order.total,
    })
    .from(schema.order)
    .where(eq(schema.order.id, orderId))
    .get();
  if (!row) {
    console.error("[email] settlement notification skipped — order not found:", orderId);
    return null;
  }
  return row;
}

function settlementOrderSummaryHtml(order: SettlementOrder, amountLabel: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
  <tr>
    <td style="padding:8px 12px;background-color:${BRAND.amberLight};border-radius:4px;font-weight:600;">${escapeHtml(localized("رقم الطلب", "Order number", "ar"))}</td>
    <td style="padding:8px 12px;background-color:${BRAND.amberLight};border-radius:4px;text-align:left;">${escapeHtml(order.number)}</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600;">${escapeHtml(amountLabel)}</td>
    <td style="padding:8px 12px;text-align:left;font-weight:700;">${formatPrice(order.total)}</td>
  </tr>
</table>`;
}

function settlementOrderSummaryText(order: SettlementOrder, amountLabel: string): string {
  return `${localized("رقم الطلب", "Order", "ar")}: ${order.number}\n${amountLabel}: ${formatPrice(order.total)}`;
}

function settlementEmailBodyHtml(
  heading: string,
  intro: string,
  detailHtml: string,
  trackingUrl: string,
  buttonLabel: string,
): string {
  return wrapHtml(
    heading,
    `${headerRow()}
<tr>
<td style="padding:32px;">
  <h2 style="margin:0 0 8px;color:${BRAND.amberDark};font-size:20px;">${escapeHtml(heading)}</h2>
  <p style="margin:0 0 24px;color:${BRAND.muted};font-size:15px;">${escapeHtml(intro)}</p>
  ${detailHtml}
  <p style="margin:24px 0 0;text-align:center;">
    <a href="${trackingUrl}" style="display:inline-block;background-color:${BRAND.amber};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;">
      ${escapeHtml(buttonLabel)}
    </a>
  </p>
</td>
</tr>`,
  );
}

/** Customer acknowledgement that a claim was recorded; no promise of payment. */
export async function sendPaymentClaimed(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
): Promise<void> {
  const order = await loadSettlementOrder(db, orderId);
  if (!order) return;

  const trackingUrl = trackingUrlFor(order.id);
  const heading = localized("تم استلام إشعار التحويل", "Transfer notice received", "ar");
  const subject = localized(
    `${order.number} — تم استلام إشعار التحويل | مملكة النحل`,
    `${order.number} — Transfer notice received | Kingdom of Honey`,
    "ar",
  );
  const intro = localized(
    "سجّلنا إشعارك بالتحويل، وهيتم مراجعته وتأكيد الدفع بعد مطابقة المبلغ.",
    "We recorded your transfer notice. We will review it and confirm the payment after matching the amount.",
    "ar",
  );
  const detailHtml = settlementOrderSummaryHtml(
    order,
    localized("المبلغ المُعلن", "Claimed amount", "ar"),
  );
  const detailText = settlementOrderSummaryText(
    order,
    localized("المبلغ المُعلن", "Claimed amount", "ar"),
  );

  await enqueueEmail(
    db,
    {
      recipient: order.email,
      subject,
      html: settlementEmailBodyHtml(
        heading,
        intro,
        detailHtml,
        trackingUrl,
        localized("متابعة الطلب", "View order", "ar"),
      ),
      text: `${heading}\n\n${intro}\n\n${detailText}\n\n${trackingUrl}`,
    },
    "payment_claimed",
  );

  const recipients = adminRecipients();
  if (recipients.length > 0) {
    const adminSubject = localized(
      `مراجعة تحويل ${order.number} — ${order.name}`,
      `Transfer review ${order.number} — ${order.name}`,
      "ar",
    );
    const adminIntro = localized(
      "العميل أكّد إنه حوّل المبلغ. راجع الحساب ووافق أو ارفض من لوحة الطلب.",
      "The customer says the transfer was sent. Check the receiving account and approve or reject from the order panel.",
      "ar",
    );
    const adminUrl = `${origin()}/admin/orders/${order.id}`;
    const adminHtml = settlementEmailBodyHtml(
      localized("طلب مراجعة تحويل", "Transfer review needed", "ar"),
      adminIntro,
      settlementOrderSummaryHtml(order, localized("المبلغ المُعلن", "Claimed amount", "ar")),
      adminUrl,
      localized("فتح الطلب", "Open order", "ar"),
    );
    const adminText = `${localized("طلب مراجعة تحويل", "Transfer review needed", "ar")}\n\n${adminIntro}\n\n${settlementOrderSummaryText(order, localized("المبلغ المُعلن", "Claimed amount", "ar"))}\n\n${adminUrl}`;

    for (const recipient of recipients) {
      await enqueueEmail(
        db,
        { recipient, subject: adminSubject, html: adminHtml, text: adminText },
        "payment_claimed",
      );
    }
  }
}

/** Confirms a verified payment; only sent after the admin marks the order paid. */
export async function sendPaymentConfirmed(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
): Promise<void> {
  const order = await loadSettlementOrder(db, orderId);
  if (!order) return;

  const trackingUrl = trackingUrlFor(order.id);
  const heading = localized("تم تأكيد الدفع", "Payment confirmed", "ar");
  const subject = localized(
    `${order.number} — تم تأكيد الدفع | مملكة النحل`,
    `${order.number} — Payment confirmed | Kingdom of Honey`,
    "ar",
  );
  const intro = localized(
    "تأكد الدفع بعد المراجعة، وطلبك ماشي في التنفيذ.",
    "The payment is verified after review, and your order is moving forward.",
    "ar",
  );
  const detailHtml = settlementOrderSummaryHtml(
    order,
    localized("المبلغ المدفوع", "Paid amount", "ar"),
  );
  const detailText = settlementOrderSummaryText(
    order,
    localized("المبلغ المدفوع", "Paid amount", "ar"),
  );

  await enqueueEmail(
    db,
    {
      recipient: order.email,
      subject,
      html: settlementEmailBodyHtml(
        heading,
        intro,
        detailHtml,
        trackingUrl,
        localized("متابعة الطلب", "View order", "ar"),
      ),
      text: `${heading}\n\n${intro}\n\n${detailText}\n\n${trackingUrl}`,
    },
    "payment_confirmed",
  );
}

/** Customer notice that a claim was rejected; the order page carries the retry path. */
export async function sendPaymentFailed(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
): Promise<void> {
  const order = await loadSettlementOrder(db, orderId);
  if (!order) return;

  const trackingUrl = trackingUrlFor(order.id);
  const heading = localized("لم نتمكن من تأكيد التحويل", "Transfer could not be confirmed", "ar");
  const subject = localized(
    `${order.number} — لم نتمكن من تأكيد التحويل | مملكة النحل`,
    `${order.number} — Transfer could not be confirmed | Kingdom of Honey`,
    "ar",
  );
  const intro = localized(
    "راجعنا التحويل ولم نطابقه. تقدر تسجّل تحويل صحيح من صفحة الطلب، أو تتواصل معنا على واتساب.",
    "We reviewed the transfer and could not match it. You can submit a corrected claim from the order page, or contact us on WhatsApp.",
    "ar",
  );
  const detailHtml = settlementOrderSummaryHtml(
    order,
    localized("المبلغ المُعلن", "Claimed amount", "ar"),
  );
  const detailText = settlementOrderSummaryText(
    order,
    localized("المبلغ المُعلن", "Claimed amount", "ar"),
  );

  await enqueueEmail(
    db,
    {
      recipient: order.email,
      subject,
      html: settlementEmailBodyHtml(
        heading,
        intro,
        detailHtml,
        trackingUrl,
        localized("إعادة المحاولة", "Try again", "ar"),
      ),
      text: `${heading}\n\n${intro}\n\n${detailText}\n\n${trackingUrl}`,
    },
    "payment_failed",
  );
}

/**
 * Records a refund decision. The money itself moves outside the system: the
 * copy states the recording and the shop's manual return, never a payout the
 * system performs.
 */
export async function sendRefund(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  reference: string,
): Promise<void> {
  const order = await loadSettlementOrder(db, orderId);
  if (!order) return;

  const trackingUrl = trackingUrlFor(order.id);
  const heading = localized("تم تسجيل استرداد المبلغ", "Refund recorded", "ar");
  const subject = localized(
    `${order.number} — تم تسجيل استرداد المبلغ | مملكة النحل`,
    `${order.number} — Refund recorded | Kingdom of Honey`,
    "ar",
  );
  const intro = localized(
    "سجّلنا استرداد كامل المبلغ. المتجر بيرجّع المبلغ يدويًا على نفس وسيلة الدفع الأصلية.",
    "We recorded a full refund. The shop returns the money manually through the original payment method.",
    "ar",
  );
  const detailHtml = `${settlementOrderSummaryHtml(order, localized("المبلغ المسترد", "Refunded amount", "ar"))}
  <p style="margin:0;font-size:14px;">${escapeHtml(localized("رقم مرجع الاسترداد", "Refund reference", "ar"))}: <strong>${escapeHtml(reference)}</strong></p>`;
  const detailText = `${settlementOrderSummaryText(order, localized("المبلغ المسترد", "Refunded amount", "ar"))}\n${localized("رقم مرجع الاسترداد", "Refund reference", "ar")}: ${reference}`;

  await enqueueEmail(
    db,
    {
      recipient: order.email,
      subject,
      html: settlementEmailBodyHtml(
        heading,
        intro,
        detailHtml,
        trackingUrl,
        localized("متابعة الطلب", "View order", "ar"),
      ),
      text: `${heading}\n\n${intro}\n\n${detailText}\n\n${trackingUrl}`,
    },
    "refund",
  );
}

/**
 * Cancellation notice for an expired stock hold. Enqueue-only: the settlement
 * job runs inside the email worker, whose drain delivers pending rows on the
 * same tick. The pre-cancel status selects the rule-specific copy.
 */
export async function sendHoldExpired(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  previousStatus: ReleasedHoldStatus,
): Promise<void> {
  await enqueueStatusUpdate(
    db,
    orderId,
    "cancelled",
    previousStatus === "pending_confirmation" ? "expiry" : "expiry_payment",
  );
}
