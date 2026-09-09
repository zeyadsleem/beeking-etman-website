import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";

// Seeding-heavy tests and per-test schema rebuilds brush against vitest's
// 5s/10s defaults when the whole suite runs in parallel — same guard as the
// sibling admin orders specs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import {
  PRODUCTS_PAGE_SIZE,
  createProduct,
  deleteProduct,
  deleteVariant,
  generateSlug,
  getProductForEdit,
  listAdminProducts,
  productInputSchema,
  updateProduct,
  upsertVariant,
  variantInputSchema,
  type ProductInput,
  type VariantInput,
} from "./products";

const DB_FILE = "admin-products-test.db";

// One client for the whole file: reopening the same file after an unlink can
// strand open handles (SQLITE_READONLY_DBMOVED), so rebuilds drop/recreate
// tables on this client instead of deleting the database.
let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`PRAGMA foreign_keys = ON`);
  await db.run(`DROP TABLE IF EXISTS store_stock_conversion`);
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`DROP TABLE IF EXISTS store_product_image`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  // Mirrors production migrations verbatim (see sibling admin/orders.spec.ts):
  // 0000 (category/product/order/order_item), 0001 (variants), 0002 (nonce
  // unique), 0004 (name_en columns), 0005 (product images), 0006 (indexes incl.
  // the variant (product_id, name) unique index).
  await db.run(`
    CREATE TABLE store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE, department TEXT NOT NULL DEFAULT 'honey', parent_id TEXT
    )`);
  await db.run(`
    CREATE TABLE store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      description_en TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      category_id TEXT NOT NULL, department TEXT NOT NULL DEFAULT 'honey',
      featured INTEGER NOT NULL DEFAULT 0, sku TEXT, published INTEGER NOT NULL DEFAULT 1,
      cost_price INTEGER, weight_grams INTEGER, created_at INTEGER NOT NULL
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
      status TEXT NOT NULL DEFAULT 'placed', payment_status TEXT NOT NULL DEFAULT 'simulated', stock_version TEXT NOT NULL DEFAULT 'legacy', user_id TEXT, created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      variant_id TEXT REFERENCES store_product_variant(id),
      product_name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )`);
  await db.run(`CREATE TABLE store_stock_conversion (
    id TEXT PRIMARY KEY NOT NULL,
    variant_id TEXT NOT NULL REFERENCES store_product_variant(id)
  )`);
  return db;
}

async function seedCategory(
  db: Awaited<ReturnType<typeof buildDb>>,
  values: { name?: string } = {},
): Promise<string> {
  const row = (
    await db
      .insert(schema.category)
      .values({
        name: values.name ?? "عسل",
        nameEn: "",
        slug: `cat-${crypto.randomUUID()}`,
      })
      .returning({ id: schema.category.id })
  )[0];
  if (!row) throw new Error("seedCategory insert returned no row");
  return row.id;
}

