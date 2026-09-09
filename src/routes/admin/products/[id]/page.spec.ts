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

const DB_FILE = "admin-product-edit-test.db";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

// getProductForEdit joins categories/variants; the actions write products and
// variants. The DDL mirrors production migrations verbatim (see sibling
// lib/server/admin/products.spec.ts).
async function buildDb(): Promise<void> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`PRAGMA foreign_keys = ON`);
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_stock_conversion`);
  await db.run(`DROP TABLE IF EXISTS store_admin_audit`);
  await db.run(`DROP TABLE IF EXISTS store_stock_movement`);
  await db.run(`DROP TABLE IF EXISTS store_product_image`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
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
    CREATE TABLE store_admin_audit (
      id TEXT PRIMARY KEY NOT NULL, admin_user_id TEXT,
      action TEXT NOT NULL, target_type TEXT NOT NULL,
      target_id TEXT NOT NULL, details TEXT,
      created_at INTEGER NOT NULL
    )`);
  await db.run(`CREATE TABLE store_order_item (
    id TEXT PRIMARY KEY NOT NULL, variant_id TEXT REFERENCES store_product_variant(id)
  )`);
  await db.run(`CREATE TABLE store_stock_conversion (
    id TEXT PRIMARY KEY NOT NULL, variant_id TEXT NOT NULL REFERENCES store_product_variant(id)
  )`);
  testDb = db;
  state.database = db;
}

async function seedCategory(name = "برسيم", nameEn = ""): Promise<string> {
  const row = (
    await currentDb()
      .insert(schema.category)
      .values({ name, nameEn, slug: `cat-${crypto.randomUUID()}` })
      .returning({ id: schema.category.id })
  )[0];
  if (!row) throw new Error("seedCategory insert returned no row");
  return row.id;
}

interface ProductSeedOptions {
  slug?: string;
  image?: string;
}

async function seedProduct(categoryId: string, opts: ProductSeedOptions = {}): Promise<string> {
  const row = (
    await currentDb()
      .insert(schema.product)
      .values({
        name: "عسل سدر ملكي",
        nameEn: "Royal Sidr",
        slug: opts.slug ?? `p-${crypto.randomUUID()}`,
        description: "وصف أصلي",
        descriptionEn: "Original description",
        price: 250_50,
        stock: 0,
        image: opts.image ?? "",
        categoryId,
        featured: 0,
        createdAt: Date.now(),
      })
      .returning({ id: schema.product.id })
  )[0];
  if (!row) throw new Error("seedProduct insert returned no row");
  if (opts.image)
    await currentDb().insert(schema.productImage).values({ productId: row.id, url: opts.image });
  return row.id;
}

async function coverUrl(productId: string): Promise<string> {
  const images = await currentDb()
    .select()
    .from(schema.productImage)
    .where(eq(schema.productImage.productId, productId));
  return images.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0]?.url ?? "";
}

async function seedVariant(
  productId: string,
  overrides: Partial<{
    id: string;
    name: string;
    nameEn: string;
    price: number;
    stock: number;
    image: string;
    sortOrder: number;
  }> = {},
): Promise<string> {
  const row = (
    await currentDb()
      .insert(schema.productVariant)
      .values({
        id: overrides.id ?? crypto.randomUUID(),
        productId,
        name: overrides.name ?? "250 زجاج",
        nameEn: overrides.nameEn ?? "250g glass",
        price: overrides.price ?? 150_00,
        stock: overrides.stock ?? 5,
        image: overrides.image ?? "",
        sortOrder: overrides.sortOrder ?? 0,
      })
      .returning({ id: schema.productVariant.id })
  )[0];
  if (!row) throw new Error("seedVariant insert returned no row");
  return row.id;
}

