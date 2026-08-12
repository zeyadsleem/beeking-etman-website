import { afterAll, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { createOrder } from "./orders";
import type { Customer } from "./orders";

const DB_FILE = "orders-test.db";

async function buildDb() {
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  await db.run(`
    CREATE TABLE IF NOT EXISTS store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE
    )`);
  await db.run(`
    CREATE TABLE IF NOT EXISTS store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL, category_id TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE IF NOT EXISTS store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid', user_id TEXT, created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE IF NOT EXISTS store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      product_name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )`);
  const inserted = await db
    .insert(schema.category)
    .values({ name: "عسل", slug: "sidr" })
    .returning({ id: schema.category.id });
  return { db, catId: inserted[0].id };
}

const customer: Customer = {
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  address: "شارع 9",
  city: "القاهرة",
};

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("createOrder", () => {
  it("creates an order and decrements stock", async () => {
    const { db, catId } = await buildDb();
    const p = (
      await db
        .insert(schema.product)
        .values({
          name: "عسل سدر",
          slug: "sidr",
          description: "د",
          price: 380_00,
          stock: 3,
          image: "https://example.com/h.jpg",
          categoryId: catId,
          featured: 0,
          createdAt: Date.now(),
        })
        .returning()
    )[0];

    const result = await createOrder(db, [{ productId: p.id, quantity: 2 }], customer, undefined);

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
    const stock = await db.select().from(schema.product).where(eq(schema.product.id, p.id)).get();
    expect(stock?.stock).toBe(1);
    const items = await db
      .select()
      .from(schema.orderItem)
      .where(eq(schema.orderItem.orderId, result.orderId));
    expect(items).toEqual([
      expect.objectContaining({ productName: "عسل سدر", quantity: 2, unitPrice: 380_00 }),
    ]);
  });

  it("rejects an empty cart", async () => {
    const { db } = await buildDb();
    const result = await createOrder(db, [], customer);
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-stock and writes nothing", async () => {
    const { db, catId } = await buildDb();
    const p = (
      await db
        .insert(schema.product)
        .values({
          name: "عسل برتقال",
          slug: "orange",
          description: "د",
          price: 260_00,
          stock: 1,
          image: "https://example.com/o.jpg",
          categoryId: catId,
          featured: 0,
          createdAt: Date.now(),
        })
        .returning()
    )[0];

    const result = await createOrder(db, [{ productId: p.id, quantity: 5 }], customer);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("عسل برتقال");
    expect(await db.select().from(schema.order)).toEqual([]);
    const stock = await db.select().from(schema.product).where(eq(schema.product.id, p.id)).get();
    expect(stock?.stock).toBe(1);
  });
});
