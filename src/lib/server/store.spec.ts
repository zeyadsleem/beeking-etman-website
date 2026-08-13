import { afterAll, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { getProductWithVariants, listProducts, resolveCartItems } from "./store";

const DB_FILE = "store-test.db";

async function buildDb() {
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  await db.run(`
    CREATE TABLE store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE
    )`);
  await db.run(`
    CREATE TABLE store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL, category_id TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_product_variant (
      id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL,
      price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
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
        description: "سدر مصري",
        price: 0,
        stock: 0,
        image: "https://example.com/s.jpg",
        categoryId: cat.id,
        featured: 1,
        createdAt: Date.now(),
      })
      .returning()
  )[0];
  const variants = await db
    .insert(schema.productVariant)
    .values([
      {
        productId: p.id,
        name: "1 ك",
        price: 700_00,
        stock: 4,
        image: "https://example.com/s.jpg",
        sortOrder: 1,
      },
      {
        productId: p.id,
        name: "500 جرام",
        price: 380_00,
        stock: 6,
        image: "https://example.com/s.jpg",
        sortOrder: 0,
      },
    ])
    .returning();
  return { db, p, cat, v1: variants.find((v) => v.name === "500 جرام")! };
}

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("store queries with variants", () => {
  it("returns variants sorted by sortOrder with minPrice", async () => {
    const { db } = await buildDb();
    const product = await getProductWithVariants(db, "sidr-egyptian");
    expect(product?.variants.map((v) => v.name)).toEqual(["500 جرام", "1 ك"]);
    expect(product?.minPrice).toBe(380_00);
  });

  it("sorts price-asc by minPrice", async () => {
    const { db } = await buildDb();
    const rows = await listProducts(db, { sort: "price-asc" });
    expect(rows[0].minPrice).toBe(380_00);
  });

  it("resolveCartItems joins variant info and clamps to stock", async () => {
    const { db, v1 } = await buildDb();
    const items = await resolveCartItems(db, [{ variantId: v1.id, quantity: 99 }]);
    expect(items).toHaveLength(1);
    expect(items[0].variantName).toBe("500 جرام");
    expect(items[0].quantity).toBe(6);
    expect(items[0].price).toBe(380_00);
  });

  it("resolveCartItems drops unknown variants", async () => {
    const { db } = await buildDb();
    expect(await resolveCartItems(db, [{ variantId: "nope", quantity: 1 }])).toEqual([]);
  });
});
