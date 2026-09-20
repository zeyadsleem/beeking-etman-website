import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import type { RequestEvent } from "@sveltejs/kit";
import * as schema from "$lib/server/db/schema";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const state = vi.hoisted(() => ({
  database: null as LibSQLDatabase<typeof schema> | null,
}));

vi.mock("$lib/server/db", () => ({
  get db(): LibSQLDatabase<typeof schema> {
    if (!state.database) throw new Error("test database not initialized");
    return state.database;
  },
}));

const DB_FILE = "admin-order-invoice-test.db";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

async function buildDb(): Promise<void> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_admin_audit`);
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`
    CREATE TABLE store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE, nonce TEXT UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, governorate TEXT NOT NULL DEFAULT 'cairo',
      shipping_cost INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_confirmation', payment_status TEXT NOT NULL DEFAULT 'unpaid',
      stock_version TEXT NOT NULL DEFAULT 'legacy', payment_method TEXT NOT NULL DEFAULT 'simulated',
      payment_reference TEXT, payment_claimed_at INTEGER, payment_reviewed_at INTEGER,
      payment_reviewed_by TEXT, hold_expires_at INTEGER, paid_at INTEGER, user_id TEXT,
      created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL,
      product_id TEXT NOT NULL, variant_id TEXT, product_name TEXT NOT NULL,
      variant_name TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_admin_audit (
      id TEXT PRIMARY KEY NOT NULL, admin_user_id TEXT, action TEXT NOT NULL,
      target_type TEXT NOT NULL, target_id TEXT NOT NULL, details TEXT,
      created_at INTEGER NOT NULL
    )`);
  testDb = db;
  state.database = db;
}

async function seedOrder(db: LibSQLDatabase<typeof schema>): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.order).values({
    id,
    number: `HNY-${id.slice(0, 6)}`,
    email: "a@example.com",
    name: "أحمد",
    phone: "01012345678",
    address: "شارع 9",
    city: "القاهرة",
    total: 100_00,
    status: "pending_confirmation",
    paymentStatus: "unpaid",
    paymentMethod: "instapay",
    createdAt: Date.now(),
  });
  await db.insert(schema.orderItem).values({
    orderId: id,
    productId: crypto.randomUUID(),
    productName: "عسل سدر مصري",
    variantName: "كيلو",
    quantity: 2,
    unitPrice: 50_00,
  });
  return id;
}

function fakeEvent(id: string, role?: string): RequestEvent {
  return {
    params: { id },
    locals: { user: role === undefined ? undefined : { role } },
  } as unknown as RequestEvent;
}

let GET: (event: RequestEvent) => Promise<Response>;

beforeAll(async () => {
  const module = await import("./+server");
  GET = module.GET as unknown as typeof GET;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

describe("admin order invoice", () => {
  it("serves the invoice as private, no-store HTML", async () => {
    const id = await seedOrder(currentDb());

    const response = await GET(fakeEvent(id, "admin"));

    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toContain("HNY-");
  });

  it("rejects guests and non-admins with 403", async () => {
    const id = await seedOrder(currentDb());

    await expect(GET(fakeEvent(id))).rejects.toMatchObject({ status: 403 });
    await expect(GET(fakeEvent(id, "user"))).rejects.toMatchObject({ status: 403 });
  });
});