async function seedProduct(
  db: Awaited<ReturnType<typeof buildDb>>,
  categoryId: string,
  opts: {
    name?: string;
    nameEn?: string;
    slug?: string;
    price?: number;
    featured?: number;
    createdAt?: number;
  } = {},
): Promise<string> {
  const row = (
    await db
      .insert(schema.product)
      .values({
        name: opts.name ?? "عسل سدر مصري",
        nameEn: opts.nameEn ?? "",
        slug: opts.slug ?? `p-${crypto.randomUUID()}`,
        description: "د",
        descriptionEn: "",
        price: opts.price ?? 100_00,
        stock: 0,
        image: "https://example.com/h.jpg",
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
  db: Awaited<ReturnType<typeof buildDb>>,
  productId: string,
  opts: { name?: string; price?: number; stock?: number; sortOrder?: number } = {},
): Promise<string> {
  const row = (
    await db
      .insert(schema.productVariant)
      .values({
        productId,
        name: opts.name ?? "250g",
        nameEn: "",
        price: opts.price ?? 150_00,
        stock: opts.stock ?? 5,
        image: "https://example.com/v.jpg",
        sortOrder: opts.sortOrder ?? 0,
      })
      .returning({ id: schema.productVariant.id })
  )[0];
  if (!row) throw new Error("seedVariant insert returned no row");
  return row.id;
}

async function seedImage(
  db: Awaited<ReturnType<typeof buildDb>>,
  productId: string,
): Promise<string> {
  const row = (
    await db
      .insert(schema.productImage)
      .values({ productId, url: "https://example.com/gallery.jpg", sortOrder: 0 })
      .returning({ id: schema.productImage.id })
  )[0];
  if (!row) throw new Error("seedImage insert returned no row");
  return row.id;
}

let orderCounter = 0;

async function seedOrderWithItem(
  db: Awaited<ReturnType<typeof buildDb>>,
  productId: string,
): Promise<void> {
  orderCounter += 1;
  const orderId = crypto.randomUUID();
  await db.insert(schema.order).values({
    id: orderId,
    number: `HNY-${String(orderCounter).padStart(6, "0")}`,
    email: "a@example.com",
    name: "أحمد",
    phone: "01012345678",
    address: "شارع 9",
    city: "القاهرة",
    total: 100_00,
    status: "placed",
    paymentStatus: "simulated",
    userId: null,
    createdAt: Date.now(),
  });
  await db.insert(schema.orderItem).values({
    orderId,
    productId,
    variantId: null,
    productName: "عسل سدر مصري",
    variantName: "250g",
    quantity: 1,
    unitPrice: 100_00,
  });
}

function productInput(categoryId: string, overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "عسل سدر جبلي",
    nameEn: "Mountain Sidr Honey",
    description: "وصف المنتج الكامل",
    descriptionEn: "Full product description",
    categoryId,
    featured: false,
    department: "honey",
    ...overrides,
  };
}

function variantInput(
  overrides: Partial<VariantInput> & { id?: string } = {},
): VariantInput & { id?: string } {
  return {
    name: "250g",
    nameEn: "",
    price: 150_00,
    stock: 5,
    image: "",
    sortOrder: 0,
    ...overrides,
  };
}

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("productInputSchema", () => {
  it("accepts a minimal payload and fills the nameEn/descriptionEn/featured defaults", () => {
    const categoryId = crypto.randomUUID();
    const parsed = productInputSchema.parse({
      name: "عسل السدر",
      description: "عسل طبيعي",
      price: 100_00,
      categoryId,
    });
    expect(parsed).toEqual({
      name: "عسل السدر",
      nameEn: "",
      description: "عسل طبيعي",
      descriptionEn: "",
      categoryId,
      featured: false,
      department: "honey",
    });
  });

  it("rejects an empty or whitespace-only name or description", () => {
    const base = { description: "د", price: 1, categoryId: crypto.randomUUID() };
    expect(productInputSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, name: "ن", description: "" }).success).toBe(
      false,
    );
  });

  it("rejects names above 200 chars and descriptions above 5000 chars", () => {
    const categoryId = crypto.randomUUID();
    expect(
      productInputSchema.safeParse({
        name: "ع".repeat(201),
        description: "د",
        price: 1,
        categoryId,
      }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({
        name: "ن",
        description: "د".repeat(5001),
        price: 1,
        categoryId,
      }).success,
    ).toBe(false);
  });

  it("ignores retired product prices", () => {
    const base = { name: "ن", description: "د", categoryId: crypto.randomUUID() };
    expect(productInputSchema.parse({ ...base, price: 0 })).not.toHaveProperty("price");
    expect(productInputSchema.parse(base)).not.toHaveProperty("price");
  });
});

describe("variantInputSchema", () => {
  it("accepts a minimal payload and fills the nameEn/image/sortOrder defaults", () => {
    expect(variantInputSchema.parse({ name: "250g", price: 150_00, stock: 5 })).toEqual({
      name: "250g",
      nameEn: "",
      price: 150_00,
      stock: 5,
      image: "",
      sortOrder: 0,
    });
  });

  it("allows zero stock but rejects negative stock", () => {
    const base = { name: "v", price: 1 };
    expect(variantInputSchema.safeParse({ ...base, stock: 0 }).success).toBe(true);
    expect(variantInputSchema.safeParse({ ...base, stock: -1 }).success).toBe(false);
  });

  it("rejects prices that are zero, negative, or fractional", () => {
    const base = { name: "v", stock: 0 };
    expect(variantInputSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
    expect(variantInputSchema.safeParse({ ...base, price: -1 }).success).toBe(false);
    expect(variantInputSchema.safeParse({ ...base, price: 9.99 }).success).toBe(false);
  });

  it("rejects names above 80 chars", () => {
    expect(variantInputSchema.safeParse({ name: "ع".repeat(81), price: 1, stock: 0 }).success).toBe(
      false,
    );
  });

  it("accepts an empty image or a well-formed URL, and rejects other strings", () => {
    const base = { name: "v", price: 1, stock: 0 };
    expect(variantInputSchema.safeParse(base).success).toBe(true);
    expect(
      variantInputSchema.safeParse({ ...base, image: "https://example.com/a.png" }).success,
    ).toBe(true);
    expect(variantInputSchema.safeParse({ ...base, image: "not-a-url" }).success).toBe(false);
  });
});

describe("generateSlug", () => {
  it("falls back to 'product' when the source carries no ascii slug characters", () => {
    expect(generateSlug("عسل السدر")).toBe("product");
    expect(generateSlug("")).toBe("product");
  });

  it("folds an english source with punctuation into lowercase hyphenated words", () => {
    expect(generateSlug("Sidr Honey!")).toBe("sidr-honey");
  });

  it("collapses separator runs and keeps digits", () => {
    expect(generateSlug("Mixed--Nuts 500g")).toBe("mixed-nuts-500g");
  });
});

describe("listAdminProducts", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("paginates 25 products newest-first with an accurate total", async () => {
    const categoryId = await seedCategory(db);
    const base = 1_700_000_000_000;
    const createdIds: string[] = [];
    for (let i = 0; i < 25; i++) {
      createdIds.push(await seedProduct(db, categoryId, { createdAt: base + i * 1_000 }));
    }

    const page1 = await listAdminProducts(db);
    expect(page1.items).toHaveLength(PRODUCTS_PAGE_SIZE);
    expect(page1.total).toBe(25);
    expect(page1.items[0]?.id).toBe(createdIds[24]);
    const page1Ids = new Set(page1.items.map((p) => p.id));
    expect(page1Ids.has(createdIds[0])).toBe(false);

    const page2 = await listAdminProducts(db, { page: 2 });
    expect(page2.items).toHaveLength(5);
    expect(page2.total).toBe(25);
    expect(page2.items.map((p) => p.id)).toEqual(createdIds.slice(0, 5).reverse());
  });

  it("treats a non-finite page as page 1 instead of passing NaN to offset", async () => {
    const categoryId = await seedCategory(db);
    const only = await seedProduct(db, categoryId, { createdAt: 1_700_000_000_000 });

    const result = await listAdminProducts(db, { page: Number.NaN });

    expect(result.total).toBe(1);
    expect(result.items.map((p) => p.id)).toEqual([only]);
  });

  it("searches arabic names and english names alike, filtering page and total", async () => {
    const categoryId = await seedCategory(db);
    const royal = await seedProduct(db, categoryId, {
      name: "عسل السدر الملكي",
      nameEn: "Royal Sidr Honey",
    });
    await seedProduct(db, categoryId, { name: "زيت الزيتون", nameEn: "Olive Oil" });

    const byEnglish = await listAdminProducts(db, { query: "sidr" });
    expect(byEnglish.total).toBe(1);
    expect(byEnglish.items.map((p) => p.id)).toEqual([royal]);

    const byArabic = await listAdminProducts(db, { query: "السدر" });
    expect(byArabic.total).toBe(1);
    expect(byArabic.items.map((p) => p.id)).toEqual([royal]);

    expect(await listAdminProducts(db, { query: "zzz-nothing" })).toEqual({
      items: [],
      total: 0,
    });
  });

  it("treats LIKE wildcards in the query as literals", async () => {
    const categoryId = await seedCategory(db);
    const percent = await seedProduct(db, categoryId, { name: "عرض 50% خاص" });
    const underscore = await seedProduct(db, categoryId, { name: "a_b" });
    await seedProduct(db, categoryId, { name: "سادة" });

    const percentHit = await listAdminProducts(db, { query: "%" });
    expect(percentHit.total).toBe(1);
    expect(percentHit.items.map((p) => p.id)).toEqual([percent]);

    const underscoreHit = await listAdminProducts(db, { query: "_" });
    expect(underscoreHit.total).toBe(1);
    expect(underscoreHit.items.map((p) => p.id)).toEqual([underscore]);
  });

  it("maps category name, aggregated stock, and variant counts onto rows", async () => {
    const clover = await seedCategory(db, { name: "برسيم" });
    const withVariants = await seedProduct(db, clover, {
      name: "مجمّع",
      featured: 1,
      createdAt: 1_700_000_000_000,
    });
    await seedVariant(db, withVariants, { name: "250g", stock: 3 });
    await seedVariant(db, withVariants, { name: "1kg", stock: 4 });
    const bare = await seedProduct(db, clover, { name: "بدون متغيرات" });

    const rows = await listAdminProducts(db);
    const byId = new Map(rows.items.map((p) => [p.id, p]));

    expect(byId.get(withVariants)).toEqual({
      id: withVariants,
      name: "مجمّع",
      slug: expect.any(String),
      price: 150_00,
      featured: true,
      categoryName: "برسيم",
      department: "honey",
      totalStock: 7,
      variantCount: 2,
      createdAt: 1_700_000_000_000,
    });
    expect(byId.get(bare)?.totalStock).toBe(0);
    expect(byId.get(bare)?.variantCount).toBe(0);
  });
});

describe("getProductForEdit", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("returns the product detail plus its variants ordered by sortOrder", async () => {
    const categoryId = await seedCategory(db, { name: "برسيم" });
    const id = await seedProduct(db, categoryId, {
      name: "عسل سدر",
      nameEn: "Sidr Honey",
      createdAt: 1_700_000_000_000,
    });
    const large = await seedVariant(db, id, { name: "علبة كبيرة", sortOrder: 2, stock: 9 });
    const small = await seedVariant(db, id, { name: "250g", sortOrder: 0, stock: 3 });
    const medium = await seedVariant(db, id, { name: "500g", sortOrder: 1, stock: 0 });

    const result = await getProductForEdit(db, id);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.product).toEqual({
      id,
      name: "عسل سدر",
      slug: expect.any(String),
      description: "د",
      descriptionEn: "",
      price: 150_00,
      featured: false,
      categoryName: "برسيم",
      department: "honey",
      totalStock: 12,
      variantCount: 3,
      createdAt: 1_700_000_000_000,
    });
    expect(result.variants.map((v) => v.id)).toEqual([small, medium, large]);
    expect(result.variants[0]).toMatchObject({ name: "250g", price: 150_00, stock: 3 });
  });

  it("returns null for an unknown product id", async () => {
    expect(await getProductForEdit(db, crypto.randomUUID())).toBeNull();
  });
});