async function seedGalleryImage(productId: string, url: string, sortOrder = 0): Promise<string> {
  const row = (
    await currentDb()
      .insert(schema.productImage)
      .values({ id: crypto.randomUUID(), productId, url, sortOrder })
      .returning({ id: schema.productImage.id })
  )[0];
  if (!row) throw new Error("seedGalleryImage insert returned no row");
  return row.id;
}

interface PutCall {
  key: string;
  value: ArrayBuffer;
}

/** Fake KV namespace recording every put so tests assert keys and payloads. */
function makeNamespace(): {
  put(key: string, value: ArrayBuffer): Promise<void>;
  calls: PutCall[];
} {
  const calls: PutCall[] = [];
  return {
    calls,
    put(key, value) {
      calls.push({ key, value });
      return Promise.resolve();
    },
  };
}

/** KV double whose writes always fail, driving storage_unavailable paths. */
function makeFailingNamespace(): unknown {
  return {
    get(): Promise<ArrayBuffer | null> {
      return Promise.resolve(null);
    },
    put(): Promise<void> {
      return Promise.reject(new Error("kv unavailable"));
    },
  };
}

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngFile(name = "honey.png"): File {
  return new File([new Uint8Array(PNG_BYTES)], name, { type: "image/png" });
}

interface EventOptions {
  role?: string;
  langCookie?: "ar" | "en";
  fields?: Record<string, string>;
  files?: Record<string, File>;
  /** Omitted entirely when undefined — exercises the no-platform guard. */
  platform?: { env: { MEDIA: unknown } };
}

// The handlers read `params`, `locals.user?.role`, `cookies.get`, request
// headers (getLang), the multipart body, and `platform.env.MEDIA` — fabricate
// exactly that surface.
function fakeEvent(id: string, opts: EventOptions = {}): RequestEvent {
  const body = new FormData();
  for (const [key, value] of Object.entries(opts.fields ?? {})) body.set(key, value);
  for (const [key, file] of Object.entries(opts.files ?? {})) body.set(key, file);
  return {
    params: { id },
    url: new URL(`http://localhost/admin/products/${id}`),
    cookies: { get: (name: string) => (name === "lang" ? opts.langCookie : undefined) },
    request: new Request(`http://localhost/admin/products/${id}`, { method: "POST", body }),
    locals: { user: opts.role === undefined ? undefined : { role: opts.role } },
    ...(opts.platform === undefined ? {} : { platform: opts.platform }),
  } as unknown as RequestEvent;
}

function failureOf(result: unknown): { status: number; message: string } {
  if (!isActionFailure(result)) throw new Error("expected an ActionFailure");
  const data = result.data as { message?: string } | undefined;
  return { status: result.status, message: data?.message ?? "" };
}

type LoadFn = (event: RequestEvent) => Promise<unknown>;
type ActionFn = (event: RequestEvent) => Promise<unknown>;

let load: LoadFn;
let details: ActionFn;
let uploadImage: ActionFn;
let variantSave: ActionFn;
let variantDelete: ActionFn;
let galleryAdd: ActionFn;
let galleryDelete: ActionFn;
let galleryReorder: ActionFn;

beforeAll(async () => {
  const module = await import("./+page.server");
  load = module.load as unknown as LoadFn;
  const actions = module.actions as Record<string, ActionFn>;
  details = actions.details;
  uploadImage = actions.uploadImage;
  variantSave = actions.variantSave;
  variantDelete = actions.variantDelete;
  galleryAdd = actions.galleryAdd;
  galleryDelete = actions.galleryDelete;
  galleryReorder = actions.galleryReorder;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

describe("admin edit product load", () => {
  it("returns the product, its variants ordered by sortOrder, and the cover image", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId, {
      image: "https://example.com/h.jpg",
      slug: "royal-sidr",
    });
    await seedVariant(id, { sortOrder: 2, name: "1 كيلو" });
    await seedVariant(id, { sortOrder: 1, name: "250 زجاج" });

    const data = (await load(fakeEvent(id))) as {
      product: { id: string; slug: string; categoryId: string; price: number };
      variants: Array<{ name: string; sortOrder: number }>;
      image: string;
      lang: string;
    };

    expect(data.product.id).toBe(id);
    expect(data.product.slug).toBe("royal-sidr");
    expect(data.product.price).toBe(15_000);
    expect(data.variants.map((variant) => variant.name)).toEqual(["250 زجاج", "1 كيلو"]);
    expect(data.image).toBe("https://example.com/h.jpg");
    expect(data.lang).toBe("ar");
  });

  it("throws a 404 for an unknown product id", async () => {
    await expect(load(fakeEvent(crypto.randomUUID()))).rejects.toMatchObject({ status: 404 });
  });
});

