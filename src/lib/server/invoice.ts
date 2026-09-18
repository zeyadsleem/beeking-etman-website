import { formatEGP } from "$lib/currency";
import { parseOrderStatus } from "$lib/settlement/types";

interface InvoiceOrder {
  number: string;
  createdAt: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  total: number;
  shippingCost: number;
  status: string;
}

interface InvoiceItem {
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
}

function cairoDateTime(ms: number): string {
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: "Africa/Cairo",
    dateStyle: "long",
    timeStyle: "short",
  }).format(ms);
}

function statusLabel(status: string): string {
  switch (parseOrderStatus(status)) {
    case "pending_confirmation":
      return "جديد";
    case "confirmed":
      return "مؤكد";
    case "processing":
      return "قيد التجهيز";
    case "shipped":
      return "تم الشحن";
    case "delivered":
      return "تم التسليم";
    case "cancelled":
      return "ملغي";
    default:
      return status;
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateInvoiceHtml(order: InvoiceOrder, items: InvoiceItem[]): string {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shipping = order.shippingCost;
  const shippingLabel = shipping === 0 ? "مجاني ✓" : formatEGP(shipping);

  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e0d8;font-weight:500">${escHtml(item.productName)}${item.variantName ? `<br><span style="font-size:12px;color:#888">${escHtml(item.variantName)}</span>` : ""}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e0d8;text-align:center">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e0d8;text-align:end">${formatEGP(item.unitPrice)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e0d8;text-align:end;font-weight:600">${formatEGP(item.unitPrice * item.quantity)}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة ${escHtml(order.number)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #faf8f5; color: #2c2417; padding: 32px; }
    .invoice { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e0d8; }
    .brand h1 { font-size: 28px; font-weight: 800; color: #2c2417; }
    .brand p { font-size: 14px; color: #888; margin-top: 4px; }
    .logo-placeholder { width: 64px; height: 64px; border-radius: 12px; background: #f0ebe3; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #c9a84c; }
    .meta { text-align: start; }
    .meta h2 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .meta p { font-size: 13px; color: #666; line-height: 1.6; }
    .customer { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; padding: 20px; background: #faf8f5; border-radius: 12px; }
    .customer dt { font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; margin-bottom: 2px; }
    .customer dd { font-size: 14px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { padding: 10px 12px; background: #faf8f5; font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; text-align: start; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: end; }
    .totals { margin-left: auto; max-width: 300px; }
    .totals tr td { padding: 8px 12px; font-size: 14px; }
    .totals tr td:last-child { text-align: end; font-weight: 600; }
    .totals .grand { border-top: 2px solid #2c2417; font-size: 18px; font-weight: 800; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .status-pending_confirmation { background: #fff8e1; color: #8a6d1d; }
    .status-confirmed { background: #d4edda; color: #155724; }
    .status-processing { background: #fde8c8; color: #8a5200; }
    .status-shipped { background: #cce5ff; color: #004085; }
    .status-delivered { background: #e8f5e9; color: #2e7d32; }
    .status-cancelled { background: #f8d7da; color: #721c24; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e0d8; text-align: center; font-size: 13px; color: #999; }
    @media print {
      body { padding: 0; background: #fff; }
      .invoice { box-shadow: none; border-radius: 0; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="brand">
        <h1>مملكة النحل</h1>
        <p>Beeking Etman</p>
      </div>
      <div class="logo-placeholder">🍯</div>
    </div>

    <div class="header" style="border-bottom:none;padding-bottom:0;margin-bottom:24px">
      <div class="meta">
        <h2>فاتورة</h2>
        <p>
          رقم الفاتورة: <strong>${escHtml(order.number)}</strong><br>
          التاريخ: ${cairoDateTime(order.createdAt)}<br>
          الحالة: <span class="status-badge status-${parseOrderStatus(order.status) ?? "pending_confirmation"}">${statusLabel(order.status)}</span>
        </p>
      </div>
    </div>

    <dl class="customer">
      <div>
        <dt>الاسم</dt>
        <dd>${escHtml(order.name)}</dd>
      </div>
      <div>
        <dt>البريد الإلكتروني</dt>
        <dd>${escHtml(order.email)}</dd>
      </div>
      <div>
        <dt>الهاتف</dt>
        <dd>${escHtml(order.phone)}</dd>
      </div>
      <div>
        <dt>العنوان</dt>
        <dd>${escHtml(order.address)}، ${escHtml(order.city)}</dd>
      </div>
    </dl>

    <table>
      <thead>
        <tr>
          <th>المنتج</th>
          <th>الكمية</th>
          <th>سعر الوحدة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <table class="totals">
      <tr>
        <td>المجموع الفرعي</td>
        <td>${formatEGP(subtotal)}</td>
      </tr>
      <tr>
        <td>الشحن</td>
        <td>${shippingLabel}</td>
      </tr>
      <tr class="grand">
        <td>الإجمالي</td>
        <td>${formatEGP(order.total)}</td>
      </tr>
    </table>

    <div class="footer">
      شكراً لاختيارك منتجات BEKING 🍯
    </div>
  </div>
</body>
</html>`;
}
