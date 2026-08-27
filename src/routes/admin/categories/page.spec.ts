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

const DB_FILE = "admin-categories-page-test.db";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

// The actions touch exactly these tables; the DDL mirrors production
// migrations verbatim (see sibling lib/server/admin/categories.spec.ts).
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

async function seedCategory(
  values: { name?: string; nameEn?: string; slug?: string } = {},
): Promise<string> {
  const db = currentDb();
  const row = (
    await db
      .insert(schema.category)
      .values({
        name: values.name ?? "عسل السدر",
        nameEn: values.nameEn ?? "Sidr",
        slug: values.slug ?? crypto.randomUUID(),
      })
      .returning({ id: schema.category.id })
  )[0];
  if (!row) throw new Error("seedCategory insert returned no row");
  return row.id;
}

async function seedProduct(categoryId: string): Promise<void> {
  await currentDb()
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
    });
}

interface EventOptions {
  role?: string;
  langCookie?: "ar" | "en";
}

// The actions read `locals.user?.role`, `url`, `cookies.get`, and request
// headers (getLang) — fabricate exactly that surface.
function fakeEvent(opts: EventOptions = {}, formData?: Record<string, string>): RequestEvent {
  const body = new FormData();
  if (formData) for (const [key, value] of Object.entries(formData)) body.set(key, value);
  return {
    params: {},
    url: new URL("http://localhost/admin/categories"),
    cookies: { get: () => opts.langCookie },
    request: new Request("http://localhost/admin/categories", {
      method: "POST",
      body,
    }),
    locals: { user: opts.role === undefined ? undefined : { role: opts.role } },
  } as unknown as RequestEvent;
}

// Test-only narrowings, mirroring the sibling orders/[id]/page.spec.ts:
// actions return plain results or ActionFailures.
function failureOf(result: unknown): { status: number; message: string } {
  if (!isActionFailure(result)) throw new Error("expected an ActionFailure");
  const data = result.data as { message?: string } | undefined;
  return { status: result.status, message: data?.message ?? "" };
}

type SaveAction = (event: RequestEvent) => Promise<unknown>;
type DeleteAction = (event: RequestEvent) => Promise<unknown>;
type LoadFn = (event: RequestEvent) => Promise<unknown>;

let load: LoadFn;
let save: SaveAction;
let remove: DeleteAction;

beforeAll(async () => {
  const module = await import("./+page.server");
  load = module.load as unknown as LoadFn;
  save = (module.actions as { save: SaveAction }).save;
  remove = (module.actions as { delete: DeleteAction }).delete;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

describe("admin categories load", () => {
  it("lists categories with product counts and the resolved lang", async () => {
    const id = await seedCategory({ slug: "sidr" });

    const data = (await load(fakeEvent())) as {
      categories: { id: string; slug: string; productCount: number }[];
      lang: string;
    };

    expect(data.lang).toBe("ar"); // no cookie/header → Arabic default
    expect(data.categories).toHaveLength(1);
    expect(data.categories[0]).toMatchObject({ id, slug: "sidr", productCount: 0 });
  });
});

describe("admin categories save action", () => {
  it("rejects guests with 403 even though the layout guards pages", async () => {
    const result = failureOf(await save(fakeEvent({}, { name: "ن", nameEn: "", slug: "" })));

    expect(result.status).toBe(403);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("rejects authenticated non-admins with 403", async () => {
    const result = failureOf(
      await save(fakeEvent({ role: "user" }, { name: "ن", nameEn: "", slug: "" })),
    );

    expect(result.status).toBe(403);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("creates a category through a valid payload and persists the generated slug", async () => {
    const result = await save(
      fakeEvent({ role: "admin" }, { name: "عسل السدر", nameEn: "Sidr Honey!", slug: "" }),
    );

    expect(result).toEqual({ saved: true });
    const row = await currentDb().select().from(schema.category).get();
    expect(row).toMatchObject({ name: "عسل السدر", nameEn: "Sidr Honey!", slug: "sidr-honey" });
  });

  it("guides the Arabic-first workflow with slugRequired instead of a generic error", async () => {
    // Arabic-only name with blank English name and blank slug can never
    // generate a slug — the exact deterministic dead end under review.
    const result = failureOf(
      await save(fakeEvent({ role: "admin" }, { name: "عسل السدر", nameEn: "", slug: "" })),
    );

    expect(result.status).toBe(400);
    expect(result.message).toBe(t("ar", "admin.categories.slugRequired"));
  });

  it("localizes validation guidance via the lang cookie", async () => {
    const result = failureOf(
      await save(
        fakeEvent({ role: "admin", langCookie: "en" }, { name: "عسل السدر", nameEn: "", slug: "" }),
      ),
    );

    expect(result.message).toBe(t("en", "admin.categories.slugRequired"));
  });

  it("maps a duplicate slug to a 409 slugTaken failure without writing", async () => {
    await seedCategory({ slug: "sidr" });

    const result = failureOf(
      await save(fakeEvent({ role: "admin" }, { name: "ثانٍ", nameEn: "", slug: "sidr" })),
    );

    expect(result.status).toBe(409);
    expect(result.message).toBe(t("ar", "admin.categories.slugTaken"));
    const rows = await currentDb().select().from(schema.category);
    expect(rows).toHaveLength(1);
  });
});

describe("admin categories delete action", () => {
  it("rejects guests and non-admins with 403", async () => {
    const id = await seedCategory();

    for (const role of [undefined, "user"] as const) {
      const result = failureOf(await remove(fakeEvent(role ? { role } : {}, { id })));
      expect(result.status).toBe(403);
      expect(result.message).toBe(t("ar", "errors.unexpected"));
    }
    const rows = await currentDb().select().from(schema.category);
    expect(rows).toHaveLength(1); // untouched
  });

  it("blocks deleting a category that still has products with a 409 hasProductsError", async () => {
    const id = await seedCategory({ slug: "sidr" });
    await seedProduct(id);

    const result = failureOf(await remove(fakeEvent({ role: "admin" }, { id })));

    expect(result.status).toBe(409);
    expect(result.message).toBe(t("ar", "admin.categories.hasProductsError"));
    const row = await currentDb()
      .select()
      .from(schema.category)
      .where(eq(schema.category.id, id))
      .get();
    expect(row?.slug).toBe("sidr"); // still there
  });

  it("maps a vanished category to 404", async () => {
    const result = failureOf(
      await remove(fakeEvent({ role: "admin" }, { id: crypto.randomUUID() })),
    );

    expect(result.status).toBe(404);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("deletes an empty category and reports success", async () => {
    const id = await seedCategory({ slug: "empty-cat" });

    const result = await remove(fakeEvent({ role: "admin" }, { id }));

    expect(result).toEqual({ deleted: true });
    const rows = await currentDb().select().from(schema.category);
    expect(rows).toHaveLength(0);
  });
});