describe("createProduct", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("persists every field and stores featured as the integer column", async () => {
    const categoryId = await seedCategory(db);

    const result = await createProduct(db, productInput(categoryId, { featured: true }), "sidr");
    expect(result).toEqual({ ok: true, id: expect.any(String) });

    const row = await db.select().from(schema.product).where(eq(schema.product.slug, "sidr")).get();
    expect(row).toMatchObject({
      id: result.ok ? result.id : "",
      name: "عسل سدر جبلي",
      nameEn: "Mountain Sidr Honey",
      description: "وصف المنتج الكامل",
      descriptionEn: "Full product description",
      price: 0,
      categoryId,
      featured: 1,
    });
  });

  it("auto-appends -2 when the requested slug is taken", async () => {
    const categoryId = await seedCategory(db);
    await seedProduct(db, categoryId, { slug: "sidr" });

    const result = await createProduct(db, productInput(categoryId), "sidr");

    expect(result).toEqual({ ok: true, id: expect.any(String) });
    const slugs = await db.select({ slug: schema.product.slug }).from(schema.product);
    expect(slugs.map((s) => s.slug).sort()).toEqual(["sidr", "sidr-2"]);
  });

  it("rejects an unknown category with category_missing and writes nothing", async () => {
    const result = await createProduct(db, productInput(crypto.randomUUID()), "orphan");

    expect(result).toEqual({ ok: false, reason: "category_missing" });
    expect(await db.select().from(schema.product)).toHaveLength(0);
  });
});

