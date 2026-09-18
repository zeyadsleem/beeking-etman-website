import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";

// Seeding-heavy tests and per-test schema rebuilds brush against vitest's
// 5s/10s defaults when the whole suite runs in parallel — same guard as the
// sibling admin specs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import {
  cairoTodayMidnightMs,
  LOW_STOCK_THRESHOLD,
  getDashboardStats,
  type DashboardStats,
} from "./stats";

const DB_FILE = "admin-stats-test.db";
const DAY_MS = 86_400_000;

// One client for the whole file: reopening the same file after an unlink can
// strand open handles (SQLITE_READONLY_DBMOVED), so rebuilds drop/recreate
// tables on this client instead of deleting the database.
let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`DROP TABLE IF EXISTS store_product_image`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  // Same constraint surface as production migrations (see sibling
  // admin/products.spec.ts): unique product slugs and order numbers, nonce
  // unique, variant (product_id, name) unique. FK clauses omitted, matching
  // the house style of the sibling admin specs — SQLite does not enforce them
  // anyway.
  await db.run(`
    CREATE TABLE store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL DEFAULT 'honey', parent_id TEXT
    )`);
  await db.run(`
    CREATE TABLE store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      description_en TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      category_id TEXT NOT NULL, department TEXT NOT NULL DEFAULT 'honey', featured INTEGER NOT NULL DEFAULT 0, sku TEXT, published INTEGER NOT NULL DEFAULT 1, cost_price INTEGER, weight_grams INTEGER,
      created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_product_variant (
      id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL,
      name_en TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(
    `CREATE UNIQUE INDEX store_product_variant_productId_name_unique ON store_product_variant (product_id, name)`,
  );
  await db.run(`
    CREATE TABLE store_product_image (
      id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL,
      url TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(`
    CREATE TABLE store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE,
      nonce TEXT UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, governorate TEXT NOT NULL DEFAULT 'cairo', shipping_cost INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_confirmation', payment_status TEXT NOT NULL DEFAULT 'unpaid', stock_version TEXT NOT NULL DEFAULT 'legacy',
      payment_method TEXT NOT NULL DEFAULT 'simulated', payment_reference TEXT, payment_claimed_at INTEGER, payment_reviewed_at INTEGER,
      payment_reviewed_by TEXT, hold_expires_at INTEGER, paid_at INTEGER, user_id TEXT, created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      variant_id TEXT,
      product_name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )`);
  return db;
}

type Db = Awaited<ReturnType<typeof buildDb>>;

async function seedCategory(db: Db): Promise<string> {
  const row = (
    await db
      .insert(schema.category)
      .values({ name: "عسل", nameEn: "", slug: `cat-${crypto.randomUUID()}` })
      .returning({ id: schema.category.id })
  )[0];
  if (!row) throw new Error("seedCategory insert returned no row");
  return row.id;
}

let categoryIdCache: string | null = null;

async function seedProduct(db: Db, name: string): Promise<string> {
  categoryIdCache ??= await seedCategory(db);
  const row = (
    await db
      .insert(schema.product)
      .values({
        name,
        nameEn: "",
        slug: `p-${crypto.randomUUID()}`,
        description: "د",
        descriptionEn: "",
        price: 100_00,
        stock: 0,
        image: "https://example.com/h.jpg",
        categoryId: categoryIdCache,
        featured: 0,
        createdAt: Date.now(),
      })
      .returning({ id: schema.product.id })
  )[0];
  if (!row) throw new Error("seedProduct insert returned no row");
  return row.id;
}

async function seedVariant(
  db: Db,
  productId: string,
  opts: { name?: string; stock?: number } = {},
): Promise<void> {
  await db.insert(schema.productVariant).values({
    productId,
    name: opts.name ?? "كيلو",
    price: 100_00,
    stock: opts.stock ?? 10,
    image: "https://example.com/v.jpg",
    sortOrder: 0,
  });
}

let orderCounter = 0;

interface SeedOrder {
  email?: string;
  userId?: string | null;
  total?: number;
  status?: "placed" | "shipped" | "delivered" | "cancelled";
  createdAt?: number;
}

async function seedOrder(db: Db, opts: SeedOrder = {}): Promise<string> {
  orderCounter += 1;
  const id = crypto.randomUUID();
  await db.insert(schema.order).values({
    id,
    number: `HNY-${String(orderCounter).padStart(6, "0")}`,
    email: opts.email ?? "guest@example.com",
    name: "أحمد",
    phone: "01012345678",
    address: "شارع 9",
    city: "القاهرة",
    total: opts.total ?? 100_00,
    status: opts.status ?? "placed",
    paymentStatus: "simulated",
    userId: opts.userId ?? null,
    createdAt: opts.createdAt ?? Date.now(),
  });
  return id;
}

async function seedItem(
  db: Db,
  orderId: string,
  productId: string,
  opts: { productName?: string; variantName?: string; quantity: number; unitPrice: number },
): Promise<void> {
  await db.insert(schema.orderItem).values({
    orderId,
    productId,
    variantId: null,
    productName: opts.productName ?? "عسل",
    variantName: opts.variantName ?? "",
    quantity: opts.quantity,
    unitPrice: opts.unitPrice,
  });
}

/**
 * Epoch ms for Cairo noon on the Cairo day containing wall-clock now.
 * Anchoring ~12h away from any Cairo day boundary means a midnight crossing
 * between this capture and the code under test cannot change the reference
 * day, so the suite is deterministic regardless of when CI runs. Derived
 * from the same DST-aware midnight the implementation uses.
 */
function cairoNoonAnchor(): number {
  return cairoTodayMidnightMs() + 12 * 60 * 60 * 1000;
}

/** Cairo calendar key of the day `days` before the Cairo day containing `nowMs`. */
function dayKeyDaysAgo(days: number, nowMs: number): string {
  return new Date(cairoTodayMidnightMs(nowMs) - days * DAY_MS).toLocaleDateString("en-CA", {
    timeZone: "Africa/Cairo",
  });
}

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(() => {
  categoryIdCache = null;
});

describe("LOW_STOCK_THRESHOLD", () => {
  it("is 5 so the boundary variant (stock 5) is alerted", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(5);
  });
});

