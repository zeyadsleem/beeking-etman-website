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
  categoryInputSchema,
  deleteCategory,
  listCategoriesWithCounts,
  upsertCategory,
} from "./categories";

const DB_FILE = "admin-categories-test.db";

// One client for the whole file: reopening the same file after an unlink can
// strand open handles (SQLITE_READONLY_DBMOVED), so rebuilds drop/recreate
// tables on this client instead of deleting the database.
let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  // Mirrors production migrations verbatim (see sibling admin/orders.spec.ts):
  // store_category with a unique slug and store_product keyed to it.
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
  return db;
}

async function seedCategory(
  db: Awaited<ReturnType<typeof buildDb>>,
  values: { name: string; nameEn?: string; slug?: string },
): Promise<string> {
  const row = (
    await db
      .insert(schema.category)
      .values({
        name: values.name,
        nameEn: values.nameEn ?? "",
        slug: values.slug ?? `cat-${crypto.randomUUID()}`,
      })
      .returning({ id: schema.category.id })
  )[0];
  if (!row) throw new Error("seedCategory insert returned no row");
  return row.id;
}

async function seedProduct(
  db: Awaited<ReturnType<typeof buildDb>>,
  categoryId: string,
): Promise<string> {
  const row = (
    await db
      .insert(schema.product)
      .values({
        name: "عسل سدر مصري",
        slug: `p-${crypto.randomUUID()}`,
        description: "د",
        price: 100_00,
        stock: 3,
        image: "https://example.com/h.jpg",
        categoryId,
        featured: 0,
        createdAt: Date.now(),
      })
      .returning({ id: schema.product.id })
  )[0];
  if (!row) throw new Error("seedProduct insert returned no row");
  return row.id;
}

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("categoryInputSchema", () => {
  it("accepts a minimal payload and fills the nameEn/slug defaults", () => {
    const parsed = categoryInputSchema.parse({ name: "Sidr Honey" });
    expect(parsed).toEqual({ name: "Sidr Honey", nameEn: "", slug: "sidr-honey" });
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(categoryInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(categoryInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects names above 120 chars", () => {
    const longName = "ع".repeat(121);
    expect(categoryInputSchema.safeParse({ name: longName }).success).toBe(false);
  });

  it("rejects malformed slugs but accepts well-formed ones", () => {
    const bad = ["Sidr Honey!", "UPPER-CASE", "-leading", "trailing-", "dou--ble", "عربي"];
    for (const slug of bad) {
      expect(categoryInputSchema.safeParse({ name: "n", slug }).success).toBe(false);
    }
    expect(categoryInputSchema.safeParse({ name: "n", slug: "sidr-honey" }).success).toBe(true);
    expect(categoryInputSchema.safeParse({ name: "n", slug: "a1" }).success).toBe(true);
  });

  it("rejects slugs above 120 chars", () => {
    expect(categoryInputSchema.safeParse({ name: "n", slug: `${"a".repeat(121)}` }).success).toBe(
      false,
    );
  });

  it("auto-slugs from nameEn when slug is blank", () => {
    const parsed = categoryInputSchema.parse({
      name: "عسل السدر",
      nameEn: "Sidr Honey!",
      slug: "",
    });
    expect(parsed.slug).toBe("sidr-honey");
  });

  it("auto-slugs from name when both slug and nameEn are blank", () => {
    const parsed = categoryInputSchema.parse({ name: "Sidr Honey", nameEn: "", slug: "" });
    expect(parsed.slug).toBe("sidr-honey");
  });

  it("keeps a blank slug when neither field yields slug characters (admin must supply one)", () => {
    // Arabic-only names carry no [a-z0-9] characters; the boundary rejects the
    // write instead of inventing a slug the admin never saw.
    const result = categoryInputSchema.safeParse({ name: "عسل السدر", nameEn: "", slug: "" });
    expect(result.success).toBe(false);
  });

  it("flags a blank resolved slug with the slugRequired issue so routes can guide the admin", () => {
    const result = categoryInputSchema.safeParse({ name: "عسل السدر", nameEn: "", slug: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) => issue.message === "admin.categories.slugRequired"),
    ).toBe(true);
  });

  it("flags an explicit malformed slug with the slugInvalid issue, not slugRequired", () => {
    const result = categoryInputSchema.safeParse({ name: "n", nameEn: "", slug: "Sidr Honey!" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) => issue.message === "admin.categories.slugInvalid"),
    ).toBe(true);
    expect(
      result.error.issues.some((issue) => issue.message === "admin.categories.slugRequired"),
    ).toBe(false);
  });
});