describe("updateProduct", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  let categoryId: string;
  beforeEach(async () => {
    db = await buildDb();
    categoryId = await seedCategory(db);
  });

  it("updates fields and moves the slug to a fresh unique base", async () => {
    const id = await seedProduct(db, categoryId, { slug: "old-slug" });

    const result = await updateProduct(
      db,
      id,
      productInput(categoryId, { name: "اسم جديد" }),
      "new-slug",
    );

    expect(result).toEqual({ ok: true, id });
    const row = await db.select().from(schema.product).where(eq(schema.product.id, id)).get();
    expect(row).toMatchObject({ slug: "new-slug", name: "اسم جديد", price: 100_00 });
  });

  it("keeps the auto-suffixed slug when the caller passes the same base", async () => {
    await seedProduct(db, categoryId, { slug: "sidr-honey" });
    const target = await createProduct(db, productInput(categoryId), "sidr-honey");
    if (!target.ok) throw new Error("createProduct should have succeeded");

    const result = await updateProduct(db, target.id, productInput(categoryId), "sidr-honey");

    expect(result).toEqual({ ok: true, id: target.id });
    const row = await db
      .select({ slug: schema.product.slug })
      .from(schema.product)
      .where(eq(schema.product.id, target.id))
      .get();
    expect(row?.slug).toBe("sidr-honey-2");
  });

  it("returns slug_taken once all 20 probe candidates are occupied, without writing", async () => {
    const id = await seedProduct(db, categoryId, { slug: "original" });
    for (let i = 1; i <= 20; i++) {
      await seedProduct(db, categoryId, { slug: i === 1 ? "taken" : `taken-${i}` });
    }

    const result = await updateProduct(db, id, productInput(categoryId), "taken");

    expect(result).toEqual({ ok: false, reason: "slug_taken" });
    const row = await db.select().from(schema.product).where(eq(schema.product.id, id)).get();
    expect(row?.slug).toBe("original");
  });

  it("rejects an unknown category with category_missing", async () => {
    const id = await seedProduct(db, categoryId);

    expect(await updateProduct(db, id, productInput(crypto.randomUUID()), "any-slug")).toEqual({
      ok: false,
      reason: "category_missing",
    });
  });
});

