import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { eq } from "drizzle-orm";
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

const DB_FILE = "admin-orders-export-test.db";

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

interface SeedOptions {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
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
    status: opts.status ?? "pending_confirmation",
    paymentStatus: opts.paymentStatus ?? "unpaid",
    paymentMethod: opts.paymentMethod ?? "instapay",
    createdAt: Date.now(),
  });
  return id;
}

function fakeEvent(query: string, role?: string): RequestEvent {
  return {
    url: new URL(`http://localhost/admin/orders/export${query}`),
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

describe("admin orders CSV export", () => {
  it("rejects guests and non-admins with 403", async () => {
    await seedOrder(currentDb());

    await expect(GET(fakeEvent(""))).rejects.toMatchObject({ status: 403 });
    await expect(GET(fakeEvent("", "user"))).rejects.toMatchObject({ status: 403 });
  });

  it("rejects an invalid payment filter with 400", async () => {
    await expect(GET(fakeEvent("?payment=bogus", "admin"))).rejects.toMatchObject({ status: 400 });
  });

  it("applies the payment filter and exports the payment columns", async () => {
    const db = currentDb();
    const claimable = await seedOrder(db, {
      paymentStatus: "pending_review",
      paymentMethod: "wallet",
    });
    await seedOrder(db, { paymentStatus: "paid", paymentMethod: "cod" });

    const response = await GET(fakeEvent("?payment=pending_review", "admin"));
    const csv = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(csv).toContain("طريقة الدفع");
    expect(csv).toContain("حالة الدفع");
    expect(csv).toContain("محفظة");
    expect(csv).toContain("بانتظار المراجعة");
    expect(csv).not.toContain("قديم (غير محدد)");

    const claimableRow = await db
      .select({ number: schema.order.number })
      .from(schema.order)
      .where(eq(schema.order.id, claimable))
      .get();
    expect(csv).toContain(claimableRow?.number ?? "");
    // Only the pending-review order appears in the export.
    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });

  it("composes the status and payment filters", async () => {
    const db = currentDb();
    await seedOrder(db, { status: "confirmed", paymentStatus: "pending_review" });
    await seedOrder(db, { status: "shipped", paymentStatus: "pending_review" });
    await seedOrder(db, { status: "confirmed", paymentStatus: "paid" });

    const csv = await (
      await GET(fakeEvent("?status=confirmed&payment=pending_review", "admin"))
    ).text();

    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });
});
