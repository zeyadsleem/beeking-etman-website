import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import {
  allowedTransitions,
  ORDER_STATUSES,
  parseOrderStatus,
  type OrderStatus,
} from "$lib/settlement/types";
import {
  applyOrderTransition,
  canTransitionOrder,
  storedOrderStatusValues,
} from "$lib/server/settlement/lifecycle";
import { affectedRowCount, retryOnBusy } from "$lib/server/sqlite";

export { allowedTransitions, ORDER_STATUSES, parseOrderStatus };
export type { OrderStatus };

export interface AdminOrderRow {
  id: string;
  number: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  total: number;
  status: OrderStatus;
  createdAt: number;
}

export interface AdminOrderItemRow {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
}

export const ORDERS_PAGE_SIZE = 20;

function toOrderStatus(raw: string): OrderStatus {
  const parsed = parseOrderStatus(raw);
  if (!parsed) {
    console.error(`[admin/orders] unknown order status stored in database: "${raw}"`);
    throw new Error(`[admin/orders] unknown order status stored in database: "${raw}"`);
  }
  return parsed;
}

const orderColumns = {
  id: schema.order.id,
  number: schema.order.number,
  email: schema.order.email,
  name: schema.order.name,
  phone: schema.order.phone,
  address: schema.order.address,
  city: schema.order.city,
  total: schema.order.total,
  status: schema.order.status,
  createdAt: schema.order.createdAt,
} as const;

function toAdminOrderRow(row: {
  id: string;
  number: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  total: number;
  status: string;
  createdAt: number;
}): AdminOrderRow {
  return { ...row, status: toOrderStatus(row.status) };
}

export async function listOrders(
  db: LibSQLDatabase<typeof schema>,
  opts?: { status?: OrderStatus; page?: number; query?: string },
): Promise<{ items: AdminOrderRow[]; total: number }> {
  const page = Math.max(1, Math.trunc(opts?.page ?? 1));
  const conditions: SQL[] = [];
  if (opts?.status) {
    conditions.push(inArray(schema.order.status, storedOrderStatusValues(opts.status)));
  }
  const needle = opts?.query?.trim() ?? "";
  if (needle !== "") {
    const pattern = `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push(
      or(
        sql`${schema.order.number} LIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.order.email} LIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.order.name} LIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.order.phone} LIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select(orderColumns)
    .from(schema.order)
    .where(where)
    .orderBy(desc(schema.order.createdAt), desc(schema.order.id))
    .limit(ORDERS_PAGE_SIZE)
    .offset((page - 1) * ORDERS_PAGE_SIZE);

  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.order)
    .where(where);

  return {
    items: rows.map(toAdminOrderRow),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export async function getOrderWithItems(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<{ order: AdminOrderRow & { shippingCost: number }; items: AdminOrderItemRow[] } | null> {
  const row = await db
    .select({ ...orderColumns, shippingCost: schema.order.shippingCost })
    .from(schema.order)
    .where(eq(schema.order.id, id))
    .get();
  if (!row) return null;

  const items = await db
    .select({
      id: schema.orderItem.id,
      productId: schema.orderItem.productId,
      productName: schema.orderItem.productName,
      variantName: schema.orderItem.variantName,
      quantity: schema.orderItem.quantity,
      unitPrice: schema.orderItem.unitPrice,
    })
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, id));

  return { order: { ...toAdminOrderRow(row), shippingCost: row.shippingCost }, items };
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "invalid_transition" | "inventory_reconciliation_required" };

async function cancelLegacyOrder(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  currentStatus: string,
): Promise<TransitionResult> {
  const items = await db
    .select({ variantId: schema.orderItem.variantId })
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, orderId));

  if (items.some((item) => item.variantId === null)) {
    return { ok: false, reason: "inventory_reconciliation_required" };
  }

  const statusUpdate = db
    .update(schema.order)
    .set({ status: "cancelled" })
    .where(and(eq(schema.order.id, orderId), eq(schema.order.status, currentStatus)));

  const hasVariantItems = items.some((i) => i.variantId !== null);
  const restockSql = hasVariantItems
    ? db.run(sql`
        UPDATE store_product_variant
        SET stock = stock + COALESCE((
          SELECT SUM(quantity)
          FROM store_order_item
          WHERE order_id = ${orderId} AND variant_id = store_product_variant.id
        ), 0)
        WHERE id IN (SELECT variant_id FROM store_order_item WHERE order_id = ${orderId} AND variant_id IS NOT NULL)
          AND (SELECT changes()) = 1
      `)
    : db.run(sql`SELECT 1`);

  const [flip] = await retryOnBusy(() => db.batch([statusUpdate, restockSql]));
  if (affectedRowCount(flip) !== 1) {
    return { ok: false, reason: "invalid_transition" };
  }
  return { ok: true };
}

export async function transitionOrderStatus(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  next: OrderStatus,
): Promise<TransitionResult> {
  const current = await db
    .select({
      id: schema.order.id,
      status: schema.order.status,
      stockVersion: schema.order.stockVersion,
    })
    .from(schema.order)
    .where(eq(schema.order.id, orderId))
    .get();
  if (!current) return { ok: false, reason: "not_found" };

  const from = parseOrderStatus(current.status);
  if (!from || !canTransitionOrder(from, next)) {
    return { ok: false, reason: "invalid_transition" };
  }

  if (next === "cancelled" && current.stockVersion === "legacy") {
    return cancelLegacyOrder(db, orderId, current.status);
  }

  return retryOnBusy(() => applyOrderTransition(db, { orderId, from: [from], to: next }));
}
