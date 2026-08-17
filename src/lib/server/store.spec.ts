import { afterAll, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { isBlendItem } from "$lib/cart";
import { getProductWithVariants, listProducts, resolveCartItems } from "./store";

const DB_FILE = "store-test.db";

let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client?.close();
  client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  await db.run(`DROP TRIGGER IF EXISTS store_product_fts_ai`);
  await db.run(`DROP TRIGGER IF EXISTS store_product_fts_ad`);
  await db.run(`DROP TRIGGER IF EXISTS store_product_fts_au`);
  await db.run(`DROP TABLE IF EXISTS store_product_fts`);
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
    CREATE VIRTUAL TABLE store_product_fts USING fts5(
      product_id UNINDEXED,
      name,
      description,
      name_en,
      description_en,
      tokenize = 'unicode61'
    )`);
  await db.run(`
    CREATE TRIGGER store_product_fts_ai AFTER INSERT ON store_product BEGIN
      INSERT INTO store_product_fts(product_id, name, description, name_en, description_en)
      VALUES (new.id, new.name, new.description, new.name_en, new.description_en);
    END`);
  await db.run(`
    CREATE TRIGGER store_product_fts_ad AFTER DELETE ON store_product BEGIN
      DELETE FROM store_product_fts WHERE product_id = old.id;
    END`);
  await db.run(`
    CREATE TRIGGER store_product_fts_au AFTER UPDATE ON store_product BEGIN
      DELETE FROM store_product_fts WHERE product_id = old.id;
      INSERT INTO store_product_fts(product_id, name, description, name_en, description_en)
      VALUES (new.id, new.name, new.description, new.name_en, new.description_en);
    END`);
  const cat = (
    await db
      .insert(schema.category)
      .values({ name: "عسل السدر", nameEn: "Sidr Honey", slug: "sidr" })
      .returning({ id: schema.category.id })
  )[0];
  const p = (
    await db
      .insert(schema.product)
      .values({
        name: "عسل سدر مصري",
        nameEn: "Egyptian Sidr Honey",
        slug: "sidr-egyptian",
        description: "سدر مصري",
        descriptionEn: "Egyptian Sidr",
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
        nameEn: "1kg",
        price: 700_00,
        stock: 4,
        image: "https://example.com/s.jpg",
        sortOrder: 1,
      },
      {
        productId: p.id,
        name: "500 جرام",
        nameEn: "500g",
        price: 380_00,
        stock: 6,
        image: "https://example.com/s.jpg",
        sortOrder: 0,
      },
    ])
    .returning();
  return { db, p, cat, variants, v1: variants.find((v) => v.name === "500 جرام")! };
}

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("store queries with variants", () => {
  it("returns variants sorted by sortOrder with minPrice", async () => {
    const { db } = await buildDb();
    const product = await getProductWithVariants(db, "sidr-egyptian");
    expect(product?.variants.map((v) => v.name)).toEqual(["500 جرام", "1 ك"]);
    expect(product?.minPrice).toBe(380_00);
  });

  it("searches by name", async () => {
    const { db } = await buildDb();
    const rows = await listProducts(db, { query: "سدر" });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("عسل سدر مصري");
  });

  it("localizes to English when lang=en", async () => {
    const { db } = await buildDb();
    const product = await getProductWithVariants(db, "sidr-egyptian", "en");
    expect(product?.name).toBe("Egyptian Sidr Honey");
    expect(product?.description).toBe("Egyptian Sidr");
    expect(product?.variants.map((v) => v.name)).toEqual(["500g", "1kg"]);
  });

  it("searches by English name", async () => {
    const { db } = await buildDb();
    const rows = await listProducts(db, { query: "Sidr" }, "en");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Egyptian Sidr Honey");
  });

  it("resolveCartItems joins variant info and clamps to stock", async () => {
    const { db, v1 } = await buildDb();
    const { items, missing } = await resolveCartItems(db, [{ variantId: v1.id, quantity: 99 }]);
    expect(missing).toEqual([]);
    expect(items).toHaveLength(1);
    const [first] = items;
    if (isBlendItem(first)) throw new Error("expected regular item");
    expect(first.variantName).toBe("500 جرام");
    expect(first.quantity).toBe(6);
    expect(first.price).toBe(380_00);
  });

  it("resolveCartItems drops unknown variants", async () => {
    const { db } = await buildDb();
    expect(await resolveCartItems(db, [{ variantId: "nope", quantity: 1 }])).toEqual({
      items: [],
      missing: ["nope"],
    });
  });

  it("resolveCartItems builds a blend line with base + additive", async () => {
    const { db, v1, variants } = await buildDb();
    const additive = variants.find((v) => v.name === "1 ك")!;
    const { items, missing } = await resolveCartItems(db, [
      {
        kind: "blend",
        id: "blend-x",
        baseVariantId: v1.id,
        jarSize: "half",
        additives: [{ key: "propolis", variantId: additive.id, qty: 2 }],
      },
    ]);
    expect(missing).toEqual([]);
    expect(items).toHaveLength(1);
    const b = items[0];
    if (!isBlendItem(b)) throw new Error("expected blend item");
    expect(b.name).toBe("عسل سدر مصري");
    expect(b.variantName).toBe("نص كيلو");
    expect(b.basePrice).toBe(380_00);
    expect(b.additives).toHaveLength(1);
    expect(b.additives[0].name).toBe("بروبليس");
    expect(b.additives[0].qty).toBe(2);
    expect(b.additives[0].price).toBe(700_00);
    expect(b.additives[0].stock).toBe(4);
  });

  it("resolveCartItems clamps blend additive quantity to stock", async () => {
    const { db, v1, variants } = await buildDb();
    const additive = variants.find((v) => v.name === "1 ك")!;
    const { items } = await resolveCartItems(db, [
      {
        kind: "blend",
        id: "blend-x",
        baseVariantId: v1.id,
        jarSize: "full",
        additives: [{ key: "royalJelly", variantId: additive.id, qty: 99 }],
      },
    ]);
    const b = items[0];
    if (!isBlendItem(b)) throw new Error("expected blend item");
    expect(b.variantName).toBe("كيلو");
    expect(b.additives[0].qty).toBe(4);
  });

  it("resolveCartItems reports missing blend base variant", async () => {
    const { db } = await buildDb();
    const { items, missing } = await resolveCartItems(db, [
      { kind: "blend", id: "blend-y", baseVariantId: "nope", jarSize: "full", additives: [] },
    ]);
    expect(items).toEqual([]);
    expect(missing).toEqual(["nope"]);
  });
});
