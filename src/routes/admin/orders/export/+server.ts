import { error } from "@sveltejs/kit";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { parseOrderStatus } from "$lib/server/admin/orders";
import { storedOrderStatusValues } from "$lib/server/settlement/lifecycle";
import { isAdminRole } from "$lib/server/admin/roles";
import { logAdminAction } from "$lib/server/admin/audit";
import { csvCell } from "$lib/server/csv";
import { t } from "$lib/i18n/messages";
import {
  ADMIN_PAYMENT_METHOD_LABEL_KEY,
  ADMIN_PAYMENT_STATUS_LABEL_KEY,
  parsePaymentMethod,
  parsePaymentStatus,
  type OrderStatus,
} from "$lib/settlement/types";

const CAIRO_TZ = "Africa/Cairo";

function cairoDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: CAIRO_TZ });
}

function cairoDateTime(ms: number): string {
  return new Date(ms).toLocaleString("ar-EG", {
    timeZone: CAIRO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const GET: RequestHandler = async (event) => {
  if (!isAdminRole(event.locals.user?.role)) error(403, "Forbidden");

  const url = new URL(event.url);
  const statusParam = url.searchParams.get("status");
  const statusFilter = statusParam ? parseOrderStatus(statusParam) : null;
  if (statusParam && !statusFilter) error(400, "Invalid status");
  const paymentParam = url.searchParams.get("payment");
  const paymentFilter = paymentParam ? parsePaymentStatus(paymentParam) : null;
  if (paymentParam && !paymentFilter) error(400, "Invalid payment");

  const conditions: SQL[] = [];
  if (statusFilter)
    conditions.push(inArray(schema.order.status, storedOrderStatusValues(statusFilter)));
  if (paymentFilter) conditions.push(eq(schema.order.paymentStatus, paymentFilter));
  const where = conditions.length ? and(...conditions) : undefined;

  // Fetch all matching orders (admin volume — small table)
  const orders = await db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      createdAt: schema.order.createdAt,
      name: schema.order.name,
      email: schema.order.email,
      phone: schema.order.phone,
      city: schema.order.city,
      status: schema.order.status,
      paymentMethod: schema.order.paymentMethod,
      paymentStatus: schema.order.paymentStatus,
      total: schema.order.total,
    })
    .from(schema.order)
    .where(where)
    .orderBy(desc(schema.order.createdAt));

  // Count items per order
  const itemCountRows = await db
    .select({
      orderId: schema.orderItem.orderId,
      count: sql<number>`count(*)`,
    })
    .from(schema.orderItem)
    .groupBy(schema.orderItem.orderId);

  const itemCounts = new Map(itemCountRows.map((r) => [r.orderId, Number(r.count)]));

  // Read-side audit (T7): exports leave the system with order PII, so the
  // actor and the filter are recorded. Best-effort like every audit write.
  logAdminAction(db, {
    action: "order.export",
    targetType: "order",
    targetId: statusFilter ?? "all",
    details: {
      status: statusFilter ?? "all",
      payment: paymentFilter ?? "all",
      count: orders.length,
    },
    userId: event.locals.user?.id,
  });

  // BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const header = [
    "رقم الطلب",
    "التاريخ",
    "اسم العميل",
    "البريد الإلكتروني",
    "الهاتف",
    "المدينة",
    "الحالة",
    "طريقة الدفع",
    "حالة الدفع",
    "الإجمالي (ج.م)",
    "عدد المنتجات",
  ];

  const statusLabels: Record<OrderStatus, string> = {
    pending_confirmation: "جديد",
    confirmed: "مؤكد",
    processing: "قيد التجهيز",
    shipped: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };

  const rows = orders.map((order) => {
    const status = parseOrderStatus(order.status);
    const method = parsePaymentMethod(order.paymentMethod);
    const paymentStatus = parsePaymentStatus(order.paymentStatus);
    return [
      order.number,
      cairoDateTime(order.createdAt),
      order.name,
      order.email,
      order.phone,
      order.city,
      status ? statusLabels[status] : order.status,
      method ? t("ar", ADMIN_PAYMENT_METHOD_LABEL_KEY[method]) : order.paymentMethod,
      paymentStatus ? t("ar", ADMIN_PAYMENT_STATUS_LABEL_KEY[paymentStatus]) : order.paymentStatus,
      String(order.total / 100),
      String(itemCounts.get(order.id) ?? 0),
    ];
  });

  const csv = BOM + [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");

  const today = cairoDate(Date.now());
  const filename = `orders-${today}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
