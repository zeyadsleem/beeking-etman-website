import { afterAll, describe, expect, it } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { call } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import * as schema from "$lib/server/db/schema";
import { createDbRateLimiter } from "$lib/server/rate-limit";
import { ftsNormalizeSqlExpr } from "$lib/server/arabic";
import { searchRouter } from "./router";
import type { SearchRpcContext } from "./context";

const DB_FILE = "search-rpc-test.db";

let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client?.close();
  client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });

  await db.run(`DROP TABLE IF EXISTS store_product_image`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  await db.run(`DROP TRIGGER IF EXISTS store_product_fts_ai`);
  await db.run(`DROP TRIGGER IF EXISTS store_product_fts_ad`);
  await db.run(`DROP TRIGGER IF EXISTS store_product_fts_au`);
  await db.run(`DROP TABLE IF EXISTS store_product_fts`);
  await db.run(`DROP TABLE IF EXISTS store_rate_limit`);

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
  await db.run(`
    CREATE TABLE store_product_image (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      url TEXT NOT NULL,
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
      VALUES (
        new.id,
        ${ftsNormalizeSqlExpr("new.name")},
        ${ftsNormalizeSqlExpr("new.description")},
        ${ftsNormalizeSqlExpr("new.name_en")},
        ${ftsNormalizeSqlExpr("new.description_en")}
      );
    END`);
  await db.run(`
    CREATE TRIGGER store_product_fts_ad AFTER DELETE ON store_product BEGIN
      DELETE FROM store_product_fts WHERE product_id = old.id;
    END`);
  await db.run(`
    CREATE TRIGGER store_product_fts_au AFTER UPDATE ON store_product BEGIN
      DELETE FROM store_product_fts WHERE product_id = old.id;
      INSERT INTO store_product_fts(product_id, name, description, name_en, description_en)
      VALUES (
        new.id,
        ${ftsNormalizeSqlExpr("new.name")},
        ${ftsNormalizeSqlExpr("new.description")},
        ${ftsNormalizeSqlExpr("new.name_en")},
        ${ftsNormalizeSqlExpr("new.description_en")}
      );
    END`);

  const cat = (
    await db
      .insert(schema.category)
      .values({ name: "عسل السدر", nameEn: "Sidr Honey", slug: "sidr" })
      .returning({ id: schema.category.id, slug: schema.category.slug })
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
  await db.insert(schema.productVariant).values([
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
  ]);

  await db.insert(schema.productImage).values([
    { productId: p.id, url: "/s.jpg", sortOrder: 1 },
    { productId: p.id, url: "/s-1.jpg", sortOrder: 0 },
  ]);

  return { db, cat, p };
}

async function buildContext(
  db: LibSQLDatabase<typeof schema>,
  options: { max?: number } = {},
): Promise<SearchRpcContext> {
  await db.run(`DROP TABLE IF EXISTS store_rate_limit`);
  await db.run(`
    CREATE TABLE store_rate_limit (
      key TEXT NOT NULL, window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(key, window_start)
    )`);
  return {
    db,
    rateLimiter: createDbRateLimiter(db, { windowMs: 60_000, max: options.max ?? 30 }),
    clientAddress: "127.0.0.1",
    lang: "ar",
  };
}

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("search oRPC router", () => {
  it("returns matching products and categories", async () => {
    const { db, cat } = await buildDb();
    const ctx = await buildContext(db);
    const result = await call(searchRouter.suggestions, { q: "سدر" }, { context: ctx });
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.name).toBe("عسل سدر مصري");
    expect(result.products[0]?.categorySlug).toBe(cat.slug);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.slug).toBe("sidr");
  });

  it("localizes to English when lang=en", async () => {
    const { db } = await buildDb();
    const ctx = { ...(await buildContext(db)), lang: "en" as const };
    const result = await call(searchRouter.suggestions, { q: "Sidr" }, { context: ctx });
    expect(result.products[0]?.name).toBe("Egyptian Sidr Honey");
    expect(result.categories[0]?.name).toBe("Sidr Honey");
  });

  it("rejects queries shorter than 2 characters", async () => {
    const { db } = await buildDb();
    const ctx = await buildContext(db);
    await expect(call(searchRouter.suggestions, { q: "a" }, { context: ctx })).rejects.toThrow();
  });

  it("rejects queries longer than 100 characters", async () => {
    const { db } = await buildDb();
    const ctx = await buildContext(db);
    await expect(
      call(searchRouter.suggestions, { q: "x".repeat(101) }, { context: ctx }),
    ).rejects.toThrow();
  });

  it("enforces the rate limit and throws TOO_MANY_REQUESTS", async () => {
    const { db } = await buildDb();
    const ctx = await buildContext(db, { max: 1 });
    await call(searchRouter.suggestions, { q: "سدر" }, { context: ctx });
    await expect(
      call(searchRouter.suggestions, { q: "سدر" }, { context: ctx }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

describe("search oRPC HTTP boundary", () => {
  function rpcBody(input: unknown): string {
    return JSON.stringify({ json: input, meta: [] });
  }

  it("validates input at the HTTP boundary", async () => {
    const { db } = await buildDb();
    const ctx = await buildContext(db);
    const handler = new RPCHandler(searchRouter);
    const request = new Request("http://localhost/api/rpc/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rpcBody({ q: "a" }),
    });
    const { response } = await handler.handle(request, { prefix: "/api/rpc", context: ctx });
    expect(response?.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    const { db } = await buildDb();
    const ctx = await buildContext(db, { max: 1 });
    const handler = new RPCHandler(searchRouter);
    const first = new Request("http://localhost/api/rpc/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rpcBody({ q: "سدر" }),
    });
    await handler.handle(first, { prefix: "/api/rpc", context: ctx });
    const second = new Request("http://localhost/api/rpc/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rpcBody({ q: "سدر" }),
    });
    const { response } = await handler.handle(second, { prefix: "/api/rpc", context: ctx });
    expect(response?.status).toBe(429);
  });

  it("returns suggestions for valid requests", async () => {
    const { db } = await buildDb();
    const ctx = await buildContext(db);
    const handler = new RPCHandler(searchRouter);
    const request = new Request("http://localhost/api/rpc/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rpcBody({ q: "سدر" }),
    });
    const { response } = await handler.handle(request, { prefix: "/api/rpc", context: ctx });
    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body?.json?.products).toHaveLength(1);
  });
});
