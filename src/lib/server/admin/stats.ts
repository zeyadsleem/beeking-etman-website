import { and, asc, desc, eq, gte, lt, lte, ne, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { ORDER_STATUSES, type OrderStatus } from "./orders";

/**
 * Variants at or below this stock level surface in the dashboard's restock
 * list; the boundary value itself is included.
 */
export const LOW_STOCK_THRESHOLD = 5;

/** The daily series covers the last 30 UTC days, today included. */
const SERIES_DAYS = 30;
const DAY_MS = 86_400_000;

/** Top-products cap fixed by the admin-dashboard design. */
const TOP_PRODUCTS_LIMIT = 5;

const KNOWN_STATUSES: ReadonlySet<string> = new Set(ORDER_STATUSES);

export interface DailySeriesEntry {
  /** UTC calendar day, "YYYY-MM-DD". */
  day: string;
  revenue: number;
  orders: number;
}

export interface TopProductRow {
  name: string;
  quantity: number;
  revenue: number;
}

export interface LowStockRow {
  productId: string;
  productName: string;
  variantName: string;
  stock: number;
}

export interface DashboardStats {
  kpis: {
    /** Sum of order totals excluding cancelled orders. */
    revenue: number;
    /** Count of every order regardless of status. */
    orders: number;
    /** Distinct customer emails across guest and logged-in orders. */
    customers: number;
    byStatus: Record<OrderStatus, number>;
  };
  dailySeries: DailySeriesEntry[];
  topProducts: TopProductRow[];
  lowStock: LowStockRow[];
}

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Revenue means "money from non-cancelled orders" everywhere it appears, so
 * the per-day figures use the same rule as the headline KPI and the series
 * sums up to it over the window; order counts keep every status so that
 * summing byStatus equals kpis.orders.
 *
 * Five focused single-pass scans instead of one mega-query: global
 * count(distinct email) cannot ride the group-by-status scan (per-status
 * distinct emails would double-count customers across statuses), and each
 * remaining aggregate reads a different shape (day buckets, product lines,
 * variant stock). All are cheap table scans on owner-only volumes — no N+1,
 * no caching, matching the design's "plain SQL aggregates" decision.
 */
export async function getDashboardStats(
  db: LibSQLDatabase<typeof schema>,
): Promise<DashboardStats> {
  const nowMs = Date.now();
  const todayStartUtcMs = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const seriesStartMs = todayStartUtcMs - (SERIES_DAYS - 1) * DAY_MS;
  const seriesEndExclusiveMs = todayStartUtcMs + DAY_MS;

  // One pass over store_order covers three KPIs; the empty-table case still
  // yields its single aggregate row.
  const kpiRows = await db
    .select({
      revenue: sql<number>`coalesce(sum(case when ${schema.order.status} <> 'cancelled' then ${schema.order.total} else 0 end), 0)`,
      orders: sql<number>`count(*)`,
      customers: sql<number>`count(distinct ${schema.order.email})`,
    })
    .from(schema.order);
  const kpi = kpiRows[0];

  const statusRows = await db
    .select({ status: schema.order.status, count: sql<number>`count(*)` })
    .from(schema.order)
    .groupBy(schema.order.status);

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const row of statusRows) {
    // A status outside the lifecycle vocabulary (hand-edited rows; SQLite
    // stores status as free text) still counts toward kpis.orders above but
    // has no chip to fill — skipping beats crashing the whole dashboard.
    if (KNOWN_STATUSES.has(row.status)) {
      byStatus[row.status as OrderStatus] = Number(row.count);
    }
  }

  // Day bucketing happens in UTC inside SQLite; the WHERE bounds are plain
  // epoch-ms comparisons computed from UTC midnight arithmetic so bucket and
  // filter can never disagree about where a day starts.
  const dayBucket = sql<string>`date(${schema.order.createdAt} / 1000, 'unixepoch')`;
  const dayRows = await db
    .select({
      day: dayBucket,
      orders: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(case when ${schema.order.status} <> 'cancelled' then ${schema.order.total} else 0 end), 0)`,
    })
    .from(schema.order)
    .where(
      and(
        gte(schema.order.createdAt, seriesStartMs),
        lt(schema.order.createdAt, seriesEndExclusiveMs),
      ),
    )
    .groupBy(dayBucket);

  const metricsByDay = new Map(dayRows.map((row) => [row.day, row]));
  const dailySeries: DailySeriesEntry[] = [];
  for (let offset = SERIES_DAYS - 1; offset >= 0; offset--) {
    const day = utcDayKey(todayStartUtcMs - offset * DAY_MS);
    const hit = metricsByDay.get(day);
    dailySeries.push({
      day,
      revenue: hit ? Number(hit.revenue) : 0,
      orders: hit ? Number(hit.orders) : 0,
    });
  }

  // Lines are grouped by product id while the display name comes from the
  // live product row: renames show up immediately and grouping on
  // (product_id, name) cannot split a product into two ranking entries.
  const itemQuantity = sql<number>`sum(${schema.orderItem.quantity})`;
  const itemRevenue = sql<number>`sum(${schema.orderItem.quantity} * ${schema.orderItem.unitPrice})`;
  const topRows = await db
    .select({
      name: schema.product.name,
      quantity: itemQuantity,
      revenue: itemRevenue,
    })
    .from(schema.orderItem)
    .innerJoin(schema.order, eq(schema.order.id, schema.orderItem.orderId))
    .innerJoin(schema.product, eq(schema.product.id, schema.orderItem.productId))
    .where(ne(schema.order.status, "cancelled"))
    .groupBy(schema.orderItem.productId, schema.product.name)
    .orderBy(desc(itemQuantity), desc(itemRevenue), asc(schema.product.name))
    .limit(TOP_PRODUCTS_LIMIT);

  const lowStockRows = await db
    .select({
      productId: schema.productVariant.productId,
      productName: schema.product.name,
      variantName: schema.productVariant.name,
      stock: schema.productVariant.stock,
    })
    .from(schema.productVariant)
    .innerJoin(schema.product, eq(schema.product.id, schema.productVariant.productId))
    .where(lte(schema.productVariant.stock, LOW_STOCK_THRESHOLD))
    .orderBy(
      asc(schema.productVariant.stock),
      asc(schema.product.name),
      asc(schema.productVariant.name),
    );

  return {
    kpis: {
      revenue: Number(kpi?.revenue ?? 0),
      orders: Number(kpi?.orders ?? 0),
      customers: Number(kpi?.customers ?? 0),
      byStatus,
    },
    dailySeries,
    topProducts: topRows.map((row) => ({
      name: row.name,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
    })),
    lowStock: lowStockRows,
  };
}
