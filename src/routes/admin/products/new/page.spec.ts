import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";

// Seeding-heavy tests and per-test schema rebuilds brush against vitest
// defaults when the whole suite runs in parallel — same guard as the sibling
// admin specs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { isActionFailure, type RequestEvent } from "@sveltejs/kit";
import * as schema from "$lib/server/db/schema";
import { t } from "$lib/i18n/messages";

// The route imports the shared lazy `db` proxy; point it at this spec's
// file-backed client so load + action are exercised end-to-end against real SQL.
const state = vi.hoisted(() => ({
  database: null as LibSQLDatabase<typeof schema> | null,
}));

vi.mock("$lib/server/db", () => ({
  get db(): LibSQLDatabase<typeof schema> {
    if (!state.database) throw new Error("test database not initialized");
    return state.database;
  },
}));

const DB_FILE = "admin-product-new-test.db";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

// createProduct touches categories, products, and probes slugs against
// products; the DDL mirrors production migrations verbatim (see sibling
// lib/server/admin/products.spec.ts).
async function buildDb(): Promise<void> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
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

interface PutCall {
  key: string;
  value: ReadableStream | ArrayBuffer;
}

/** Fake R2 bucket capturing every put so tests assert keys and payloads. */
function makeBucket(): {
  put(key: string, value: ReadableStream | ArrayBuffer): Promise<unknown>;
  calls: PutCall[];
} {
  const calls: PutCall[] = [];
  return {
    calls,
    put(key, value) {
      calls.push({ key, value });
      return Promise.resolve(undefined);
    },
  };
}

const MEDIA_BASE = "https://media.example.com";
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_BYTES = [0xff, 0xd8, 0xff];

function pngFile(name = "honey.png"): File {
  return new File([new Uint8Array(PNG_BYTES)], name, { type: "image/png" });
}

interface EventOptions {
  role?: string;
  langCookie?: "ar" | "en";
  fields?: Record<string, string>;
  files?: Record<string, File>;
  /** Omitted entirely when undefined — exercises the no-platform guard. */
  platform?: { env: { MEDIA: unknown; MEDIA_PUBLIC_BASE_URL?: string } };
}

// The loader reads `url`, `cookies.get`, and request headers (getLang); the
// action additionally reads `locals.user?.role`, the multipart body, and
// `platform.env.MEDIA` — fabricate exactly that surface.
function fakeEvent(opts: EventOptions = {}): RequestEvent {
  const body = new FormData();
  for (const [key, value] of Object.entries(opts.fields ?? {})) body.set(key, value);
  for (const [key, file] of Object.entries(opts.files ?? {})) body.set(key, file);
  return {
    url: new URL("http://localhost/admin/products/new"),
    cookies: { get: (name: string) => (name === "lang" ? opts.langCookie : undefined) },
    request: new Request("http://localhost/admin/products/new", { method: "POST", body }),
    locals: { user: opts.role === undefined ? undefined : { role: opts.role } },
    ...(opts.platform === undefined ? {} : { platform: opts.platform }),
  } as unknown as RequestEvent;
}

function failureOf(result: unknown): { status: number; message: string } {
  if (!isActionFailure(result)) throw new Error("expected an ActionFailure");
  const data = result.data as { message?: string } | undefined;
  return { status: result.status, message: data?.message ?? "" };
}

async function productRows(): Promise<
  Array<{ id: string; slug: string; image: string; featured: number }>
> {
  return currentDb()
    .select({
      id: schema.product.id,
      slug: schema.product.slug,
      image: schema.product.image,
      featured: schema.product.featured,
    })
    .from(schema.product);
}

const BASE_FIELDS = {
  name: "عسل سدر ملكي",
  nameEn: "Royal Sidr",
  slug: "",
  description: "وصف طويل بما يكفي",
  descriptionEn: "",
  price: "250.50",
  categoryId: "",
  imageUrl: "",
};

function baseFields(categoryId: string): Record<string, string> {
  return { ...BASE_FIELDS, categoryId };
}

type LoadFn = (event: RequestEvent) => Promise<unknown>;
type DefaultAction = (event: RequestEvent) => Promise<unknown>;

let load: LoadFn;
let create: DefaultAction;

