import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { sanitizeReference, submitClaim } from "./claims";

const DB_FILE = "settlement-claims-test.db";

let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_payment_event`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`
    CREATE TABLE store_order (
      id TEXT PRIMARY KEY NOT NULL,
      number TEXT NOT NULL UNIQUE,
      nonce TEXT UNIQUE,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      governorate TEXT NOT NULL DEFAULT 'cairo',
      shipping_cost INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_confirmation',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      stock_version TEXT NOT NULL DEFAULT 'legacy',
      payment_method TEXT NOT NULL DEFAULT 'simulated',
      payment_reference TEXT,
      payment_claimed_at INTEGER,
      payment_reviewed_at INTEGER,
      payment_reviewed_by TEXT,
      hold_expires_at INTEGER,
      paid_at INTEGER,
      user_id TEXT,
      created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_payment_event (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'system',
      actor_user_id TEXT,
      method TEXT,
      reference TEXT,
      note TEXT,
      created_at INTEGER NOT NULL
    )`);
  return db;
}

async function seedOrder(
  db: Awaited<ReturnType<typeof buildDb>>,
  opts: { status?: string; paymentStatus?: string; method?: string } = {},
): Promise<string> {
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
    status: opts.status ?? "pending_confirmation",
    paymentStatus: opts.paymentStatus ?? "unpaid",
    paymentMethod: opts.method ?? "instapay",
    createdAt: Date.now(),
  });
  return id;
}

describe("sanitizeReference", () => {
  it("strips control, format, and separator characters", () => {
    expect(sanitizeReference("TRX\u0085-9")).toBe("TRX-9");
    expect(sanitizeReference("TRX\uFEFF-9")).toBe("TRX-9");
    expect(sanitizeReference("TRX\u2060-9")).toBe("TRX-9");
    expect(sanitizeReference("TRX\u2028-9")).toBe("TRX-9");
    expect(sanitizeReference("TRX\u2029-9")).toBe("TRX-9");
    expect(sanitizeReference("TRX\u202E-9")).toBe("TRX-9");
  });
});

describe("submitClaim", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("moves a transfer order to pending_review and appends a claim event", async () => {
    const id = await seedOrder(db, { method: "wallet" });

    expect(await submitClaim(db, { orderId: id, reference: "TRX-9", now: 5000 })).toEqual({
      ok: true,
    });

    const order = await db.select().from(schema.order);
    expect(order[0]).toMatchObject({
      paymentStatus: "pending_review",
      paymentClaimedAt: 5000,
      paymentReference: "TRX-9",
    });
    const events = await db.select().from(schema.paymentEvent);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      orderId: id,
      type: "claim",
      actor: "customer",
      method: "wallet",
      reference: "TRX-9",
      createdAt: 5000,
    });
  });

  it("rejects a duplicate claim and appends no second event", async () => {
    const id = await seedOrder(db);
    expect(await submitClaim(db, { orderId: id })).toEqual({ ok: true });
    expect(await submitClaim(db, { orderId: id })).toEqual({
      ok: false,
      reason: "already_claimed",
    });
    const events = await db.select().from(schema.paymentEvent);
    expect(events).toHaveLength(1);
  });

  it("allows a corrected claim after a rejection", async () => {
    const id = await seedOrder(db, { paymentStatus: "failed" });
    expect(await submitClaim(db, { orderId: id, reference: "TRX-2" })).toEqual({ ok: true });
    const order = await db.select().from(schema.order);
    expect(order[0]?.paymentStatus).toBe("pending_review");
  });

  it("refuses non-transfer, cancelled, paid, and missing orders", async () => {
    const cod = await seedOrder(db, { method: "cod" });
    expect(await submitClaim(db, { orderId: cod })).toEqual({
      ok: false,
      reason: "not_transfer_method",
    });

    const cancelled = await seedOrder(db, { status: "cancelled" });
    expect(await submitClaim(db, { orderId: cancelled })).toEqual({
      ok: false,
      reason: "not_claimable",
    });

    const paid = await seedOrder(db, { paymentStatus: "paid" });
    expect(await submitClaim(db, { orderId: paid })).toEqual({
      ok: false,
      reason: "not_claimable",
    });

    expect(await submitClaim(db, { orderId: crypto.randomUUID() })).toEqual({
      ok: false,
      reason: "order_not_found",
    });
  });
});

afterAll(() => {
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
});
