import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";

// Seeding-heavy tests and per-test schema rebuilds brush against vitest
// defaults when the whole suite runs in parallel — same guard as the sibling
// admin specs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { isActionFailure, type RequestEvent } from "@sveltejs/kit";
import * as schema from "$lib/server/db/schema";
import { t } from "$lib/i18n/messages";
import { PRODUCTS_PAGE_SIZE } from "$lib/server/admin/products";

// The route imports the shared lazy `db` proxy; point it at this spec's
// file-backed client so load + actions are exercised end-to-end against real SQL.
const state = vi.hoisted(() => ({
  database: null as LibSQLDatabase<typeof schema> | null,
}));

vi.mock("$lib/server/db", () => ({
  get db(): LibSQLDatabase<typeof schema> {
    if (!state.database) throw new Error("test database not initialized");
    return state.database;
  },
}));

const DB_FILE = "admin-products-page-test.db";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

// The loader joins categories and variants and the delete action cascades
// images/variants while guarding order references; the DDL mirrors production
// migrations verbatim (see sibling lib/server/admin/products.spec.ts).
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
    CREATE TABLE store_product_image (
      id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL,
      url TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
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
  testDb = db;
  state.database = db;
}

async function seedCategory(name = "برسيم"): Promise<string> {
  const row = (
    await currentDb()
      .insert(schema.category)
      .values({ name, nameEn: "", slug: `cat-${crypto.randomUUID()}` })
      .returning({ id: schema.category.id })
  )[0];
  if (!row) throw new Error("seedCategory insert returned no row");
  return row.id;
}

interface ProductSeedOptions {
  name?: string;
  nameEn?: string;
  image?: string;
  featured?: number;
  createdAt?: number;
}

async function seedProduct(categoryId: string, opts: ProductSeedOptions = {}): Promise<string> {
  const row = (
    await currentDb()
      .insert(schema.product)
      .values({
        name: opts.name ?? "عسل سدر مصري",
        nameEn: opts.nameEn ?? "",
        slug: `p-${crypto.randomUUID()}`,
        description: "د",
        descriptionEn: "",
        price: 100_00,
        stock: 0,
        image: opts.image ?? "https://example.com/h.jpg",
        categoryId,
        featured: opts.featured ?? 0,
        createdAt: opts.createdAt ?? Date.now(),
      })
      .returning({ id: schema.product.id })
  )[0];
  if (!row) throw new Error("seedProduct insert returned no row");
  return row.id;
}

async function seedVariant(
  productId: string,
  opts: { name?: string; stock?: number } = {},
): Promise<void> {
  await currentDb()
    .insert(schema.productVariant)
    .values({
      productId,
      name: opts.name ?? "250g",
      nameEn: "",
      price: 150_00,
      stock: opts.stock ?? 5,
      image: "",
      sortOrder: 0,
    });
}

async function seedImage(productId: string): Promise<void> {
  await currentDb()
    .insert(schema.productImage)
    .values({ productId, url: "https://example.com/gallery.jpg", sortOrder: 0 });
}

let orderCounter = 0;

/** Seeds an order holding one line of the given product (delete-guard fixture). */
async function seedOrderItemFor(productId: string): Promise<void> {
  orderCounter += 1;
  const orderId = crypto.randomUUID();
  const db = currentDb();
  await db.insert(schema.order).values({
    id: orderId,
    number: `HNY-${String(orderCounter).padStart(6, "0")}`,
    email: "a@example.com",
    name: "أحمد",
    phone: "01012345678",
    address: "شارع 9",
    city: "القاهرة",
    total: 100_00,
    status: "paid",
    userId: null,
    createdAt: Date.now(),
  });
  await db.insert(schema.orderItem).values({
    orderId,
    productId,
    productName: "عسل سدر مصري",
    variantName: "250g",
    quantity: 1,
    unitPrice: 100_00,
  });
}

interface EventOptions {
  role?: string;
  langCookie?: "ar" | "en";
}

// The loader reads `url`, `cookies.get`, and request headers (getLang); the
// action additionally reads `locals.user?.role` — fabricate exactly that surface.
function fakeEvent(
  url: string,
  formData?: Record<string, string>,
  opts: EventOptions = {},
): RequestEvent {
  const body = new FormData();
  if (formData) for (const [key, value] of Object.entries(formData)) body.set(key, value);
  return {
    // Base lets callers pass either a full URL (load) or a path (actions).
    url: new URL(url, "http://localhost"),
    cookies: { get: (name: string) => (name === "lang" ? opts.langCookie : undefined) },
    request: new Request("http://localhost/admin/products", { method: "POST", body }),
    locals: { user: opts.role === undefined ? undefined : { role: opts.role } },
  } as unknown as RequestEvent;
}