describe("listCategoriesWithCounts", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("returns every category ordered by name with its product count", async () => {
    const sidr = await seedCategory(db, { name: "عسل السدر", nameEn: "Sidr", slug: "sidr" });
    const clover = await seedCategory(db, { name: "برسيم", nameEn: "Clover", slug: "clover" });
    await seedProduct(db, clover);
    await seedProduct(db, clover);

    const rows = await listCategoriesWithCounts(db);

    expect(rows.map((c) => c.slug)).toEqual(["clover", "sidr"]);
    expect(rows.map((c) => c.productCount)).toEqual([2, 0]);
    const bySlug = new Map(rows.map((c) => [c.slug, c]));
    expect(bySlug.get("sidr")).toEqual({
      id: sidr,
      name: "عسل السدر",
      nameEn: "Sidr",
      slug: "sidr",
      productCount: 0,
    });
  });

  it("returns an empty array with no categories", async () => {
    expect(await listCategoriesWithCounts(db)).toEqual([]);
  });
});

describe("upsertCategory", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("creates a category and returns its id", async () => {
    const result = await upsertCategory(db, {
      name: "عسل السدر",
      nameEn: "Sidr",
      slug: "sidr",
    });
    expect(result).toEqual({ ok: true, id: expect.any(String) });
    if (!result.ok) return;
    const row = await db
      .select()
      .from(schema.category)
      .where(eq(schema.category.slug, "sidr"))
      .get();
    expect(row).toMatchObject({ id: result.id, name: "عسل السدر", nameEn: "Sidr", slug: "sidr" });
  });

  it("rejects a duplicate slug with slug_taken", async () => {
    await seedCategory(db, { name: "أول", slug: "sidr" });

    const result = await upsertCategory(db, { name: "ثانٍ", nameEn: "", slug: "sidr" });

    expect(result).toEqual({ ok: false, reason: "slug_taken" });
    const rows = await db.select({ slug: schema.category.slug }).from(schema.category);
    expect(rows).toHaveLength(1);
  });

  it("updates an existing category without touching its id", async () => {
    const id = await seedCategory(db, { name: "قديم", nameEn: "Old", slug: "old" });

    const result = await upsertCategory(db, {
      id,
      name: "جديد",
      nameEn: "New",
      slug: "new",
    });

    expect(result).toEqual({ ok: true, id });
    const rows = await db.select().from(schema.category);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, name: "جديد", nameEn: "New", slug: "new" });
  });

  it("lets an update keep its own slug while others hold different slugs", async () => {
    const own = await seedCategory(db, { name: "الخاص", nameEn: "Own", slug: "own" });
    await seedCategory(db, { name: "آخر", nameEn: "Other", slug: "other" });

    const result = await upsertCategory(db, { id: own, name: "الخاص", nameEn: "Own", slug: "own" });

    expect(result).toEqual({ ok: true, id: own });
  });

  it("rejects an update that steals another category's slug", async () => {
    const other = await seedCategory(db, { name: "آخر", nameEn: "Other", slug: "other" });
    const own = await seedCategory(db, { name: "الخاص", nameEn: "Own", slug: "own" });

    const result = await upsertCategory(db, {
      id: own,
      name: "الخاص",
      nameEn: "Own",
      slug: "other",
    });

    expect(result).toEqual({ ok: false, reason: "slug_taken" });
    const row = await db.select().from(schema.category).where(eq(schema.category.id, other)).get();
    expect(row?.slug).toBe("other");
  });
});

describe("deleteCategory", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("returns not_found for an unknown id", async () => {
    expect(await deleteCategory(db, crypto.randomUUID())).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("blocks deletion while products reference the category", async () => {
    const id = await seedCategory(db, { name: "عسل السدر", slug: "sidr" });
    await seedProduct(db, id);

    expect(await deleteCategory(db, id)).toEqual({ ok: false, reason: "has_products" });

    const row = await db.select({ slug: schema.category.slug }).from(schema.category).get();
    expect(row?.slug).toBe("sidr");
  });

  it("deletes an empty category", async () => {
    const id = await seedCategory(db, { name: "فارغ", slug: "empty-cat" });

    expect(await deleteCategory(db, id)).toEqual({ ok: true });

    const rows = await db.select().from(schema.category);
    expect(rows).toHaveLength(0);
  });
});