const DETAILS_FIELDS = {
  name: "عسل سدر ملكي المحدث",
  nameEn: "Royal Sidr Premium",
  slug: "royal-sidr",
  description: "وصف محدث أطول",
  descriptionEn: "Updated description",
};

describe("admin edit product details action", () => {
  it("rejects guests and non-admins with 403 and writes nothing", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    for (const role of [undefined, "user"] as const) {
      const result = failureOf(await details(fakeEvent(id, { fields: DETAILS_FIELDS, role })));
      expect(result.status).toBe(403);
      expect(result.message).toBe(t("ar", "errors.unexpected"));
    }
    const [row] = await currentDb()
      .select({ description: schema.product.description })
      .from(schema.product)
      .where(eq(schema.product.id, id));
    expect(row?.description).toBe("وصف أصلي"); // untouched
  });

  it("updates details without changing the retired price and reports saved", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = await details(
      fakeEvent(id, { fields: { ...DETAILS_FIELDS, categoryId }, role: "admin" }),
    );

    expect(result).toEqual({ saved: t("ar", "admin.products.saved") });
    const [row] = await currentDb()
      .select({
        name: schema.product.name,
        description: schema.product.description,
        price: schema.product.price,
      })
      .from(schema.product)
      .where(eq(schema.product.id, id));
    expect(row?.name).toBe("عسل سدر ملكي المحدث");
    expect(row?.description).toBe("وصف محدث أطول");
    expect(row?.price).toBe(25_050);
  });

  it("keeps the stored cover image across a field-only edit", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId, { image: "https://example.com/keep.jpg" });

    await details(fakeEvent(id, { fields: { ...DETAILS_FIELDS, categoryId }, role: "admin" }));

    expect(await coverUrl(id)).toBe("https://example.com/keep.jpg");
  });

  it("replaces the cover image with a pasted url on a field-only edit", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId, { image: "https://example.com/old.jpg" });
    const pasted = "https://cdn.example.com/new-cover.jpg";

    await details(
      fakeEvent(id, {
        fields: { ...DETAILS_FIELDS, categoryId, imageUrl: pasted },
        role: "admin",
      }),
    );

    expect(await coverUrl(id)).toBe(pasted);
  });

  it("keeps an existing auto-suffixed slug when the submitted base derives from it", async () => {
    const categoryId = await seedCategory();
    // Storefront links point at the suffixed slug; a resubmit of the same base
    // must keep it exactly instead of re-probing onto the shorter candidate.
    const id = await seedProduct(categoryId, { slug: "royal-sidr-2" });

    await details(fakeEvent(id, { fields: { ...DETAILS_FIELDS, categoryId }, role: "admin" }));

    const [row] = await currentDb()
      .select({ slug: schema.product.slug })
      .from(schema.product)
      .where(eq(schema.product.id, id));
    expect(row?.slug).toBe("royal-sidr-2");
  });

  it("maps an unknown category to 409 with a localized message", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await details(
        fakeEvent(id, {
          fields: { ...DETAILS_FIELDS, categoryId: crypto.randomUUID() },
          role: "admin",
        }),
      ),
    );

    expect(result.status).toBe(409);
    expect(result.message).toBe(t("ar", "admin.products.categoryMissing"));
  });

  it("fails 400 on an invalid payload and writes nothing", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await details(
        fakeEvent(id, { fields: { ...DETAILS_FIELDS, categoryId, name: "" }, role: "admin" }),
      ),
    );

    expect(result.status).toBe(400);
    const [row] = await currentDb()
      .select({ price: schema.product.price })
      .from(schema.product)
      .where(eq(schema.product.id, id));
    expect(row?.price).toBe(25_050); // untouched
  });

  it("uploads a replacement image together with the field update", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const ns = makeNamespace();

    await details(
      fakeEvent(id, {
        fields: { ...DETAILS_FIELDS, categoryId },
        role: "admin",
        files: { image: pngFile() },
        platform: { env: { MEDIA: ns } },
      }),
    );

    expect(ns.calls).toHaveLength(1);
    const call = ns.calls[0];
    expect(call?.key).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    expect(await coverUrl(id)).toBe(`/media/${call?.key}`);
  });

  it("aborts the whole update with 503 when the kv write fails — fields stay untouched", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await details(
        fakeEvent(id, {
          fields: { ...DETAILS_FIELDS, categoryId },
          role: "admin",
          files: { image: pngFile() },
          platform: { env: { MEDIA: makeFailingNamespace() } },
        }),
      ),
    );

    expect(result.status).toBe(503);
    expect(result.message).toBe(t("ar", "errors.storageUnavailable"));
    const [row] = await currentDb()
      .select({ description: schema.product.description, image: schema.product.image })
      .from(schema.product)
      .where(eq(schema.product.id, id));
    expect(row?.description).toBe("وصف أصلي"); // nothing partial was written
    expect(row?.image).toBe("");
  });

  it("localizes failure messages from the lang cookie", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await details(
        fakeEvent(id, {
          langCookie: "en",
          fields: { ...DETAILS_FIELDS, categoryId, name: "" },
          role: "admin",
        }),
      ),
    );

    expect(result.message).toBe(t("en", "errors.unexpected"));
  });
});

