import { afterAll, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { createOrder, isNonceConflict } from "./orders";
import { isBusyError } from "$lib/server/sqlite";
import type { Customer } from "./orders";

const DB_FILE = "orders-test.db";

let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client?.close();
  client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
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
  const cat = (
    await db
      .insert(schema.category)
      .values({ name: "عسل السدر", slug: "sidr" })
      .returning({ id: schema.category.id })
  )[0];
  const p = (
    await db
      .insert(schema.product)
      .values({
        name: "عسل سدر مصري",
        slug: "sidr-egyptian",
        description: "د",
        price: 0,
        stock: 0,
        image: "https://example.com/h.jpg",
        categoryId: cat.id,
        featured: 0,
        createdAt: Date.now(),
      })
      .returning()
  )[0];
  const v = (
    await db
      .insert(schema.productVariant)
      .values({
        productId: p.id,
        name: "500 جرام",
        price: 380_00,
        stock: 3,
        image: "https://example.com/h.jpg",
        sortOrder: 0,
      })
      .returning()
  )[0];
  return { db, p, v };
}

const customer: Customer = {
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  address: "شارع 9",
  city: "القاهرة",
};

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("createOrder", () => {
  it("creates an order, decrements variant stock, stores variantName", async () => {
    const { db, v } = await buildDb();
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 2 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(380_00 * 2);
    expect(result.orderNumber).toMatch(/^HNY-\d{6}$/);

    const order = await db
      .select()
      .from(schema.order)
      .where(eq(schema.order.id, result.orderId))
      .get();
    expect(order?.number).toBe(result.orderNumber);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(1);
    const items = await db
      .select()
      .from(schema.orderItem)
      .where(eq(schema.orderItem.orderId, result.orderId));
    expect(items).toEqual([
      expect.objectContaining({
        productName: "عسل سدر مصري",
        variantName: "500 جرام",
        quantity: 2,
        unitPrice: 380_00,
      }),
    ]);
  });

  it("rejects an empty cart", async () => {
    const { db } = await buildDb();
    const result = await createOrder(db, [], customer, crypto.randomUUID());
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-stock and writes nothing", async () => {
    const { db, v } = await buildDb();
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 5 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("عسل سدر مصري");
    expect(await db.select().from(schema.order)).toEqual([]);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(3);
  });

  it("returns the same order for a replayed nonce (idempotency)", async () => {
    const { db, v } = await buildDb();
    const nonce = crypto.randomUUID();
    const first = await createOrder(db, [{ variantId: v.id, quantity: 1 }], customer, nonce);
    const second = await createOrder(db, [{ variantId: v.id, quantity: 1 }], customer, nonce);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.orderId).toBe(first.orderId);
    expect(second.orderNumber).toBe(first.orderNumber);
    expect(second.total).toBe(first.total);

    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(2);
    const orders = await db.select().from(schema.order);
    expect(orders).toHaveLength(1);
  });
});

describe("isNonceConflict", () => {
  it("returns true when the error message references store_order.nonce", () => {
    expect(isNonceConflict(new Error("UNIQUE constraint failed: store_order.nonce"))).toBe(true);
  });

  it("returns false when only the code is SQLITE_CONSTRAINT_UNIQUE", () => {
    const error = new Error("constraint failed") as Error & { code: string };
    error.code = "SQLITE_CONSTRAINT_UNIQUE";
    expect(isNonceConflict(error)).toBe(false);
  });

  it("returns false for unrelated errors", () => {
    expect(isNonceConflict(new Error("database is locked"))).toBe(false);
    expect(isNonceConflict(new Error("OUT_OF_STOCK:عسل سدر مصري"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isNonceConflict(null)).toBe(false);
    expect(isNonceConflict({ message: "store_order.nonce" })).toBe(false);
    expect(isNonceConflict("store_order.nonce")).toBe(false);
  });
});

describe("isBusyError", () => {
  it("returns true when the error code is SQLITE_BUSY", () => {
    const error = new Error("database is locked") as Error & { code: string };
    error.code = "SQLITE_BUSY";
    expect(isBusyError(error)).toBe(true);
  });

  it("returns true when the message mentions a locked database", () => {
    expect(isBusyError(new Error("database is locked"))).toBe(true);
  });

  it("returns false for unrelated and non-Error values", () => {
    expect(isBusyError(new Error("OUT_OF_STOCK:عسل سدر مصري"))).toBe(false);
    expect(isBusyError(null)).toBe(false);
  });
});
