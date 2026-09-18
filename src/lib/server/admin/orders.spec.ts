import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";

// Seeding-heavy tests (25+ serial inserts) and per-test schema rebuilds brush
// against vitest's 5s/10s defaults when the whole suite runs in parallel —
// same guard as orders.spec.ts.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { and, eq, sql } from "drizzle-orm";
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

// One client for the whole file: reopening the same file after an unlink can
// strand open handles (SQLITE_READONLY_DBMOVED), so rebuilds drop/recreate
// tables on this client instead of deleting the database.
let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  orderCounter = 0;
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
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES store_order(id),
      product_id TEXT NOT NULL REFERENCES store_product(id),
      variant_id TEXT REFERENCES store_product_variant(id),
      product_name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
    )`);
  await db.run(`
    CREATE TRIGGER trg_order_item_reserve_stock
    BEFORE INSERT ON store_order_item
    WHEN (SELECT stock_version FROM store_order WHERE id = NEW.order_id) = 'atomic'
    BEGIN
      SELECT CASE
        WHEN NEW.variant_id IS NULL THEN
          RAISE(ABORT, 'MISSING_VARIANT_ID')
      END;

      UPDATE store_product_variant
      SET stock = stock - NEW.quantity
      WHERE id = NEW.variant_id AND stock >= NEW.quantity;

      SELECT CASE
        WHEN (SELECT changes()) = 0 THEN
          RAISE(ABORT, 'OUT_OF_STOCK')
      END;
    END`);
  await db.run(`
    CREATE TRIGGER trg_order_status_cancel_restock
    AFTER UPDATE OF status ON store_order
    WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.stock_version = 'atomic'
    BEGIN
      UPDATE store_product_variant
      SET stock = stock + COALESCE((
        SELECT SUM(quantity)
        FROM store_order_item
        WHERE order_id = NEW.id AND variant_id = store_product_variant.id
      ), 0)
      WHERE id IN (SELECT variant_id FROM store_order_item WHERE order_id = NEW.id AND variant_id IS NOT NULL);
    END`);
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

// The DB column stores free text; legacy rows hold "paid".
type StoredOrderStatus = OrderStatus | "placed" | "paid";

async function seedOrder(
  db: Awaited<ReturnType<typeof buildDb>>,
  opts: { status?: StoredOrderStatus; createdAt?: number; stockVersion?: "legacy" | "atomic" } = {},
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
    status: opts.status ?? "placed",
    paymentStatus: "simulated",
    stockVersion: opts.stockVersion ?? "legacy",
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
  const variant = await db
    .select({ id: schema.productVariant.id })
    .from(schema.productVariant)
    .where(
      and(
        eq(schema.productVariant.productId, item.productId),
        eq(schema.productVariant.name, item.variantName),
      ),
    )
    .get();
  await db.insert(schema.orderItem).values({
    orderId,
    productId: item.productId,
    variantId: variant?.id ?? null,
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
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("parseOrderStatus", () => {
  it("accepts the six lifecycle statuses", () => {
    expect(parseOrderStatus("pending_confirmation")).toBe("pending_confirmation");
    expect(parseOrderStatus("confirmed")).toBe("confirmed");
    expect(parseOrderStatus("processing")).toBe("processing");
    expect(parseOrderStatus("shipped")).toBe("shipped");
    expect(parseOrderStatus("delivered")).toBe("delivered");
    expect(parseOrderStatus("cancelled")).toBe("cancelled");
  });

  it("rejects anything else", () => {
    expect(parseOrderStatus("pending")).toBeNull();
    expect(parseOrderStatus("PAID")).toBeNull();
    expect(parseOrderStatus("")).toBeNull();
  });

  it("maps legacy placed and paid rows to confirmed", () => {
    expect(parseOrderStatus("placed")).toBe("confirmed");
    expect(parseOrderStatus("paid")).toBe("confirmed");
  });
});

describe("allowedTransitions", () => {
  it("returns exactly the forward-only matrix with terminal statuses empty", () => {
    expect(allowedTransitions("pending_confirmation")).toEqual(["confirmed", "cancelled"]);
    expect(allowedTransitions("confirmed")).toEqual(["processing", "shipped", "cancelled"]);
    expect(allowedTransitions("processing")).toEqual(["shipped", "cancelled"]);
    expect(allowedTransitions("shipped")).toEqual(["delivered"]);
    expect(allowedTransitions("delivered")).toEqual([]);
    expect(allowedTransitions("cancelled")).toEqual([]);
  });
});

describe("listOrders", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
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
    await seedOrder(db, { status: "pending_confirmation", createdAt: base });
    const shippedA = await seedOrder(db, { status: "shipped", createdAt: base + 1_000 });
    const shippedB = await seedOrder(db, { status: "shipped", createdAt: base + 2_000 });
    await seedOrder(db, { status: "delivered", createdAt: base + 3_000 });
    await seedOrder(db, { status: "cancelled", createdAt: base + 4_000 });

    const result = await listOrders(db, { status: "shipped" });
    expect(result.total).toBe(2);
    expect(result.items.map((o) => o.id)).toEqual([shippedB, shippedA]);
    expect(result.items.every((o) => o.status === "shipped")).toBe(true);
  });

  it("confirmed filter includes legacy placed and paid rows", async () => {
    const base = 1_700_000_000_000;
    await seedOrder(db, { status: "confirmed", createdAt: base });
    await seedOrder(db, { status: "placed", createdAt: base + 1_000 });
    await seedOrder(db, { status: "paid", createdAt: base + 2_000 });
    await seedOrder(db, { status: "shipped", createdAt: base + 3_000 });

    const result = await listOrders(db, { status: "confirmed" });
    expect(result.total).toBe(3);
    expect(result.items.every((o) => o.status === "confirmed")).toBe(true);
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
      status: "confirmed",
      paymentStatus: "simulated",
      paymentMethod: "simulated",
      createdAt: 1_700_000_000_000,
    });
  });
});

describe("getOrderWithItems", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
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
    expect(result.order).toMatchObject({ id: orderId, status: "confirmed", total: 100_00 });
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
    db = await buildDb();
  });

  it("transitions placed→shipped and persists", async () => {
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

  it("rejects placed→delivered as invalid_transition", async () => {
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

  it("does not cancel legacy orders with unresolved inventory snapshots", async () => {
    const productId = await seedProduct(db, [{ name: "250g", stock: 2 }]);
    const orderId = await seedOrder(db);
    await db.insert(schema.orderItem).values({
      orderId,
      productId,
      variantId: null,
      productName: "Honey",
      variantName: "Old size",
      quantity: 1,
      unitPrice: 10000,
    });
    expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({
      ok: false,
      reason: "inventory_reconciliation_required",
    });
    const order = await db.select().from(schema.order).where(eq(schema.order.id, orderId)).get();
    expect(order?.status).toBe("placed");
    expect((await variantStocks(db)).get("250g")).toBe(2);
  });

  it("cancelling a placed order restores stock through the variant_id snapshot", async () => {
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

  it("rejects a stale cancel that lost a concurrent race without restoring stock", async () => {
    const productId = await seedProduct(db, [
      { name: "250g", stock: 4 },
      { name: "1kg", stock: 3 },
    ]);
    const orderId = await seedOrder(db, { stockVersion: "atomic" });
    await seedOrderItem(db, orderId, { productId, variantName: "250g", quantity: 4 });
    await seedOrderItem(db, orderId, { productId, variantName: "1kg", quantity: 2 });
    // A concurrent admin cancels the order between our read and our guarded
    // flip; the atomic status flip fires the restock trigger, and by the time
    // our flip runs its WHERE clause matches nothing.
    const originalBatch = db.batch.bind(db);
    vi.spyOn(db, "batch").mockImplementationOnce(async (statements) => {
      await db.run(sql`UPDATE store_order SET status = 'cancelled' WHERE id = ${orderId}`);
      return originalBatch(statements);
    });

    expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });

    // The winner restocked exactly once; the loser restored nothing.
    const stocks = await variantStocks(db);
    expect(stocks.get("250g")).toBe(4);
    expect(stocks.get("1kg")).toBe(3);
    const row = await db
      .select({ status: schema.order.status })
      .from(schema.order)
      .where(eq(schema.order.id, orderId))
      .get();
    expect(row?.status).toBe("cancelled");
  });

  it("restocks after cancellation even when the variant name is renamed", async () => {
    const productId = await seedProduct(db, [{ name: "250g", stock: 0 }]);
    const orderId = await seedOrder(db);
    await seedOrderItem(db, orderId, { productId, variantName: "250g", quantity: 4 });
    await db
      .update(schema.productVariant)
      .set({ name: "250 جرام" })
      .where(
        and(eq(schema.productVariant.productId, productId), eq(schema.productVariant.name, "250g")),
      );

    expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({ ok: true });

    const stocks = await variantStocks(db);
    expect(stocks.get("250 جرام")).toBe(4);
  });

  it("restocks after cancellation when the stored snapshot uses the English variant name", async () => {
    const productId = await seedProduct(db, [{ name: "1kg", stock: 1 }]);
    const variant = await db
      .select({ id: schema.productVariant.id, name: schema.productVariant.name })
      .from(schema.productVariant)
      .where(
        and(eq(schema.productVariant.productId, productId), eq(schema.productVariant.name, "1kg")),
      )
      .get();
    const orderId = await seedOrder(db);
    await db.insert(schema.orderItem).values({
      orderId,
      productId,
      variantId: variant?.id,
      productName: "عسل سدر مصري",
      variantName: "1 Kilogram",
      quantity: 1,
      unitPrice: 100_00,
    });

    expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({ ok: true });

    const stocks = await variantStocks(db);
    expect(stocks.get("1kg")).toBe(2);
  });

  it("restocks blend additive units after cancellation using their variant_id snapshots", async () => {
    const honeyProductId = await seedProduct(db, [{ name: "500g", stock: 0 }]);
    const additiveProductId = await seedProduct(db, [{ name: "5g", stock: 0 }]);
    const honeyVariant = await db
      .select({ id: schema.productVariant.id })
      .from(schema.productVariant)
      .where(
        and(
          eq(schema.productVariant.productId, honeyProductId),
          eq(schema.productVariant.name, "500g"),
        ),
      )
      .get();
    const additiveVariant = await db
      .select({ id: schema.productVariant.id })
      .from(schema.productVariant)
      .where(
        and(
          eq(schema.productVariant.productId, additiveProductId),
          eq(schema.productVariant.name, "5g"),
        ),
      )
      .get();
    const orderId = await seedOrder(db);
    await db.insert(schema.orderItem).values({
      orderId,
      productId: honeyProductId,
      variantId: honeyVariant?.id,
      productName: "عسل سدر مصري",
      variantName: "500 جرام",
      quantity: 1,
      unitPrice: 100_00,
    });
    await db.insert(schema.orderItem).values({
      orderId,
      productId: additiveProductId,
      variantId: additiveVariant?.id,
      productName: "غذاء ملكات",
      variantName: "",
      quantity: 2,
      unitPrice: 50_00,
    });

    expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({ ok: true });

    const stocks = await variantStocks(db);
    expect(stocks.get("500g")).toBe(1);
    expect(stocks.get("5g")).toBe(2);
  });

  it("cancelling an atomic order restocks through the trigger", async () => {
    const productId = await seedProduct(db, [
      { name: "250g", stock: 4 },
      { name: "1kg", stock: 3 },
    ]);
    const orderId = await seedOrder(db, { stockVersion: "atomic" });
    await seedOrderItem(db, orderId, { productId, variantName: "250g", quantity: 4 });
    await seedOrderItem(db, orderId, { productId, variantName: "1kg", quantity: 2 });

    expect(await transitionOrderStatus(db, orderId, "cancelled")).toEqual({ ok: true });

    const stocks = await variantStocks(db);
    expect(stocks.get("250g")).toBe(4);
    expect(stocks.get("1kg")).toBe(3);
  });

  it("legacy orders do not trigger stock reservation on direct item insert", async () => {
    const productId = await seedProduct(db, [{ name: "250g", stock: 4 }]);
    const orderId = await seedOrder(db, { stockVersion: "legacy" });
    const variant = await db
      .select({ id: schema.productVariant.id })
      .from(schema.productVariant)
      .where(
        and(eq(schema.productVariant.productId, productId), eq(schema.productVariant.name, "250g")),
      )
      .get();

    await db.insert(schema.orderItem).values({
      orderId,
      productId,
      variantId: variant?.id,
      productName: "عسل سدر مصري",
      variantName: "250g",
      quantity: 4,
      unitPrice: 100_00,
    });

    const stocks = await variantStocks(db);
    expect(stocks.get("250g")).toBe(4);
  });

  it("atomic orders reserve stock on direct item insert", async () => {
    const productId = await seedProduct(db, [{ name: "250g", stock: 4 }]);
    const orderId = await seedOrder(db, { stockVersion: "atomic" });
    const variant = await db
      .select({ id: schema.productVariant.id })
      .from(schema.productVariant)
      .where(
        and(eq(schema.productVariant.productId, productId), eq(schema.productVariant.name, "250g")),
      )
      .get();

    await db.insert(schema.orderItem).values({
      orderId,
      productId,
      variantId: variant?.id,
      productName: "عسل سدر مصري",
      variantName: "250g",
      quantity: 4,
      unitPrice: 100_00,
    });

    const stocks = await variantStocks(db);
    expect(stocks.get("250g")).toBe(0);
  });
});
