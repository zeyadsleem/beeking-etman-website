import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { affectedRowCount } from "$lib/server/orders";
import { retryOnBusy } from "$lib/server/sqlite";

export const ORDER_STATUSES = ["paid", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Forward-only lifecycle: paid → shipped → delivered; cancelling is allowed
// from any non-terminal state. `delivered` and `cancelled` are terminal.
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  paid: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const STATUS_SET: ReadonlySet<string> = new Set(ORDER_STATUSES);

export function parseOrderStatus(value: string): OrderStatus | null {
  return STATUS_SET.has(value) ? (value as OrderStatus) : null;
}

export function allowedTransitions(status: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[status];
}

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

// The status column is plain TEXT; anything outside the lifecycle means
// out-of-band writes corrupted it, so fail loudly instead of guessing.
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
    conditions.push(eq(schema.order.status, opts.status));
  }
  // Same LIKE-escaping contract as the products/categories/audit filters:
  // user-supplied % _ \ are matched literally.
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

  // Secondary id ordering keeps pagination deterministic when createdAt ties.
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
): Promise<{ order: AdminOrderRow; items: AdminOrderItemRow[] } | null> {
  const row = await db.select(orderColumns).from(schema.order).where(eq(schema.order.id, id)).get();
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

  return { order: toAdminOrderRow(row), items };
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "invalid_transition" };

interface RestockEntry {
  variantId: string;
  quantity: number;
}

// order_item rows carry productId + variantName but no variant id, so each
// item resolves its variant through the unique index
// store_product_variant(product_id, name). Items whose variant no longer
// matches are skipped with a warning rather than failing the cancellation.
async function resolveRestockPlan(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
): Promise<RestockEntry[]> {
  const items = await db
    .select({
      productId: schema.orderItem.productId,
      variantName: schema.orderItem.variantName,
      quantity: schema.orderItem.quantity,
    })
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, orderId))
    .all();
  if (items.length === 0) return [];

  const variants = await db
    .select({
      id: schema.productVariant.id,
      productId: schema.productVariant.productId,
      name: schema.productVariant.name,
    })
    .from(schema.productVariant)
    .where(
      inArray(schema.productVariant.productId, [...new Set(items.map((item) => item.productId))]),
    )
    .all();

  const variantIdByKey = new Map(
    variants.map((variant) => [`${variant.productId}::${variant.name}`, variant.id] as const),
  );

  const plan: RestockEntry[] = [];
  for (const item of items) {
    const variantId = variantIdByKey.get(`${item.productId}::${item.variantName}`);
    if (!variantId) {
      console.warn("[transitionOrderStatus] restock skipped", {
        productId: item.productId,
        variantName: item.variantName,
      });
      continue;
    }
    plan.push({ variantId, quantity: item.quantity });
  }
  return plan;
}
function restockStatement(db: LibSQLDatabase<typeof schema>, entry: RestockEntry) {
  return db
    .update(schema.productVariant)
    .set({ stock: sql`${schema.productVariant.stock} + ${entry.quantity}` })
    .where(eq(schema.productVariant.id, entry.variantId));
}

export async function transitionOrderStatus(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  next: OrderStatus,
): Promise<TransitionResult> {
  const current = await db
    .select({ id: schema.order.id, status: schema.order.status })
    .from(schema.order)
    .where(eq(schema.order.id, orderId))
    .get();
  if (!current) return { ok: false, reason: "not_found" };

  const from = parseOrderStatus(current.status);
  if (!from || !allowedTransitions(from).includes(next)) {
    return { ok: false, reason: "invalid_transition" };
  }

  // Authorization write: the flip lands only while the stored status still
  // equals what we read above, so exactly one racing caller wins; a stale
  // caller's update matches zero rows and is rejected without touching
  // inventory. Affected-row counting goes through the shared helper because
  // libsql and D1 shape batch results differently.
  const [flip] = await retryOnBusy(() =>
    db.batch([
      db
        .update(schema.order)
        .set({ status: next })
        .where(and(eq(schema.order.id, orderId), eq(schema.order.status, current.status))),
    ]),
  );
  if (affectedRowCount(flip) !== 1) {
    return { ok: false, reason: "invalid_transition" };
  }

  if (next !== "cancelled") return { ok: true };

  // Restock runs only after the flip authorized this caller as the winner.
  // D1 (the production driver — see getDb) has no interactive transactions,
  // so flip and restock cannot share one atomic unit; ordering them flip-first
  // keeps inventory safe: stock can never be restored twice for one order.
  // Residual window: a crash or permanent restock-batch failure after the
  // committed flip leaves the order cancelled with stock unrestored — logged
  // loudly and surfaced to the caller instead of being swallowed.
  const [firstEntry, ...restEntries] = await resolveRestockPlan(db, orderId);
  if (!firstEntry) return { ok: true };

  try {
    await retryOnBusy(() =>
      db.batch([
        restockStatement(db, firstEntry),
        ...restEntries.map((e) => restockStatement(db, e)),
      ]),
    );
  } catch (error) {
    console.error("[transitionOrderStatus] cancel committed but restock failed", {
      orderId,
      error,
    });
    throw error;
  }
  return { ok: true };
}