describe("admin edit product uploadImage action", () => {
  it("rejects guests with 403", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(await uploadImage(fakeEvent(id, { files: { image: pngFile() } })));

    expect(result.status).toBe(403);
  });

  it("fails 400 when no file is chosen", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await uploadImage(
        fakeEvent(id, {
          role: "admin",
          platform: { env: { MEDIA: makeNamespace() } },
        }),
      ),
    );

    expect(result.status).toBe(400);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("writes the cover and syncs the lone variant image, reporting uploaded", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const variantId = await seedVariant(id);
    const ns = makeNamespace();

    const result = await uploadImage(
      fakeEvent(id, {
        role: "admin",
        files: { image: pngFile() },
        platform: { env: { MEDIA: ns } },
      }),
    );

    expect(result).toEqual({ uploaded: t("ar", "admin.products.uploadedImage") });
    const [row] = await currentDb()
      .select({ image: schema.product.image, description: schema.product.description })
      .from(schema.product)
      .where(eq(schema.product.id, id));
    const call = ns.calls[0];
    const url = `/media/${call?.key}`;
    expect(url).toMatch(/^\/media\/products\/[0-9a-f-]{36}\.png$/);
    expect(await coverUrl(id)).toBe(url);
    expect(row?.description).toBe("وصف أصلي"); // details untouched by this action
    const [variant] = await currentDb()
      .select({ image: schema.productVariant.image })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, variantId));
    expect(variant?.image).toBe(url); // single variant follows the cover (D1)
  });

  it("leaves the sole variant image alone when several variants exist", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const firstVariant = await seedVariant(id, { image: "https://example.com/first.jpg" });
    await seedVariant(id, { name: "1 كيلو", image: "https://example.com/second.jpg" });
    const ns = makeNamespace();

    await uploadImage(
      fakeEvent(id, {
        role: "admin",
        files: { image: pngFile() },
        platform: { env: { MEDIA: ns } },
      }),
    );

    const [variant] = await currentDb()
      .select({ image: schema.productVariant.image })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, firstVariant));
    expect(variant?.image).toBe("https://example.com/first.jpg");
  });

  it("returns 404 for a product that no longer exists", async () => {
    const id = crypto.randomUUID();
    const result = failureOf(
      await uploadImage(
        fakeEvent(id, {
          role: "admin",
          files: { image: pngFile() },
          platform: { env: { MEDIA: makeNamespace() } },
        }),
      ),
    );
    expect(result.status).toBe(404);
  });

  it.each([
    {
      label: "oversize file",
      file: () =>
        new File([new Uint8Array([0xff, 0xd8, 0xff]), new Uint8Array(5 * 1024 * 1024)], "big.jpg"),
      expectedStatus: 400,
      expectedMessage: t("ar", "errors.uploadTooLarge"),
      failingStorage: false,
    },
    {
      label: "unsupported bytes",
      file: () => new File([new TextEncoder().encode("garbage")], "x.png"),
      expectedStatus: 400,
      expectedMessage: t("ar", "errors.uploadUnsupported"),
      failingStorage: false,
    },
    {
      label: "failed kv write",
      file: () => pngFile(),
      expectedStatus: 503,
      expectedMessage: t("ar", "errors.storageUnavailable"),
      failingStorage: true,
    },
  ])(
    "fails $expectedStatus on $label and keeps the stored image",
    async ({ file, expectedStatus, expectedMessage, failingStorage }) => {
      const categoryId = await seedCategory();
      const id = await seedProduct(categoryId, { image: "https://example.com/keep.jpg" });

      const result = failureOf(
        await uploadImage(
          fakeEvent(id, {
            role: "admin",
            files: { image: file() },
            platform: {
              env: { MEDIA: failingStorage ? makeFailingNamespace() : makeNamespace() },
            },
          }),
        ),
      );

      expect(result.status).toBe(expectedStatus);
      expect(result.message).toBe(expectedMessage);
      const [row] = await currentDb()
        .select({ image: schema.product.image })
        .from(schema.product)
        .where(eq(schema.product.id, id));
      expect(row?.image).toBe("https://example.com/keep.jpg");
    },
  );
});