beforeAll(async () => {
  const module = await import("./+page.server");
  load = module.load as unknown as LoadFn;
  create = (module.actions as { default: DefaultAction }).default;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

describe("admin new product load", () => {
  it("returns categories localized to arabic by default", async () => {
    await seedCategory("برسيم", "Clover");
    await seedCategory("سدر", "Sidr");

    const data = (await load(fakeEvent())) as {
      categories: Array<{ id: string; name: string }>;
      lang: string;
    };

    expect(data.lang).toBe("ar");
    expect(data.categories.map((c) => c.name)).toEqual(["برسيم", "سدر"]);
  });

  it("falls back to the arabic name when the english column is blank", async () => {
    await seedCategory("يانسون");

    const data = (await load(fakeEvent())) as { categories: Array<{ name: string }> };

    expect(data.categories.map((c) => c.name)).toEqual(["يانسون"]);
  });

  it("localizes categories to english from the lang cookie, falling back to arabic", async () => {
    await seedCategory("برسيم", "Clover");
    await seedCategory("يانسون", "");

    const data = (await load(fakeEvent({ langCookie: "en" }))) as {
      categories: Array<{ name: string }>;
    };

    expect(data.categories.map((c) => c.name)).toEqual(["Clover", "يانسون"]);
  });
});

describe("admin new product default action", () => {
  it("rejects guests and non-admins with 403 and writes nothing", async () => {
    const categoryId = await seedCategory();

    for (const role of [undefined, "user"] as const) {
      const result = failureOf(await create(fakeEvent({ fields: baseFields(categoryId), role })));
      expect(result.status).toBe(403);
      expect(result.message).toBe(t("ar", "errors.unexpected"));
    }
    expect(await productRows()).toHaveLength(0);
  });

  it.each([
    { label: "missing name", patch: { name: "" } },
    { label: "non-numeric price", patch: { price: "abc" } },
    { label: "zero price", patch: { price: "0" } },
    { label: "negative price", patch: { price: "-5" } },
    { label: "sub-qirsh price", patch: { price: "12.999" } },
    { label: "blank price", patch: { price: "" } },
  ] as Array<{ label: string; patch: Record<string, string> }>)(
    "fails 400 on $label and writes nothing",
    async ({ patch }) => {
      const categoryId = await seedCategory();

      const result = failureOf(
        await create(fakeEvent({ fields: { ...baseFields(categoryId), ...patch }, role: "admin" })),
      );

      expect(result.status).toBe(400);
      expect(result.message).toBe(t("ar", "errors.unexpected"));
      expect(await productRows()).toHaveLength(0);
    },
  );

  it("creates the product, converting the EGP price to integer qirsh", async () => {
    const categoryId = await seedCategory();

    await expect(
      create(fakeEvent({ fields: baseFields(categoryId), role: "admin" })),
    ).rejects.toMatchObject({
      status: 303,
    });

    const [row] = await currentDb()
      .select({
        id: schema.product.id,
        name: schema.product.name,
        nameEn: schema.product.nameEn,
        price: schema.product.price,
        featured: schema.product.featured,
        categoryId: schema.product.categoryId,
      })
      .from(schema.product);
    expect(row?.name).toBe("عسل سدر ملكي");
    expect(row?.nameEn).toBe("Royal Sidr");
    expect(row?.price).toBe(25_050);
    expect(row?.featured).toBe(0);
    expect(row?.categoryId).toBe(categoryId);
  });

  it("redirects 303 to the created product's edit page", async () => {
    const categoryId = await seedCategory();
    let location = "";
    await create(fakeEvent({ fields: baseFields(categoryId), role: "admin" })).catch(
      (error: { status?: number; location?: string }) => {
        expect(error.status).toBe(303);
        location = error.location ?? "";
      },
    );

    const [row] = await productRows();
    expect(location).toBe(`/admin/products/${row?.id}`);
  });

  it("derives the slug from nameEn when left blank", async () => {
    const categoryId = await seedCategory();

    await expect(
      create(fakeEvent({ fields: baseFields(categoryId), role: "admin" })),
    ).rejects.toMatchObject({
      status: 303,
    });
    const [row] = await productRows();
    expect(row?.slug).toBe("royal-sidr");
  });

  it("honors an explicit slug over the derived one", async () => {
    const categoryId = await seedCategory();

    await expect(
      create(
        fakeEvent({ fields: { ...baseFields(categoryId), slug: "sidr-royal" }, role: "admin" }),
      ),
    ).rejects.toMatchObject({ status: 303 });

    const [row] = await productRows();
    expect(row?.slug).toBe("sidr-royal");
  });

  it("falls back to the generic slug for an arabic-only submission", async () => {
    const categoryId = await seedCategory();

    await expect(
      create(
        fakeEvent({
          fields: {
            ...baseFields(categoryId),
            name: "عسل البرسيم",
            nameEn: "",
            slug: "",
          },
          role: "admin",
        }),
      ),
    ).rejects.toMatchObject({ status: 303 });

    const [row] = await productRows();
    expect(row?.slug).toBe("product"); // generateSlug's ascii-fold fallback
  });

  it("persists the featured flag when the checkbox rides along", async () => {
    const categoryId = await seedCategory();

    await expect(
      create(fakeEvent({ fields: { ...baseFields(categoryId), featured: "1" }, role: "admin" })),
    ).rejects.toMatchObject({ status: 303 });

    const [row] = await productRows();
    expect(row?.featured).toBe(1);
  });

  it("maps an unknown category to 409 with a localized message and writes nothing", async () => {
    await seedCategory();

    const result = failureOf(
      await create(
        fakeEvent({ fields: { ...BASE_FIELDS, categoryId: crypto.randomUUID() }, role: "admin" }),
      ),
    );

    expect(result.status).toBe(409);
    expect(result.message).toBe(t("ar", "admin.products.categoryMissing"));
    expect(await productRows()).toHaveLength(0);
  });

  it("uploads a png to r2 and persists the returned url onto the product", async () => {
    const categoryId = await seedCategory();
    const bucket = makeBucket();

    await expect(
      create(
        fakeEvent({
          fields: baseFields(categoryId),
          files: { image: pngFile() },
          role: "admin",
          platform: { env: { MEDIA: bucket, MEDIA_PUBLIC_BASE_URL: MEDIA_BASE } },
        }),
      ),
    ).rejects.toMatchObject({ status: 303 });

    expect(bucket.calls).toHaveLength(1);
    const call = bucket.calls[0];
    expect(call?.key).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    const [row] = await productRows();
    expect(row?.image).toBe(`${MEDIA_BASE}/${call?.key}`);
  });

  it.each([
    {
      label: "oversize",
      file: () =>
        new File([new Uint8Array(JPEG_BYTES), new Uint8Array(5 * 1024 * 1024)], "big.jpg"),
      expectedStatus: 400,
      expectedMessage: t("ar", "errors.uploadTooLarge"),
    },
    {
      label: "unsupported bytes",
      file: () => new File([new TextEncoder().encode("not an image")], "x.png"),
      expectedStatus: 400,
      expectedMessage: t("ar", "errors.uploadUnsupported"),
    },
  ])(
    "fails 400 on a $label file and creates nothing",
    async ({ file, expectedStatus, expectedMessage }) => {
      const categoryId = await seedCategory();
      const bucket = makeBucket();

      const result = failureOf(
        await create(
          fakeEvent({
            fields: baseFields(categoryId),
            files: { image: file() },
            role: "admin",
            platform: { env: { MEDIA: bucket, MEDIA_PUBLIC_BASE_URL: MEDIA_BASE } },
          }),
        ),
      );

      expect(result.status).toBe(expectedStatus);
      expect(result.message).toBe(expectedMessage);
      expect(bucket.calls).toHaveLength(0);
      expect(await productRows()).toHaveLength(0);
    },
  );

  it("reports storage_unavailable with 503 when no platform is bound, creating nothing", async () => {
    const categoryId = await seedCategory();
    const bucket = makeBucket();

    const result = failureOf(
      await create(
        fakeEvent({
          fields: baseFields(categoryId),
          files: { image: pngFile() },
          role: "admin",
          platform: { env: { MEDIA: bucket } },
        }),
      ),
    );

    expect(result.status).toBe(503);
    expect(result.message).toBe(t("ar", "errors.storageUnavailable"));
    expect(bucket.calls).toHaveLength(0);
    expect(await productRows()).toHaveLength(0);
  });

  it("persists a manually pasted url when no file is chosen", async () => {
    const categoryId = await seedCategory();
    const pasted = "https://cdn.example.com/jars/sidr.jpg";

    await expect(
      create(fakeEvent({ fields: { ...baseFields(categoryId), imageUrl: pasted }, role: "admin" })),
    ).rejects.toMatchObject({ status: 303 });

    const [row] = await productRows();
    expect(row?.image).toBe(pasted);
  });

  it("lets the uploaded file win over a simultaneously pasted url", async () => {
    const categoryId = await seedCategory();
    const bucket = makeBucket();

    await expect(
      create(
        fakeEvent({
          fields: { ...baseFields(categoryId), imageUrl: "https://cdn.example.com/pasted.jpg" },
          role: "admin",
          files: { image: pngFile() },
          platform: { env: { MEDIA: bucket, MEDIA_PUBLIC_BASE_URL: MEDIA_BASE } },
        }),
      ),
    ).rejects.toMatchObject({ status: 303 });

    const call = bucket.calls[0];
    const [row] = await productRows();
    expect(row?.image).toBe(`${MEDIA_BASE}/${call?.key}`);
  });

  it("rejects a malformed pasted url with 400 instead of storing garbage", async () => {
    const categoryId = await seedCategory();

    const result = failureOf(
      await create(
        fakeEvent({ fields: { ...baseFields(categoryId), imageUrl: "not-a-url" }, role: "admin" }),
      ),
    );

    expect(result.status).toBe(400);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
    expect(await productRows()).toHaveLength(0);
  });

  it("localizes failure messages from the lang cookie", async () => {
    await seedCategory();

    const result = failureOf(
      await create(
        fakeEvent({
          langCookie: "en",
          role: "admin",
          fields: { ...BASE_FIELDS, categoryId: crypto.randomUUID() },
        }),
      ),
    );

    expect(result.message).toBe(t("en", "admin.products.categoryMissing"));
  });
});