describe("deleteProduct", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("returns not_found for an unknown id", async () => {
    expect(await deleteProduct(db, crypto.randomUUID())).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("blocks deletion while an order item references the product", async () => {
    const categoryId = await seedCategory(db);
    const id = await seedProduct(db, categoryId);
    await seedVariant(db, id);
    await seedOrderWithItem(db, id);

    expect(await deleteProduct(db, id)).toEqual({ ok: false, reason: "referenced_by_orders" });

    const row = await db
      .select({ id: schema.product.id })
      .from(schema.product)
      .where(eq(schema.product.id, id))
      .get();
    expect(row?.id).toBe(id);
  });

  it("deletes the product together with its variants and gallery images", async () => {
    const categoryId = await seedCategory(db);
    const id = await seedProduct(db, categoryId);
    await seedVariant(db, id);
    await seedImage(db, id);

    expect(await deleteProduct(db, id)).toEqual({ ok: true });

    expect(await db.select().from(schema.product)).toHaveLength(0);
    expect(await db.select().from(schema.productVariant)).toHaveLength(0);
    expect(await db.select().from(schema.productImage)).toHaveLength(0);
  });
});

describe("upsertVariant", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  let categoryId: string;
  beforeEach(async () => {
    db = await buildDb();
    categoryId = await seedCategory(db);
  });

  it("inserts a variant under the product and returns its id", async () => {
    const productId = await seedProduct(db, categoryId);

    const result = await upsertVariant(db, productId, variantInput({ stock: 7 }));

    expect(result).toEqual({ ok: true, id: expect.any(String) });
    const row = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, result.ok ? result.id : ""))
      .get();
    expect(row).toMatchObject({ productId, name: "250g", price: 150_00, stock: 7 });
  });

  it("returns product_missing for an unknown product", async () => {
    expect(await upsertVariant(db, crypto.randomUUID(), variantInput())).toEqual({
      ok: false,
      reason: "product_missing",
    });
  });

  it("rejects a duplicate variant name within the same product but allows it across products", async () => {
    const first = await seedProduct(db, categoryId);
    const second = await seedProduct(db, categoryId);
    await seedVariant(db, first, { name: "250g" });

    expect(await upsertVariant(db, first, variantInput({ name: "250g" }))).toEqual({
      ok: false,
      reason: "name_taken",
    });
    expect(await upsertVariant(db, second, variantInput({ name: "250g" }))).toEqual({
      ok: true,
      id: expect.any(String),
    });
  });

  it("updates an existing variant in place, keeping its id", async () => {
    const productId = await seedProduct(db, categoryId);
    const variantId = await seedVariant(db, productId, { name: "250g", stock: 5 });

    const result = await upsertVariant(
      db,
      productId,
      variantInput({ id: variantId, name: "500g", stock: 8 }),
    );

    expect(result).toEqual({ ok: true, id: variantId });
    const rows = await db.select().from(schema.productVariant);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: variantId, name: "500g", stock: 8 });
  });

  it("lets an update keep its own name while blocking a rename onto a sibling's name", async () => {
    const productId = await seedProduct(db, categoryId);
    const small = await seedVariant(db, productId, { name: "250g" });
    await seedVariant(db, productId, { name: "1kg" });

    expect(
      await upsertVariant(db, productId, variantInput({ id: small, name: "250g", stock: 2 })),
    ).toEqual({ ok: true, id: small });
    expect(await upsertVariant(db, productId, variantInput({ id: small, name: "1kg" }))).toEqual({
      ok: false,
      reason: "name_taken",
    });
  });

  it("rejects a variantId belonging to a different product with product_missing", async () => {
    const otherProductId = await seedProduct(db, categoryId);
    const foreignVariantId = await seedVariant(db, otherProductId, { name: "خارجي", stock: 3 });
    const productId = await seedProduct(db, categoryId);

    const result = await upsertVariant(
      db,
      productId,
      variantInput({ id: foreignVariantId, name: "250g", stock: 9 }),
    );

    expect(result).toEqual({ ok: false, reason: "product_missing" });
    const rows = await db.select().from(schema.productVariant);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: foreignVariantId, productId: otherProductId, stock: 3 });
  });

  it("recreates a variant under its rendered id when the row vanished before submit", async () => {
    const productId = await seedProduct(db, categoryId);
    const vanishedId = crypto.randomUUID();

    const result = await upsertVariant(db, productId, variantInput({ id: vanishedId }));

    expect(result).toEqual({ ok: true, id: vanishedId });
    const row = await db.select().from(schema.productVariant).get();
    expect(row).toMatchObject({ id: vanishedId, productId });
  });
});

