import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";

// Same guard as the sibling admin orders spec: seeding-heavy tests brush
// against vitest defaults when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import type { AdminOrderRow } from "$lib/server/admin/orders";
import type { PageServerData, PageServerLoadEvent } from "./$types";

// The loader imports the shared lazy `db` proxy; point it at this spec's
// file-backed client so the route is exercised end-to-end against real SQL.
const state = vi.hoisted(() => ({
  database: null as LibSQLDatabase<typeof schema> | null,
}));

vi.mock("$lib/server/db", () => ({
  get db(): LibSQLDatabase<typeof schema> {
    if (!state.database) throw new Error("test database not initialized");
    return state.database;
  },
}));

const DB_FILE = "admin-orders-page-test.db";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

// listOrders only reads store_order; a minimal production-shaped table keeps
// this spec independent of the full migration set.
async function buildDb(): Promise<void> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`
    CREATE TABLE store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE,
      nonce TEXT UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, governorate TEXT NOT NULL DEFAULT 'cairo', shipping_cost INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_confirmation', payment_status TEXT NOT NULL DEFAULT 'unpaid', stock_version TEXT NOT NULL DEFAULT 'legacy',
      payment_method TEXT NOT NULL DEFAULT 'simulated', payment_reference TEXT, payment_claimed_at INTEGER, payment_reviewed_at INTEGER,
      payment_reviewed_by TEXT, hold_expires_at INTEGER, paid_at INTEGER, user_id TEXT, created_at INTEGER NOT NULL
    )`);
  testDb = db;
  state.database = db;
}

interface SeedOptions {
  status?: AdminOrderRow["status"];
  createdAt?: number;
}

let orderCounter = 0;

async function seedOrder(
  db: LibSQLDatabase<typeof schema>,
  opts: SeedOptions = {},
): Promise<string> {
  orderCounter += 1;
  const id = crypto.randomUUID();
  await db.insert(schema.order).values({
    id,
    number: `HNY-${String(orderCounter).padStart(6, "0")}`,
    email: "a@example.com",
    name: "أحمد",
    phone: "01012345678",
    address: "شارع 9",
    city: "القاهرة",
    total: 100_00,
    status: opts.status ?? "placed",
    paymentStatus: "simulated",
    userId: null,
    createdAt: opts.createdAt ?? Date.now(),
  });
  return id;
}

function fakeEvent(url: string, cookies: Record<string, string> = {}): PageServerLoadEvent {
  // The loader only reads `url`, `cookies.get`, and request headers (getLang).
  return {
    url: new URL(url),
    cookies: { get: (name: string) => cookies[name] },
    request: new Request(url),
  } as unknown as PageServerLoadEvent;
}

// SvelteKit's `PageServerLoad` return type carries a `void` arm (loads may
// return nothing); this loader always returns data, so narrow once here to
// the route's generated concrete data type.
let load: (event: PageServerLoadEvent) => Promise<PageServerData>;

beforeAll(async () => {
  const module = await import("./+page.server");
  load = module.load as unknown as typeof load;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

describe("admin orders page load", () => {
  it("returns the newest-first first page with totals and defaults", async () => {
    const base = 1_700_000_000_000;
    const createdIds: string[] = [];
    const db = currentDb();
    for (let i = 0; i < 25; i++) {
      createdIds.push(await seedOrder(db, { createdAt: base + i * 1_000 }));
    }

    const data = await load(fakeEvent("http://localhost/admin/orders"));

    expect(data.items).toHaveLength(20);
    expect(data.total).toBe(25);
    expect(data.page).toBe(1);
    expect(data.status).toBeNull();
    expect(data.lang).toBe("ar"); // no cookie/header → Arabic default
    expect(data.items[0]?.id).toBe(createdIds[24]);
    expect(data.pageSize).toBe(20);
  });

  it("serves the requested page slice", async () => {
    const base = 1_700_000_000_000;
    const createdIds: string[] = [];
    const db = currentDb();
    for (let i = 0; i < 25; i++) {
      createdIds.push(await seedOrder(db, { createdAt: base + i * 1_000 }));
    }

    const data = await load(fakeEvent("http://localhost/admin/orders?page=2"));

    expect(data.page).toBe(2);
    expect(data.items.map((o) => o.id)).toEqual(createdIds.slice(0, 5).reverse());
  });

  it("clamps an out-of-range page to the last page instead of an empty list", async () => {
    const base = 1_700_000_000_000;
    const createdIds: string[] = [];
    const db = currentDb();
    for (let i = 0; i < 25; i++) {
      createdIds.push(await seedOrder(db, { createdAt: base + i * 1_000 }));
    }

    // Beyond-the-last page must land on the final page's items — never a
    // false "No orders." dead end. Also covers float64-huge values that
    // survive zod as integers (same empty-items branch).
    const clamped = await load(fakeEvent("http://localhost/admin/orders?page=99"));
    expect(clamped.page).toBe(2);
    expect(clamped.total).toBe(25);
    expect(clamped.items.map((o) => o.id)).toEqual(createdIds.slice(0, 5).reverse());

    const huge = await load(
      fakeEvent(`http://localhost/admin/orders?page=${Number.MAX_SAFE_INTEGER}`),
    );
    expect(huge.page).toBe(2);
    expect(huge.items).toHaveLength(5);
  });

  it("filters by a valid status in items and total", async () => {
    const base = 1_700_000_000_000;
    const db = currentDb();
    await seedOrder(db, { status: "placed", createdAt: base });
    await seedOrder(db, { status: "shipped", createdAt: base + 1_000 });
    await seedOrder(db, { status: "delivered", createdAt: base + 2_000 });

    const data = await load(fakeEvent("http://localhost/admin/orders?status=shipped"));

    expect(data.status).toBe("shipped");
    expect(data.total).toBe(1);
    expect(data.items.map((o) => o.status)).toEqual(["shipped"]);
  });

  it("degrades an unknown status to the unfiltered list with status null", async () => {
    const base = 1_700_000_000_000;
    const db = currentDb();
    await seedOrder(db, { status: "placed", createdAt: base });
    await seedOrder(db, { status: "cancelled", createdAt: base + 1_000 });

    const data = await load(fakeEvent("http://localhost/admin/orders?status=bogus"));

    expect(data.status).toBeNull();
    expect(data.total).toBe(2);
  });

  it.each([
    ["?page=abc", 1],
    ["?page=NaN", 1],
    ["?page=0", 1],
    ["?page=-3", 1],
    ["?page=2.9", 2],
  ])("normalizes %s to page %i so NaN offsets can never reach the DB", async (query, expected) => {
    const base = 1_700_000_000_000;
    const db = currentDb();
    for (let i = 0; i < 25; i++) {
      await seedOrder(db, { createdAt: base + i * 1_000 });
    }

    const data = await load(fakeEvent(`http://localhost/admin/orders${query}`));

    expect(data.page).toBe(expected);
    // Page-1 content proves NaN never produced a bogus offset.
    if (expected === 1) expect(data.items).toHaveLength(20);
    if (expected === 2) expect(data.items).toHaveLength(5);
  });

  it("resolves lang from the lang cookie", async () => {
    await seedOrder(currentDb());

    const data = await load(fakeEvent("http://localhost/admin/orders", { lang: "en" }));

    expect(data.lang).toBe("en");
  });
});
