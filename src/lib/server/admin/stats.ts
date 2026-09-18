import { and, asc, desc, eq, gte, lt, lte, ne, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { ORDER_STATUSES, parseOrderStatus, type OrderStatus } from "./orders";

/**
 * Variants at or below this stock level surface in the dashboard's restock
 * list; the boundary value itself is included.
 */
export const LOW_STOCK_THRESHOLD = 5;

/** The daily series covers the last 30 Cairo-timezone days, today included. */
const SERIES_DAYS = 30;
const DAY_MS = 86_400_000;
const CAIRO_TZ = "Africa/Cairo";

/** Top-products cap fixed by the admin-dashboard design. */
const TOP_PRODUCTS_LIMIT = 5;

export interface DailySeriesEntry {
  /** Cairo calendar day, "YYYY-MM-DD". */
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

/** Cairo calendar day key "YYYY-MM-DD" — used instead of UTC to keep the
 *  dashboard aligned with the Egyptian business day (UTC+2, no DST). */
function cairoDayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: CAIRO_TZ });
}

/** Milliseconds of the UTC offset Cairo applies at the given instant. */
function cairoOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TZ,
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+02:00";
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name);
  if (!match) return 2 * 3_600_000;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 3_600_000 + Number(match[3]) * 60_000);
}

/**
 * Epoch-ms of Cairo midnight for the day containing `now`. The offset comes
 * from the timezone database per instant, so Egypt's DST (reinstated 2023)
 * is honoured instead of assuming a fixed UTC+2.
 */
export function cairoTodayMidnightMs(now: number = Date.now()): number {
  const todayStr = new Date(now).toLocaleDateString("en-CA", { timeZone: CAIRO_TZ });
  const [year, month, day] = todayStr.split("-").map(Number);
  const utcGuess = Date.UTC(year!, month! - 1, day!);
  // The offset at the candidate instant, corrected once: the switch happens
  // at local midnight, so the first guess can sit one offset away on a
  // transition day.
  const firstPass = utcGuess - cairoOffsetMs(utcGuess);
  return utcGuess - cairoOffsetMs(firstPass);
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
  const todayStartUtcMs = cairoTodayMidnightMs();
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
    const status = parseOrderStatus(row.status);
    if (status !== null) {
      // Legacy rows split across placed/paid and both map to confirmed, so
      // the counts accumulate instead of overwriting each other.
      byStatus[status] = byStatus[status] + Number(row.count);
    }
  }

  // Fetch raw rows in the time range and bucket by Cairo day in JS instead
  // of relying on SQLite's UTC-based date() function, which would split the
  // Egyptian business day at 22:00 local.
  const dayRows = await db
    .select({
      createdAt: schema.order.createdAt,
      status: schema.order.status,
      total: schema.order.total,
    })
    .from(schema.order)
    .where(
      and(
        gte(schema.order.createdAt, seriesStartMs),
        lt(schema.order.createdAt, seriesEndExclusiveMs),
      ),
    );

  const metricsByDay = new Map<string, { orders: number; revenue: number }>();
  for (const row of dayRows) {
    const day = cairoDayKey(row.createdAt);
    const entry = metricsByDay.get(day);
    if (entry) {
      entry.orders += 1;
      if (row.status !== "cancelled") entry.revenue += row.total;
    } else {
      metricsByDay.set(day, {
        orders: 1,
        revenue: row.status !== "cancelled" ? row.total : 0,
      });
    }
  }

  const dailySeries: DailySeriesEntry[] = [];
  for (let offset = SERIES_DAYS - 1; offset >= 0; offset--) {
    const day = cairoDayKey(todayStartUtcMs - offset * DAY_MS);
    const hit = metricsByDay.get(day);
    dailySeries.push({
      day,
      revenue: hit ? hit.revenue : 0,
      orders: hit ? hit.orders : 0,
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
    )
    .limit(50);

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