describe("deleteVariant", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("removes an existing variant", async () => {
    const categoryId = await seedCategory(db);
    const productId = await seedProduct(db, categoryId);
    const id = await seedVariant(db, productId);

    expect(await deleteVariant(db, id)).toEqual({ ok: true });
    expect(await db.select().from(schema.productVariant)).toHaveLength(0);
  });

  it.each(["store_order_item", "store_stock_conversion"])(
    "preserves variants referenced by %s with foreign keys enabled",
    async (table) => {
      expect((await db.all(`PRAGMA foreign_keys`))[0]).toEqual({ foreign_keys: 1 });
      const categoryId = await seedCategory(db);
      const productId = await seedProduct(db, categoryId);
      const id = await seedVariant(db, productId);
      if (table === "store_order_item") {
        await seedOrderWithItem(db, productId);
        await db.update(schema.orderItem).set({ variantId: id });
      } else {
        await db.run(
          `INSERT INTO store_stock_conversion (id, variant_id) VALUES ('conversion', '${id}')`,
        );
      }
      await expect(
        db.delete(schema.productVariant).where(eq(schema.productVariant.id, id)),
      ).rejects.toThrow();
      expect(await deleteVariant(db, id, "another-product")).toEqual({
        ok: false,
        reason: "not_found",
      });
      expect(await deleteVariant(db, id, productId)).toEqual({ ok: false, reason: "referenced" });
      expect(await db.select().from(schema.productVariant)).toHaveLength(1);
      expect(await db.all(`PRAGMA foreign_key_check`)).toEqual([]);
    },
  );

  it("returns not_found for an unknown id", async () => {
    expect(await deleteVariant(db, crypto.randomUUID())).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