const VARIANT_FIELDS = {
  productId: "", // filled per test
  variantId: "",
  name: "500 كيلو",
  nameEn: "500g glass",
  price: "149.50",
  stock: "7",
  sortOrder: "3",
  imageUrl: "",
};

describe("admin edit product variantSave action", () => {
  it("rejects guests with 403", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await variantSave(fakeEvent(id, { fields: { ...VARIANT_FIELDS, productId: id } })),
    );

    expect(result.status).toBe(403);
  });

  it("inserts a variant when the hidden id is blank, converting EGP to qirsh", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = await variantSave(
      fakeEvent(id, { fields: { ...VARIANT_FIELDS, productId: id }, role: "admin" }),
    );

    expect(result).toEqual({ variantSaved: t("ar", "admin.products.variantSaved") });
    const rows = await currentDb()
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("500 كيلو");
    expect(rows[0]?.nameEn).toBe("500g glass");
    expect(rows[0]?.price).toBe(14_950);
    expect(rows[0]?.stock).toBe(7);
    expect(rows[0]?.sortOrder).toBe(3);
  });

  it("updates an existing variant in place, preserving its identity", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const variantId = await seedVariant(id);

    await variantSave(
      fakeEvent(id, {
        fields: { ...VARIANT_FIELDS, productId: id, variantId, name: "1 كيلو محدث" },
        role: "admin",
      }),
    );

    const rows = await currentDb()
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(variantId);
    expect(rows[0]?.name).toBe("1 كيلو محدث");
    expect(rows[0]?.price).toBe(14_950);
  });

  it("maps a sibling-name clash to 409 with a localized message", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    await seedVariant(id, { name: "250 زجاج" });

    const result = failureOf(
      await variantSave(
        fakeEvent(id, {
          fields: { ...VARIANT_FIELDS, productId: id, name: "250 زجاج" },
          role: "admin",
        }),
      ),
    );

    expect(result.status).toBe(409);
    expect(result.message).toBe(t("ar", "admin.products.variantNameTaken"));
  });

  it("rejects a forged cross-product variantId with 404 and leaves the owner intact", async () => {
    const categoryId = await seedCategory();
    const idA = await seedProduct(categoryId);
    const idB = await seedProduct(categoryId);
    const foreignVariantId = await seedVariant(idB);

    const result = failureOf(
      await variantSave(
        fakeEvent(idA, {
          fields: { ...VARIANT_FIELDS, productId: idA, variantId: foreignVariantId },
          role: "admin",
        }),
      ),
    );

    expect(result.status).toBe(404);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
    const foreignRows = await currentDb()
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, idB));
    expect(foreignRows).toHaveLength(1);
    expect(foreignRows[0]?.name).toBe("250 زجاج"); // untouched
    const ownRows = await currentDb()
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, idA));
    expect(ownRows).toHaveLength(0); // nothing written under the wrong parent
  });

  it("fails 400 on invalid numeric input and writes nothing", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await variantSave(
        fakeEvent(id, { fields: { ...VARIANT_FIELDS, productId: id, stock: "-3" }, role: "admin" }),
      ),
    );

    expect(result.status).toBe(400);
    const rows = await currentDb()
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, id));
    expect(rows).toHaveLength(0);
  });

  it("persists a pasted variant image url", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    await variantSave(
      fakeEvent(id, {
        fields: {
          ...VARIANT_FIELDS,
          productId: id,
          imageUrl: "https://cdn.example.com/v/500g.jpg",
        },
        role: "admin",
      }),
    );

    const rows = await currentDb()
      .select({ image: schema.productVariant.image })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, id));
    expect(rows[0]?.image).toBe("https://cdn.example.com/v/500g.jpg");
  });
});

