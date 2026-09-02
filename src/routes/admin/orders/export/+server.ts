import { error } from "@sveltejs/kit";
import { desc, eq, sql } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { parseOrderStatus } from "$lib/server/admin/orders";
import { isAdminRole } from "$lib/server/admin/roles";

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

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET: RequestHandler = async (event) => {
  if (!isAdminRole(event.locals.user?.role)) error(403, "Forbidden");

  const url = new URL(event.url);
  const statusParam = url.searchParams.get("status");
  const statusFilter = statusParam ? parseOrderStatus(statusParam) : null;
  if (statusParam && !statusFilter) error(400, "Invalid status");

  const where = statusFilter ? eq(schema.order.status, statusFilter) : undefined;

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
    "الإجمالي (ج.م)",
    "عدد المنتجات",
  ];

  const statusLabels: Record<string, string> = {
    paid: "مدفوع",
    shipped: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };

  const rows = orders.map((order) => [
    order.number,
    cairoDateTime(order.createdAt),
    order.name,
    order.email,
    order.phone,
    order.city,
    statusLabels[order.status] ?? order.status,
    String(order.total / 100),
    String(itemCounts.get(order.id) ?? 0),
  ]);

  const csv = BOM + [header.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\r\n");

  const today = cairoDate(Date.now());
  const filename = `orders-${today}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