describe("cairoTodayMidnightMs", () => {
  it("uses the Cairo summer offset (DST) for day boundaries", () => {
    const midnight = cairoTodayMidnightMs(Date.UTC(2026, 6, 15, 12, 0, 0));
    expect(new Date(midnight).toISOString()).toBe("2026-07-14T21:00:00.000Z");
  });

  it("uses the Cairo winter offset for day boundaries", () => {
    const midnight = cairoTodayMidnightMs(Date.UTC(2026, 0, 15, 12, 0, 0));
    expect(new Date(midnight).toISOString()).toBe("2026-01-14T22:00:00.000Z");
  });
});

describe("getDashboardStats — kpis", () => {
  it("sums revenue excluding cancelled orders and counts every order", async () => {
    const db = await buildDb();

    await seedOrder(db, { status: "placed", total: 100_00 });
    await seedOrder(db, { status: "placed", total: 50_00 });
    await seedOrder(db, { status: "shipped", total: 30_00 });
    await seedOrder(db, { status: "delivered", total: 20_00 });
    await seedOrder(db, { status: "cancelled", total: 999_00 });

    const stats = await getDashboardStats(db);

    expect(stats.kpis.revenue).toBe(200_00);
    expect(stats.kpis.orders).toBe(5);
  });

  it("counts customers as distinct emails across guest and logged-in orders", async () => {
    const db = await buildDb();

    // Same email once as a guest and once logged-in must collapse to one
    // customer; statuses differ to prove the dedupe crosses status groups.
    await seedOrder(db, { email: "shared@example.com", userId: null, status: "placed" });
    await seedOrder(db, {
      email: "shared@example.com",
      userId: "user-1",
      status: "delivered",
    });
    await seedOrder(db, { email: "other@example.com", userId: null });
    await seedOrder(db, { email: "third@example.com", userId: "user-2" });

    const stats = await getDashboardStats(db);

    expect(stats.kpis.customers).toBe(3);
    expect(stats.kpis.orders).toBe(4);
  });

  it("zero-fills every status and reports counts per status", async () => {
    const db = await buildDb();

    await seedOrder(db, { status: "placed" });
    await seedOrder(db, { status: "placed" });
    await seedOrder(db, { status: "cancelled" });

    const stats = await getDashboardStats(db);

    expect(stats.kpis.byStatus).toEqual({
      placed: 2,
      shipped: 0,
      delivered: 0,
      cancelled: 1,
    });
  });

  it("counts a hand-edited unknown status toward kpis.orders but not byStatus", async () => {
    const db = await buildDb();

    await seedOrder(db, { status: "placed" });

    // SQLite stores status as free text; simulate an out-of-band write that
    // left a value outside the lifecycle vocabulary.
    orderCounter += 1;
    await db.insert(schema.order).values({
      id: crypto.randomUUID(),
      number: `HNY-${String(orderCounter).padStart(6, "0")}`,
      email: "weird@example.com",
      name: "سارة",
      phone: "01098765432",
      address: "شارع 7",
      city: "الإسكندرية",
      total: 10_00,
      status: "refunded",
      userId: null,
      createdAt: Date.now(),
    });

    const stats = await getDashboardStats(db);

    expect(stats.kpis.orders).toBe(2);
    expect(stats.kpis.byStatus).toEqual({
      placed: 1,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    });
  });
});