describe("admin edit product variantDelete action", () => {
  it.each([
    ["store_order_item", "ar"],
    ["store_order_item", "en"],
    ["store_stock_conversion", "ar"],
    ["store_stock_conversion", "en"],
  ] as const)("rejects %s references with a useful %s conflict", async (table, langCookie) => {
    const productId = await seedProduct(await seedCategory());
    const variantId = await seedVariant(productId);
    await currentDb().run(
      `INSERT INTO ${table} (id, variant_id) VALUES ('reference', '${variantId}')`,
    );
    const result = failureOf(
      await variantDelete(
        fakeEvent(productId, {
          role: "admin",
          langCookie,
          fields: { variantId },
        }),
      ),
    );
    expect(result.status).toBe(409);
    expect(result.message).toBe(
      langCookie === "ar"
        ? "لا يمكن حذف متغير مرتبط بطلبات أو تحويلات مخزون. يمكنك تعديل مخزونه بدلاً من حذفه."
        : "Cannot delete a variant linked to orders or stock conversions. You can adjust its stock instead.",
    );
    expect(await currentDb().select().from(schema.productVariant)).toHaveLength(1);
    expect(await currentDb().all(`PRAGMA foreign_key_check`)).toEqual([]);
  });

  it("removes the variant and reports deleted", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const variantId = await seedVariant(id);

    const result = await variantDelete(
      fakeEvent(id, { fields: { productId: id, variantId }, role: "admin" }),
    );

    expect(result).toEqual({ variantDeleted: t("ar", "admin.products.variantDeleted") });
    const rows = await currentDb()
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.productId, id));
    expect(rows).toHaveLength(0);
  });

  it("maps an unknown variant id to 404", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await variantDelete(
        fakeEvent(id, { fields: { productId: id, variantId: crypto.randomUUID() }, role: "admin" }),
      ),
    );

    expect(result.status).toBe(404);
  });

  it("fails 400 on a blank variant id", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await variantDelete(
        fakeEvent(id, { fields: { productId: id, variantId: "" }, role: "admin" }),
      ),
    );

    expect(result.status).toBe(400);
  });
});

