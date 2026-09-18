import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import type { RequestEvent } from "@sveltejs/kit";
import * as schema from "$lib/server/db/schema";

// The route imports the shared lazy `db` proxy; point it at this spec's
// file-backed client so GET runs against real SQL.
const state = vi.hoisted(() => ({
  database: null as LibSQLDatabase<typeof schema> | null,
}));

vi.mock("$lib/server/db", () => ({
  get db(): LibSQLDatabase<typeof schema> {
    if (!state.database) throw new Error("test database not initialized");
    return state.database;
  },
}));

const DB_FILE = "sitemap-route-test.db";
const ORIGIN = "https://beeking-etman-website.pages.dev";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

async function buildDb(): Promise<void> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
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
  testDb = db;
  state.database = db;
}

async function seedCategory(slug: string, department = "honey"): Promise<string> {
  const row = (
    await currentDb()
      .insert(schema.category)
      .values({ name: "سدر", nameEn: "", slug, department })
      .returning({ id: schema.category.id })
  )[0];
  if (!row) throw new Error("seedCategory insert returned no row");
  return row.id;
}

interface ProductSeedOptions {
  slug?: string;
  published?: boolean;
  createdAt?: number;
}

async function seedProduct(categoryId: string, opts: ProductSeedOptions = {}): Promise<string> {
  const row = (
    await currentDb()
      .insert(schema.product)
      .values({
        name: "عسل سدر مصري",
        nameEn: "",
        slug: opts.slug ?? `p-${crypto.randomUUID()}`,
        description: "د",
        descriptionEn: "",
        price: 100_00,
        stock: 5,
        image: "https://example.com/h.jpg",
        categoryId,
        published: opts.published ?? true,
        createdAt: opts.createdAt ?? Date.now(),
      })
      .returning({ id: schema.product.id })
  )[0];
  if (!row) throw new Error("seedProduct insert returned no row");
  return row.id;
}

type GetHandler = (event: RequestEvent) => Promise<Response>;

let GET: GetHandler;
let body: string;

beforeAll(async () => {
  const module = await import("./+server");
  GET = module.GET as unknown as GetHandler;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

async function fetchSitemap(): Promise<string> {
  const response = await GET({} as RequestEvent);
  expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
  return response.text();
}

describe("sitemap.xml", () => {
  it("lists the static entry points and the products page", async () => {
    body = await fetchSitemap();

    for (const path of ["/", "/products", "/honey", "/equipment", "/blends", "/about"]) {
      expect(body).toContain(`<loc>${ORIGIN}${path}</loc>`);
    }
  });

  it("lists each category and each published product under its department and category", async () => {
    const createdAt = Date.UTC(2026, 8, 1);
    const categoryId = await seedCategory("sidr", "honey");
    await seedProduct(categoryId, { slug: "honey-sidr", createdAt });

    body = await fetchSitemap();

    expect(body).toContain(`<loc>${ORIGIN}/honey/sidr</loc>`);
    expect(body).toContain(
      `<loc>${ORIGIN}/honey/sidr/honey-sidr</loc><lastmod>2026-09-01</lastmod>`,
    );
  });

  it("omits unpublished products while keeping their category", async () => {
    const categoryId = await seedCategory("sidr", "honey");
    await seedProduct(categoryId, { slug: "published-honey" });
    await seedProduct(categoryId, { slug: "hidden-honey", published: false });

    body = await fetchSitemap();

    expect(body).toContain(`<loc>${ORIGIN}/honey/sidr/published-honey</loc>`);
    expect(body).not.toContain("hidden-honey");
    expect(body).toContain(`<loc>${ORIGIN}/honey/sidr</loc>`);
  });

  it("escapes XML metacharacters in slugs", async () => {
    const categoryId = await seedCategory("d&e");
    await seedProduct(categoryId, { slug: "a&b<c" });

    body = await fetchSitemap();

    expect(body).toContain(`<loc>${ORIGIN}/honey/d&amp;e/a&amp;b&lt;c</loc>`);
    expect(body).not.toContain("d&e");
  });
});