describe("getDashboardStats — dailySeries", () => {
  it("buckets the last 30 Cairo days ascending with zero-filled gaps", async () => {
    const nowMs = cairoNoonAnchor();
    const db = await buildDb();

    // Today: one paid order.
    await seedOrder(db, { status: "placed", total: 100_00, createdAt: nowMs });
    // Yesterday: paid + cancelled — the day's order count includes both,
    // its revenue only the paid one.
    await seedOrder(db, {
      status: "placed",
      total: 40_00,
      createdAt: nowMs - 1 * DAY_MS,
    });
    await seedOrder(db, {
      status: "cancelled",
      total: 70_00,
      createdAt: nowMs - 1 * DAY_MS,
    });
    // Five days back: delivered order inside a deliberate gap.
    await seedOrder(db, {
      status: "delivered",
      total: 25_00,
      createdAt: nowMs - 5 * DAY_MS,
    });
    // Window boundary: 29 days back is the oldest bucket, 30 is out.
    await seedOrder(db, {
      status: "placed",
      total: 10_00,
      createdAt: nowMs - 29 * DAY_MS,
    });
    await seedOrder(db, {
      status: "placed",
      total: 500_00,
      createdAt: nowMs - 30 * DAY_MS,
    });

    const stats = await getDashboardStats(db);
    const series = stats.dailySeries;

    expect(series).toHaveLength(30);
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.day > series[i - 1]!.day).toBe(true);
    }
    expect(series[0]!.day).toBe(dayKeyDaysAgo(29, nowMs));
    expect(series[29]!.day).toBe(dayKeyDaysAgo(0, nowMs));

    expect(series[29]).toEqual({
      day: dayKeyDaysAgo(0, nowMs),
      revenue: 100_00,
      orders: 1,
    });
    expect(series[28]).toEqual({
      day: dayKeyDaysAgo(1, nowMs),
      revenue: 40_00,
      orders: 2,
    });
    expect(series[24]).toEqual({
      day: dayKeyDaysAgo(5, nowMs),
      revenue: 25_00,
      orders: 1,
    });
    expect(series[0]).toEqual({
      day: dayKeyDaysAgo(29, nowMs),
      revenue: 10_00,
      orders: 1,
    });

    // A gap day inside the window stays present with zeroes.
    expect(series[26]).toEqual({
      day: dayKeyDaysAgo(3, nowMs),
      revenue: 0,
      orders: 0,
    });
  });

  it("keeps the series zeroed when there are no orders", async () => {
    const nowMs = cairoNoonAnchor();
    const db = await buildDb();

    const stats: DashboardStats = await getDashboardStats(db);

    expect(stats.dailySeries).toHaveLength(30);
    expect(stats.dailySeries.every((entry) => entry.revenue === 0 && entry.orders === 0)).toBe(
      true,
    );
    expect(stats.dailySeries[29]!.day).toBe(dayKeyDaysAgo(0, nowMs));
  });
});