describe("admin edit product galleryAdd action", () => {
  it("rejects guests with 403", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await galleryAdd(fakeEvent(id, { fields: { imageUrl: "https://example.com/g.jpg" } })),
    );

    expect(result.status).toBe(403);
  });

  it("inserts a gallery image from a pasted https url", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = await galleryAdd(
      fakeEvent(id, { fields: { imageUrl: "https://example.com/g1.jpg" }, role: "admin" }),
    );

    expect(result).toEqual({
      galleryAdded: t("ar", "admin.products.galleryImageAdded"),
    });
    const rows = await currentDb()
      .select()
      .from(schema.productImage)
      .where(eq(schema.productImage.productId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toBe("https://example.com/g1.jpg");
    expect(rows[0]?.sortOrder).toBe(0);
  });

  it("inserts a gallery image from a file upload", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const ns = makeNamespace();

    const result = await galleryAdd(
      fakeEvent(id, {
        files: { image: pngFile("g.png") },
        platform: { env: { MEDIA: ns } },
        role: "admin",
      }),
    );

    expect(result).toEqual({
      galleryAdded: t("ar", "admin.products.galleryImageAdded"),
    });
    const rows = await currentDb()
      .select()
      .from(schema.productImage)
      .where(eq(schema.productImage.productId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toMatch(/^\/media\/products\//);
    expect(ns.calls).toHaveLength(1);
  });

  it("falls back to error 400 when neither file nor url is provided", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(await galleryAdd(fakeEvent(id, { role: "admin" })));

    expect(result.status).toBe(400);
  });

  it("rejects a malformed url with 400", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await galleryAdd(fakeEvent(id, { fields: { imageUrl: "not-a-url" }, role: "admin" })),
    );

    expect(result.status).toBe(400);
  });

  it("returns 404 when product does not exist", async () => {
    const id = crypto.randomUUID();
    const result = failureOf(
      await galleryAdd(
        fakeEvent(id, {
          fields: { imageUrl: "https://example.com/g.jpg" },
          role: "admin",
        }),
      ),
    );

    expect(result.status).toBe(404);
  });

  it("appends images with increasing sortOrder", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    await galleryAdd(
      fakeEvent(id, { fields: { imageUrl: "https://example.com/first.jpg" }, role: "admin" }),
    );
    await galleryAdd(
      fakeEvent(id, { fields: { imageUrl: "https://example.com/second.jpg" }, role: "admin" }),
    );

    const rows = await currentDb()
      .select({ url: schema.productImage.url, sortOrder: schema.productImage.sortOrder })
      .from(schema.productImage)
      .where(eq(schema.productImage.productId, id));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.sortOrder).toBe(0);
    expect(rows[1]?.sortOrder).toBe(1);
  });
});

describe("admin edit product galleryDelete action", () => {
  it("rejects guests with 403", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const imageId = await seedGalleryImage(id, "https://example.com/g.jpg");

    const result = failureOf(
      await galleryDelete(fakeEvent(id, { fields: { imageId }, role: undefined })),
    );

    expect(result.status).toBe(403);
  });

  it("removes a gallery image and reports deleted", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const imageId = await seedGalleryImage(id, "https://example.com/g.jpg");

    const result = await galleryDelete(fakeEvent(id, { fields: { imageId }, role: "admin" }));

    expect(result).toEqual({
      galleryRemoved: t("ar", "admin.products.galleryImageRemoved"),
    });
    const rows = await currentDb()
      .select()
      .from(schema.productImage)
      .where(eq(schema.productImage.id, imageId));
    expect(rows).toHaveLength(0);
  });

  it("returns 404 when image does not exist", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await galleryDelete(
        fakeEvent(id, { fields: { imageId: crypto.randomUUID() }, role: "admin" }),
      ),
    );

    expect(result.status).toBe(404);
  });

  it("fails 400 on a blank imageId", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await galleryDelete(fakeEvent(id, { fields: { imageId: "" }, role: "admin" })),
    );

    expect(result.status).toBe(400);
  });

  it("does not delete a gallery image belonging to a different product", async () => {
    const categoryId = await seedCategory();
    const idA = await seedProduct(categoryId);
    const idB = await seedProduct(categoryId);
    const imageId = await seedGalleryImage(idB, "https://example.com/g.jpg");

    const result = failureOf(
      await galleryDelete(fakeEvent(idA, { fields: { imageId }, role: "admin" })),
    );

    expect(result.status).toBe(404);
    const rows = await currentDb()
      .select()
      .from(schema.productImage)
      .where(eq(schema.productImage.id, imageId));
    expect(rows).toHaveLength(1);
  });
});