// Test-only narrowing, mirroring the sibling categories page spec: actions
// return plain results or ActionFailures.
function failureOf(result: unknown): { status: number; message: string } {
  if (!isActionFailure(result)) throw new Error("expected an ActionFailure");
  const data = result.data as { message?: string } | undefined;
  return { status: result.status, message: data?.message ?? "" };
}

type LoadFn = (event: RequestEvent) => Promise<unknown>;
type DeleteAction = (event: RequestEvent) => Promise<unknown>;

let load: LoadFn;
let remove: DeleteAction;

beforeAll(async () => {
  const module = await import("./+page.server");
  load = module.load as unknown as LoadFn;
  remove = (module.actions as { delete: DeleteAction }).delete;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

describe("admin products page load", () => {
  it("returns the newest-first first page with totals, thumbnails, and defaults", async () => {
    const base = 1_700_000_000_000;
    const categoryId = await seedCategory();
    const createdIds: string[] = [];
    for (let i = 0; i < PRODUCTS_PAGE_SIZE + 5; i++) {
      createdIds.push(await seedProduct(categoryId, { createdAt: base + i * 1_000 }));
    }

    const data = (await load(fakeEvent("http://localhost/admin/products"))) as {
      items: { id: string }[];
      total: number;
      page: number;
      pageSize: number;
      query: string;
      lang: string;
      images: Record<string, string>;
    };

    expect(data.items).toHaveLength(PRODUCTS_PAGE_SIZE);
    expect(data.total).toBe(PRODUCTS_PAGE_SIZE + 5);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(PRODUCTS_PAGE_SIZE);
    expect(data.query).toBe("");
    expect(data.lang).toBe("ar"); // no cookie/header → Arabic default
    expect(data.items[0]?.id).toBe(createdIds[PRODUCTS_PAGE_SIZE + 4]);
    // Every listed product carries its product-level image for the thumbnail.
    expect(Object.keys(data.images)).toHaveLength(PRODUCTS_PAGE_SIZE);
    for (const item of data.items) {
      expect(data.images[item.id]).toBe("https://example.com/h.jpg");
    }
  });

  it("serves the requested page slice", async () => {
    const base = 1_700_000_000_000;
    const categoryId = await seedCategory();
    const createdIds: string[] = [];
    for (let i = 0; i < PRODUCTS_PAGE_SIZE + 5; i++) {
      createdIds.push(await seedProduct(categoryId, { createdAt: base + i * 1_000 }));
    }

    const data = (await load(fakeEvent("http://localhost/admin/products?page=2"))) as {
      items: { id: string }[];
      page: number;
    };

    expect(data.page).toBe(2);
    expect(data.items.map((p) => p.id)).toEqual(createdIds.slice(0, 5).reverse());
  });

  it("clamps an out-of-range page to the last page instead of an empty list", async () => {
    const base = 1_700_000_000_000;
    const categoryId = await seedCategory();
    const createdIds: string[] = [];
    for (let i = 0; i < PRODUCTS_PAGE_SIZE + 5; i++) {
      createdIds.push(await seedProduct(categoryId, { createdAt: base + i * 1_000 }));
    }

    // Beyond-the-last page must land on the final page's items — never a
    // false "No products." dead end. Also covers float64-huge values that
    // survive zod as integers (same empty-items branch).
    const clamped = (await load(fakeEvent("http://localhost/admin/products?page=99"))) as {
      page: number;
      total: number;
      items: { id: string }[];
    };
    expect(clamped.page).toBe(2);
    expect(clamped.total).toBe(PRODUCTS_PAGE_SIZE + 5);
    expect(clamped.items.map((p) => p.id)).toEqual(createdIds.slice(0, 5).reverse());

    const huge = (await load(
      fakeEvent(`http://localhost/admin/products?page=${Number.MAX_SAFE_INTEGER}`),
    )) as { page: number; items: unknown[] };
    expect(huge.page).toBe(2);
    expect(huge.items).toHaveLength(5);
  });

  it.each([
    ["?page=abc", 1],
    ["?page=NaN", 1],
    ["?page=0", 1],
    ["?page=-3", 1],
    ["?page=2.9", 2],
  ])("normalizes %s to page %i so NaN offsets can never reach the DB", async (query, expected) => {
    const base = 1_700_000_000_000;
    const categoryId = await seedCategory();
    for (let i = 0; i < PRODUCTS_PAGE_SIZE + 5; i++) {
      await seedProduct(categoryId, { createdAt: base + i * 1_000 });
    }

    const data = (await load(fakeEvent(`http://localhost/admin/products${query}`))) as {
      page: number;
      items: unknown[];
    };

    expect(data.page).toBe(expected);
    // Page-1 content proves NaN never produced a bogus offset.
    if (expected === 1) expect(data.items).toHaveLength(PRODUCTS_PAGE_SIZE);
    if (expected === 2) expect(data.items).toHaveLength(5);
  });

  it("passes the trimmed q param through to the name filter", async () => {
    const categoryId = await seedCategory();
    const sidr = await seedProduct(categoryId, { name: "عسل السدر الملكي", nameEn: "Royal Sidr" });
    await seedProduct(categoryId, { name: "زيت الزيتون", nameEn: "Olive Oil" });
    await seedProduct(categoryId, { name: "  عرض خاص  ", nameEn: "" });

    const data = (await load(fakeEvent("http://localhost/admin/products?q=%20سدر%20"))) as {
      total: number;
      items: { id: string }[];
      query: string;
    };

    expect(data.query).toBe("سدر"); // trimmed before filtering and re-rendering
    expect(data.total).toBe(1);
    expect(data.items.map((p) => p.id)).toEqual([sidr]);
  });

  it("resolves lang from the lang cookie", async () => {
    const categoryId = await seedCategory();
    await seedProduct(categoryId);

    const data = (await load(
      fakeEvent("http://localhost/admin/products", undefined, { langCookie: "en" }),
    )) as { lang: string };

    expect(data.lang).toBe("en");
  });
});

describe("admin products delete action", () => {
  it("rejects guests and non-admins with 403 even though the layout guards pages", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    for (const role of [undefined, "user"] as const) {
      const result = failureOf(
        await remove(fakeEvent("/admin/products", { id }, role ? { role } : {})),
      );
      expect(result.status).toBe(403);
      expect(result.message).toBe(t("ar", "errors.unexpected"));
    }
    const rows = await currentDb().select().from(schema.product);
    expect(rows).toHaveLength(1); // untouched
  });

  it("rejects a blank id with a 400 unexpected failure", async () => {
    const result = failureOf(await remove(fakeEvent("/admin/products", {}, { role: "admin" })));

    expect(result.status).toBe(400);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("maps a vanished product to 404", async () => {
    const result = failureOf(
      await remove(fakeEvent("/admin/products", { id: crypto.randomUUID() }, { role: "admin" })),
    );

    expect(result.status).toBe(404);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("blocks deleting a product referenced by orders with a 409 localized message", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    await seedOrderItemFor(id);

    const blockedAr = failureOf(
      await remove(fakeEvent("/admin/products", { id }, { role: "admin" })),
    );
    expect(blockedAr.status).toBe(409);
    expect(blockedAr.message).toBe(t("ar", "admin.products.referencedByOrders"));
    const stillThere = await currentDb().select().from(schema.product);
    expect(stillThere).toHaveLength(1); // untouched

    const blockedEn = failureOf(
      await remove(fakeEvent("/admin/products", { id }, { role: "admin", langCookie: "en" })),
    );
    expect(blockedEn.message).toBe(t("en", "admin.products.referencedByOrders"));
  });

  it("deletes an unreferenced product plus its variants and gallery images", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    await seedVariant(id, { name: "250g" });
    await seedVariant(id, { name: "1kg", stock: 3 });
    await seedImage(id);

    const result = await remove(fakeEvent("/admin/products", { id }, { role: "admin" }));

    expect(result).toEqual({ deleted: true });
    const products = await currentDb().select().from(schema.product);
    expect(products).toHaveLength(0);
    const variants = await currentDb()
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, id));
    expect(variants).toHaveLength(0);
    const images = await currentDb()
      .select()
      .from(schema.productImage)
      .where(eq(schema.productImage.productId, id));
    expect(images).toHaveLength(0);
  });
});