describe("getDashboardStats — topProducts", () => {
  it("aggregates line items per product, excludes cancelled orders, ranks by quantity, caps at 5", async () => {
    const db = await buildDb();

    const sidr = await seedProduct(db, "sidr");
    const clover = await seedProduct(db, "clover");
    const citrus = await seedProduct(db, "citrus");
    const plum = await seedProduct(db, "plum");
    const eucalyptus = await seedProduct(db, "eucalyptus");
    const flower = await seedProduct(db, "flower");
    const ginger = await seedProduct(db, "ginger");

    const paidOne = await seedOrder(db, { status: "placed", total: 500_00 });
    await seedItem(db, paidOne, sidr, { quantity: 2, unitPrice: 100_00 });
    await seedItem(db, paidOne, clover, { quantity: 6, unitPrice: 50_00 });

    // Second order stacks more sidr onto the same product.
    const paidTwo = await seedOrder(db, { status: "shipped", total: 300_00 });
    await seedItem(db, paidTwo, sidr, { quantity: 3, unitPrice: 100_00 });

    // Cancelled order must vanish from the ranking entirely.
    const dead = await seedOrder(db, { status: "cancelled", total: 199_00 });
    await seedItem(db, dead, sidr, { quantity: 10, unitPrice: 100_00 });
    await seedItem(db, dead, citrus, { quantity: 99, unitPrice: 1_00 });

    const paidThree = await seedOrder(db, { status: "delivered", total: 160_00 });
    await seedItem(db, paidThree, citrus, { quantity: 2, unitPrice: 80_00 });

    // Quantity ties below resolve by revenue desc, then name asc.
    const paidFour = await seedOrder(db, { status: "placed", total: 700_00 });
    await seedItem(db, paidFour, flower, { quantity: 1, unitPrice: 300_00 });
    await seedItem(db, paidFour, eucalyptus, { quantity: 1, unitPrice: 200_00 });
    await seedItem(db, paidFour, plum, { quantity: 1, unitPrice: 100_00 });
    await seedItem(db, paidFour, ginger, { quantity: 1, unitPrice: 100_00 });

    const stats = await getDashboardStats(db);

    expect(stats.topProducts).toEqual([
      { name: "clover", quantity: 6, revenue: 300_00 },
      { name: "sidr", quantity: 5, revenue: 500_00 },
      { name: "citrus", quantity: 2, revenue: 160_00 },
      { name: "flower", quantity: 1, revenue: 300_00 },
      { name: "eucalyptus", quantity: 1, revenue: 200_00 },
    ]);
  });

  it("returns an empty list when nothing was sold", async () => {
    const db = await buildDb();
    const stats = await getDashboardStats(db);
    expect(stats.topProducts).toEqual([]);
  });
});

describe("getDashboardStats — lowStock", () => {
  it("lists variants with stock <= threshold ascending and includes the boundary", async () => {
    const db = await buildDb();

    const sidr = await seedProduct(db, "sidr");
    const clover = await seedProduct(db, "clover");

    await seedVariant(db, sidr, { name: "كيلو", stock: 5 }); // boundary: included
    await seedVariant(db, sidr, { name: "نصف كيلو", stock: 0 });
    await seedVariant(db, clover, { name: "ربع كيلو", stock: 2 });
    await seedVariant(db, clover, { name: "برطمان", stock: 1 });
    await seedVariant(db, clover, { name: "سادة", stock: 6 }); // above: excluded

    const stats = await getDashboardStats(db);

    expect(stats.lowStock).toEqual([
      { productId: sidr, productName: "sidr", variantName: "نصف كيلو", stock: 0 },
      { productId: clover, productName: "clover", variantName: "برطمان", stock: 1 },
      { productId: clover, productName: "clover", variantName: "ربع كيلو", stock: 2 },
      { productId: sidr, productName: "sidr", variantName: "كيلو", stock: 5 },
    ]);
    expect(stats.lowStock.some((row) => row.variantName === "سادة")).toBe(false);
  });

  it("returns an empty list when every variant is well stocked", async () => {
    const db = await buildDb();
    const product = await seedProduct(db, "sidr");
    await seedVariant(db, product, { stock: 6 });

    const stats = await getDashboardStats(db);

    expect(stats.lowStock).toEqual([]);
  });
});
