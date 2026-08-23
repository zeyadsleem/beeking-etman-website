import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import {
  allowedTransitions,
  getOrderWithItems,
  listOrders,
  parseOrderStatus,
  transitionOrderStatus,
  type OrderStatus,
} from "./orders";

const DB_FILE = "admin-orders-test.db";

async function buildDb() {
  orderCounter = 0;
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  // Mirrors production migrations verbatim: 0000 (tables + number unique),
  // 0001 (variant_name on order items), 0002 (nonce unique), 0004 (name_en
  // columns), 0006 (indexes incl. the variant (product_id, name) unique index).
  await db.run(`
    CREATE TABLE store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE
    )`);
  await db.run(`
    CREATE TABLE store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      description_en TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      category_id TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0,
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
    CREATE TABLE store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE,
      nonce TEXT UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid', user_id TEXT, created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      product_name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )`);
  return db;
}

interface SeedVariant {
  name: string;
  stock: number;
}

async function seedProduct(
  db: Awaited<ReturnType<typeof buildDb>>,
  variants: SeedVariant[],
): Promise<string> {
  const cat = (
    await db
      .insert(schema.category)
      .values({ name: "عسل السدر", slug: `cat-${crypto.randomUUID()}` })
      .returning({ id: schema.category.id })
  )[0];
  const product = (
    await db
      .insert(schema.product)
      .values({
        name: "عسل سدر مصري",
        slug: `p-${crypto.randomUUID()}`,
        description: "د",
        price: 0,
        stock: 0,
        image: "https://example.com/h.jpg",
        categoryId: cat.id,
        featured: 0,
        createdAt: Date.now(),
      })
      .returning({ id: schema.product.id })
  )[0];
  for (const variant of variants) {
    await db.insert(schema.productVariant).values({
      productId: product.id,
      name: variant.name,
      price: 100_00,
      stock: variant.stock,
      image: "https://example.com/h.jpg",
      sortOrder: 0,
    });
  }
  return product.id;
}

let orderCounter = 0;

async function seedOrder(
  db: Awaited<ReturnType<typeof buildDb>>,
  opts: { status?: OrderStatus; createdAt?: number } = {},
): Promise<string> {
  orderCounter += 1;
  const id = crypto.randomUUID();
  await db.insert(schema.order).values({
    id,
    number: `HNY-${String(orderCounter).padStart(6, "0")}`,
    email: "a@example.com",
    name: "أحمد",
    phone: "01012345678",
    address: "شارع 9",
    city: "القاهرة",
    total: 100_00,
    status: opts.status ?? "paid",
    userId: null,
    createdAt: opts.createdAt ?? Date.now(),
  });
  return id;
}

async function seedOrderItem(
  db: Awaited<ReturnType<typeof buildDb>>,
  orderId: string,
  item: { productId: string; variantName: string; quantity: number },
): Promise<void> {
  await db.insert(schema.orderItem).values({
    orderId,
    productId: item.productId,
    productName: "عسل سدر مصري",
    variantName: item.variantName,
    quantity: item.quantity,
    unitPrice: 100_00,
  });
}

async function variantStocks(
  db: Awaited<ReturnType<typeof buildDb>>,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ name: schema.productVariant.name, stock: schema.productVariant.stock })
    .from(schema.productVariant);
  return new Map(rows.map((row) => [row.name, row.stock]));
}

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("parseOrderStatus", () => {
  it("accepts the four lifecycle statuses", () => {
    expect(parseOrderStatus("paid")).toBe("paid");
    expect(parseOrderStatus("shipped")).toBe("shipped");
    expect(parseOrderStatus("delivered")).toBe("delivered");
    expect(parseOrderStatus("cancelled")).toBe("cancelled");
  });

  it("rejects anything else", () => {
    expect(parseOrderStatus("pending")).toBeNull();
    expect(parseOrderStatus("PAID")).toBeNull();
    expect(parseOrderStatus("")).toBeNull();
  });
});

