import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";

// Same guard as the sibling admin specs: seeding-heavy tests brush against
// vitest defaults when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import type { PageServerData, PageServerLoadEvent } from "./$types";

// The loader imports the shared lazy `db` proxy; point it at this spec's
// file-backed client so the route is exercised end-to-end against real SQL.
const state = vi.hoisted(() => ({
  database: null as LibSQLDatabase<typeof schema> | null,
}));

vi.mock("$lib/server/db", () => ({
  get db(): LibSQLDatabase<typeof schema> {
    if (!state.database) throw new Error("test database not initialized");
    return state.database;
  },
}));

const DB_FILE = "admin-dashboard-page-test.db";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

// getDashboardStats reads store_order, store_order_item, store_product and
// store_product_variant; the DDL mirrors production migrations verbatim (same
// constraint surface as the sibling admin specs).
async function buildDb(): Promise<void> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`DROP TABLE IF EXISTS store_product_image`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
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
  testDb = db;
  state.database = db;
}

async function seedCategory(db: LibSQLDatabase<typeof schema>): Promise<string> {
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

async function seedProduct(db: LibSQLDatabase<typeof schema>, name: string): Promise<string> {
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
  db: LibSQLDatabase<typeof schema>,
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
  total?: number;
  status?: "placed" | "shipped" | "delivered" | "cancelled";
  createdAt?: number;
}

async function seedOrder(db: LibSQLDatabase<typeof schema>, opts: SeedOrder = {}): Promise<string> {
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
    userId: null,
    createdAt: opts.createdAt ?? Date.now(),
  });
  return id;
}

async function seedItem(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  productId: string,
  opts: { quantity: number; unitPrice: number },
): Promise<void> {
  await db.insert(schema.orderItem).values({
    orderId,
    productId,
    variantId: null,
    productName: "عسل",
    variantName: "",
    quantity: opts.quantity,
    unitPrice: opts.unitPrice,
  });
}

/**
 * Cairo calendar key of today with the reference instant anchored at Cairo
 * noon — ~12h from any Cairo day boundary, so a midnight crossing between
 * the anchor and the loader under test cannot change the reference day.
 */
function cairoNoonAnchor(): string {
  const refDay = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  return refDay;
}

function fakeEvent(url: string, cookies: Record<string, string> = {}): PageServerLoadEvent {
  // The loader only reads `cookies.get` and request headers (getLang).
  return {
    url: new URL(url),
    cookies: { get: (name: string) => cookies[name] },
    request: new Request(url),
  } as unknown as PageServerLoadEvent;
}

// SvelteKit's `PageServerLoad` return type carries a `void` arm (loads may
// return nothing); this loader always returns data, so narrow once here to
// the route's generated concrete data type.
let load: (event: PageServerLoadEvent) => Promise<PageServerData>;

beforeAll(async () => {
  const module = await import("./+page.server");
  load = module.load as unknown as typeof load;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(() => {
  categoryIdCache = null;
  return buildDb();
});

describe("admin dashboard page load", () => {
  it("returns the stats shape the dashboard consumes", async () => {
    const db = currentDb();

    const sidr = await seedProduct(db, "sidr");
    await seedVariant(db, sidr, { name: "كيلو", stock: 4 });

    const paid = await seedOrder(db, { total: 120_00 });
    await seedItem(db, paid, sidr, { quantity: 3, unitPrice: 40_00 });
    await seedOrder(db, { email: "guest@example.com", total: 500_00, status: "cancelled" });

    const data = await load(fakeEvent("http://localhost/admin"));

    expect(data.lang).toBe("ar"); // no cookie/header → Arabic default
    expect(data.stats.kpis.revenue).toBe(120_00); // cancelled excluded
    expect(data.stats.kpis.orders).toBe(2); // every status counts
    expect(data.stats.kpis.customers).toBe(1);
    expect(data.stats.kpis.byStatus).toEqual({
      placed: 1,
      shipped: 0,
      delivered: 0,
      cancelled: 1,
    });
    expect(data.stats.dailySeries).toHaveLength(30);
    expect(data.stats.dailySeries[29]).toEqual({
      day: cairoNoonAnchor(),
      revenue: 120_00,
      orders: 2,
    });
    expect(data.stats.topProducts).toEqual([{ name: "sidr", quantity: 3, revenue: 120_00 }]);
    expect(data.stats.lowStock).toEqual([
      { productId: sidr, productName: "sidr", variantName: "كيلو", stock: 4 },
    ]);
  });

  it("keeps every section at its empty shape when there is no data yet", async () => {
    const data = await load(fakeEvent("http://localhost/admin"));

    expect(data.stats.kpis.revenue).toBe(0);
    expect(data.stats.kpis.orders).toBe(0);
    expect(data.stats.kpis.customers).toBe(0);
    expect(Object.values(data.stats.kpis.byStatus).every((count) => count === 0)).toBe(true);
    expect(data.stats.dailySeries).toHaveLength(30);
    expect(data.stats.dailySeries.every((entry) => entry.revenue === 0 && entry.orders === 0)).toBe(
      true,
    );
    expect(data.stats.topProducts).toEqual([]);
    expect(data.stats.lowStock).toEqual([]);
  });

  it("resolves lang from the lang cookie", async () => {
    await seedOrder(currentDb());

    const data = await load(fakeEvent("http://localhost/admin", { lang: "en" }));

    expect(data.lang).toBe("en");
  });
});
