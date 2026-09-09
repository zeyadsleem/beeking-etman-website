/**
 * Transactional email sending via Cloudflare Email Service.
 *
 * Every public function is best-effort: when the EMAIL binding is absent
 * (local dev without `remote: true`, or env not configured) the calls are
 * no-ops with a console warning. Callers should wrap invocations in
 * try-catch so a transient failure never blocks an order or status change.
 */

import { eq } from "drizzle-orm";
import { or, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { env } from "$env/dynamic/private";
import * as schema from "$lib/server/db/schema";
import type { OrderStatus } from "$lib/server/admin/orders";
import { localized } from "$lib/i18n/messages";

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
 * Persist an email in the durable outbox (`store_notification`) as a
 * `pending` row so a transient failure never loses the message. Drain with
 * `flushOutbox`. The body stores a JSON payload `{html,text}`.
 */
export async function enqueueEmail(
  db: LibSQLDatabase<typeof schema>,
  email: OutboxEmail,
  type = "order",
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

function formatPrice(price: number): string {
  return `${price.toLocaleString("ar-EG")} ج.م`;
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
  platform: Readonly<App.Platform> | undefined,
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

  const origin = env.ORIGIN || "https://beeking-etman-website.pages.dev";
  const trackingUrl = `${origin}/checkout/success/${row.id}`;
  const subject = localized(
    `تأكيد الطلب ${row.number} — مملكة النحل`,
    `Order ${row.number} confirmed — Kingdom of Honey`,
    "ar",
  );

  const html = buildOrderConfirmationHtml(row, items, trackingUrl);
  const text = buildOrderConfirmationText(row, items, trackingUrl);

  await enqueueEmail(db, { recipient: row.email, subject, html, text });

  await enqueueAdminNotification(db, row, items, trackingUrl);

  await flushOutbox(platform, db);
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
  const recipients = (env.ADMIN_NOTIFY_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (recipients.length === 0) return;

  const subject = localized(
    `طلب جديد ${order.number} — ${order.name}`,
    `New order ${order.number} — ${order.name}`,
    "ar",
  );
  const html = buildAdminNotificationHtml(order, items, trackingUrl);
  const text = buildAdminNotificationText(order, items, trackingUrl);

  for (const recipient of recipients) {
    await enqueueEmail(db, { recipient, subject, html, text }, "admin");
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

function buildOrderConfirmationHtml(
  order: {
    number: string;
    name: string;
    total: number;
    createdAt: number;
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
    localized(`تأكيد الطلب ${order.number}`, `Order ${order.number} confirmed`, "ar"),
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

  <p style="margin:24px 0 0;text-align:center;">
    <a href="${trackingUrl}" style="display:inline-block;background-color:${BRAND.amber};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;">
      ${escapeHtml(localized("تتبع الطلب", "Track your order", "ar"))}
    </a>
  </p>

  <p style="margin:16px 0 0;font-size:13px;color:${BRAND.muted};text-align:center;">
    ${escapeHtml(localized("الدفع تمت محاكاته — لا يوجد أي خصم فعلي على بطاقتك.", "Payment was simulated — no real charge on your card.", "ar"))}
  </p>
</td>
</tr>`,
  );
}

function buildOrderConfirmationText(
  order: { number: string; name: string; total: number },
  items: OrderConfirmationItem[],
  trackingUrl: string,
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
    "",
    `${localized("تتبع الطلب", "Track order", "ar")}: ${trackingUrl}`,
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Order status-update email
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<OrderStatus, { ar: string; en: string }> = {
  placed: { ar: "تم الطلب ✓", en: "Placed ✓" },
  shipped: { ar: "تم الشحن 📦", en: "Shipped 📦" },
  delivered: { ar: "تم التسليم ✅", en: "Delivered ✅" },
  cancelled: { ar: "تم الإلغاء ❌", en: "Cancelled ❌" },
};

export async function sendOrderStatusUpdate(
  platform: Readonly<App.Platform> | undefined,
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  newStatus: OrderStatus,
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

  const origin = env.ORIGIN || "https://beeking-etman-website.pages.dev";
  const trackingUrl = `${origin}/checkout/success/${row.id}`;
  const statusLabel = STATUS_LABELS[newStatus];

  const subject = localized(
    `${row.number} — ${statusLabel.ar} | مملكة النحل`,
    `${row.number} — ${statusLabel.en} | Kingdom of Honey`,
    "ar",
  );

  const html = buildStatusUpdateHtml(row, newStatus, statusLabel, trackingUrl);
  const text = buildStatusUpdateText(row, newStatus, statusLabel, trackingUrl);

  await enqueueEmail(db, { recipient: row.email, subject, html, text });
  await flushOutbox(platform, db);
}

function buildStatusUpdateHtml(
  order: { number: string; name: string },
  newStatus: OrderStatus,
  statusLabel: { ar: string; en: string },
  trackingUrl: string,
): string {
  const message = localized(
    `تم تحديث حالة طلبك إلى:`,
    `Your order status has been updated to:`,
    "ar",
  );

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
): string {
  return [
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
    "",
    trackingUrl,
  ].join("\n");
}