describe("allowedTransitions", () => {
  it("returns exactly the forward-only matrix with terminal statuses empty", () => {
    expect(allowedTransitions("paid")).toEqual(["shipped", "cancelled"]);
    expect(allowedTransitions("shipped")).toEqual(["delivered", "cancelled"]);
    expect(allowedTransitions("delivered")).toEqual([]);
    expect(allowedTransitions("cancelled")).toEqual([]);
  });
});

describe("listOrders", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
    db = await buildDb();
  });

  it("returns newest-first and paginates (25 orders: page 1 has 20, page 2 has 5)", async () => {
    const base = 1_700_000_000_000;
    const createdIds: string[] = [];
    for (let i = 0; i < 25; i++) {
      createdIds.push(await seedOrder(db, { createdAt: base + i * 1_000 }));
    }

    const page1 = await listOrders(db);
    expect(page1.items).toHaveLength(20);
    expect(page1.total).toBe(25);
    // Newest first: the last-seeded order leads the page.
    expect(page1.items[0]?.id).toBe(createdIds[24]);
    const page1Ids = new Set(page1.items.map((o) => o.id));
    expect(page1Ids.has(createdIds[0])).toBe(false); // oldest spilled to page 2

    const page2 = await listOrders(db, { page: 2 });
    expect(page2.items).toHaveLength(5);
    expect(page2.total).toBe(25);
    // Oldest five orders, still newest-first.
    expect(page2.items.map((o) => o.id)).toEqual(createdIds.slice(0, 5).reverse());
  });

  it("filters by status in both the page and the total count", async () => {
    const base = 1_700_000_000_000;
    await seedOrder(db, { status: "paid", createdAt: base });
    const shippedA = await seedOrder(db, { status: "shipped", createdAt: base + 1_000 });
    const shippedB = await seedOrder(db, { status: "shipped", createdAt: base + 2_000 });
    await seedOrder(db, { status: "delivered", createdAt: base + 3_000 });
    await seedOrder(db, { status: "cancelled", createdAt: base + 4_000 });

    const result = await listOrders(db, { status: "shipped" });
    expect(result.total).toBe(2);
    expect(result.items.map((o) => o.id)).toEqual([shippedB, shippedA]);
    expect(result.items.every((o) => o.status === "shipped")).toBe(true);
  });

  it("maps full order fields onto AdminOrderRow", async () => {
    const id = await seedOrder(db, { createdAt: 1_700_000_000_000 });
    const result = await listOrders(db);
    expect(result.items[0]).toEqual({
      id,
      number: "HNY-000001",
      email: "a@example.com",
      name: "أحمد",
      phone: "01012345678",
      address: "شارع 9",
      city: "القاهرة",
      total: 100_00,
      status: "paid",
      createdAt: 1_700_000_000_000,
    });
  });
});

describe("getOrderWithItems", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
    db = await buildDb();
  });

  it("returns the order with its line items", async () => {
    const productId = await seedProduct(db, [
      { name: "250g", stock: 0 },
      { name: "1kg", stock: 3 },
    ]);
    const orderId = await seedOrder(db, { createdAt: 1_700_000_000_000 });
    await seedOrderItem(db, orderId, { productId, variantName: "250g", quantity: 4 });
    await seedOrderItem(db, orderId, { productId, variantName: "1kg", quantity: 2 });

    const result = await getOrderWithItems(db, orderId);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.order).toMatchObject({ id: orderId, status: "paid", total: 100_00 });
    expect(result.items).toHaveLength(2);
    const byVariant = new Map(result.items.map((item) => [item.variantName, item]));
    expect(byVariant.get("250g")).toEqual({
      id: expect.any(String),
      productId,
      productName: "عسل سدر مصري",
      variantName: "250g",
      quantity: 4,
      unitPrice: 100_00,
    });
    expect(byVariant.get("1kg")?.quantity).toBe(2);
  });

  it("returns null for an unknown order id", async () => {
    expect(await getOrderWithItems(db, crypto.randomUUID())).toBeNull();
  });
});