describe("admin edit product galleryReorder action", () => {
  it("rejects guests with 403", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const a = await seedGalleryImage(id, "https://example.com/a.jpg", 0);
    const b = await seedGalleryImage(id, "https://example.com/b.jpg", 1);

    const result = failureOf(
      await galleryReorder(fakeEvent(id, { fields: { order: `${b},${a}` } })),
    );

    expect(result.status).toBe(403);
  });

  it("reorders images and reports saved", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const a = await seedGalleryImage(id, "https://example.com/a.jpg", 0);
    const b = await seedGalleryImage(id, "https://example.com/b.jpg", 1);
    const c = await seedGalleryImage(id, "https://example.com/c.jpg", 2);

    const result = await galleryReorder(
      fakeEvent(id, { fields: { order: `${c},${a},${b}` }, role: "admin" }),
    );

    expect(result).toEqual({
      galleryOrdered: t("ar", "admin.products.galleryOrderSaved"),
    });
    const rows = await currentDb()
      .select({ id: schema.productImage.id, sortOrder: schema.productImage.sortOrder })
      .from(schema.productImage)
      .where(eq(schema.productImage.productId, id))
      .orderBy(schema.productImage.sortOrder);
    expect(rows.map((r) => r.id)).toEqual([c, a, b]);
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
  });

  it("returns 400 when the id set does not match", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const a = await seedGalleryImage(id, "https://example.com/a.jpg", 0);
    await seedGalleryImage(id, "https://example.com/b.jpg", 1);

    const result = failureOf(
      await galleryReorder(fakeEvent(id, { fields: { order: a }, role: "admin" })),
    );

    expect(result.status).toBe(400);
    const rows = await currentDb()
      .select({ sortOrder: schema.productImage.sortOrder })
      .from(schema.productImage)
      .where(eq(schema.productImage.productId, id));
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1]);
  });

  it("returns 400 on an empty order string", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);

    const result = failureOf(
      await galleryReorder(fakeEvent(id, { fields: { order: "" }, role: "admin" })),
    );

    expect(result.status).toBe(400);
  });

  it("is a no-op when the order is already correct", async () => {
    const categoryId = await seedCategory();
    const id = await seedProduct(categoryId);
    const a = await seedGalleryImage(id, "https://example.com/a.jpg", 0);
    const b = await seedGalleryImage(id, "https://example.com/b.jpg", 1);

    const result = await galleryReorder(
      fakeEvent(id, { fields: { order: `${a},${b}` }, role: "admin" }),
    );

    expect(result).toEqual({
      galleryOrdered: t("ar", "admin.products.galleryOrderSaved"),
    });
    const rows = await currentDb()
      .select({ id: schema.productImage.id, sortOrder: schema.productImage.sortOrder })
      .from(schema.productImage)
      .where(eq(schema.productImage.productId, id))
      .orderBy(schema.productImage.sortOrder);
    expect(rows.map((r) => r.id)).toEqual([a, b]);
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1]);
  });
});