describe("transitionOrderStatus", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
    db = await buildDb();
  });

  it("transitions paid→shipped and persists", async () => {
    const orderId = await seedOrder(db);
    expect(await transitionOrderStatus(db, orderId, "shipped")).toEqual({ ok: true });
    const row = await db
      .select({ status: schema.order.status })
      .from(schema.order)
      .where(eq(schema.order.id, orderId))
      .get();
    expect(row?.status).toBe("shipped");
  });

  it("transitions shipped→delivered and persists", async () => {
    const orderId = await seedOrder(db, { status: "shipped" });
    expect(await transitionOrderStatus(db, orderId, "delivered")).toEqual({ ok: true });
    const row = await db
      .select({ status: schema.order.status })
      .from(schema.order)
      .where(eq(schema.order.id, orderId))
      .get();
    expect(row?.status).toBe("delivered");
  });

  it("rejects paid→delivered as invalid_transition", async () => {
    const orderId = await seedOrder(db);
    expect(await transitionOrderStatus(db, orderId, "delivered")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("rejects any transition out of a terminal status", async () => {
    const deliveredId = await seedOrder(db, { status: "delivered" });
    const cancelledId = await seedOrder(db, { status: "cancelled" });
    for (const next of ["shipped", "delivered", "cancelled"] as const) {
      expect(await transitionOrderStatus(db, deliveredId, next)).toEqual({
        ok: false,
        reason: "invalid_transition",
      });
      expect(await transitionOrderStatus(db, cancelledId, next)).toEqual({
        ok: false,
        reason: "invalid_transition",
      });
    }
  });

  it("returns not_found for an unknown order id", async () => {
    expect(await transitionOrderStatus(db, crypto.randomUUID(), "shipped")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("cancelling a paid order restores stock through the (productId, variantName) lookup", async () => {
    const productId = await seedProduct(db, [
      { name: "250g", stock: 0 },
      { name: "1kg", stock: 3 },
    ]);
    const orderId = await seedOrder(db);
    await seedOrderItem(db, orderId, { productId, variantName: "250g", quantity: 4 });
    await seedOrderItem(db, orderId, { productId, variantName: "1kg", quantity: 2 });

    expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({ ok: true });

    const stocks = await variantStocks(db);
    expect(stocks.get("250g")).toBe(4);
    expect(stocks.get("1kg")).toBe(5);
  });

  it("rejects a double cancel without restoring stock twice", async () => {
    const productId = await seedProduct(db, [
      { name: "250g", stock: 0 },
      { name: "1kg", stock: 3 },
    ]);
    const orderId = await seedOrder(db);
    await seedOrderItem(db, orderId, { productId, variantName: "250g", quantity: 4 });
    await seedOrderItem(db, orderId, { productId, variantName: "1kg", quantity: 2 });
    await transitionOrderStatus(db, orderId, "cancelled");

    expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });

    const stocks = await variantStocks(db);
    expect(stocks.get("250g")).toBe(4);
    expect(stocks.get("1kg")).toBe(5);
  });

  it("skips restock for a missing variant but still cancels and restocks the rest", async () => {
    const warnSpy = vi.spyOn(console, "warn");
    try {
      const productId = await seedProduct(db, [{ name: "1kg", stock: 3 }]);
      const orderId = await seedOrder(db);
      await seedOrderItem(db, orderId, { productId, variantName: "gone", quantity: 7 });
      await seedOrderItem(db, orderId, { productId, variantName: "1kg", quantity: 2 });

      expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({ ok: true });

      const stocks = await variantStocks(db);
      expect(stocks.get("1kg")).toBe(5);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toBe("[transitionOrderStatus] restock skipped");
      expect(warnSpy.mock.calls[0]?.[1]).toEqual({ productId, variantName: "gone" });
    } finally {
      warnSpy.mockRestore();
    }
  });
});
