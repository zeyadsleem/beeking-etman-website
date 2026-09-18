import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import {
  allowedPaymentTransitions,
  applyOrderTransition,
  applyPaymentTransition,
  canTransitionOrder,
  canTransitionPayment,
  recordPaymentEvent,
  storedOrderStatusValues,
} from "./lifecycle";

const DB_FILE = "settlement-lifecycle-test.db";

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
  opts: { status?: string; paymentStatus?: string } = {},
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
    createdAt: Date.now(),
  });
  return id;
}

describe("settlement transition guards", () => {
  it("enforces the fulfillment matrix", () => {
    expect(canTransitionOrder("pending_confirmation", "confirmed")).toBe(true);
    expect(canTransitionOrder("pending_confirmation", "cancelled")).toBe(true);
    expect(canTransitionOrder("confirmed", "processing")).toBe(true);
    expect(canTransitionOrder("confirmed", "shipped")).toBe(true);
    expect(canTransitionOrder("processing", "shipped")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered")).toBe(true);
    expect(canTransitionOrder("shipped", "cancelled")).toBe(false);
    expect(canTransitionOrder("delivered", "cancelled")).toBe(false);
    expect(canTransitionOrder("cancelled", "processing")).toBe(false);
  });

  it("enforces the payment matrix", () => {
    expect(allowedPaymentTransitions("unpaid")).toEqual(["pending_review", "paid", "failed"]);
    expect(canTransitionPayment("unpaid", "pending_review")).toBe(true);
    expect(canTransitionPayment("pending_review", "paid")).toBe(true);
    expect(canTransitionPayment("failed", "pending_review")).toBe(true);
    expect(canTransitionPayment("paid", "refunded")).toBe(true);
    expect(canTransitionPayment("paid", "pending_review")).toBe(false);
    expect(canTransitionPayment("refunded", "paid")).toBe(false);
    expect(canTransitionPayment("simulated", "paid")).toBe(false);
  });

  it("expands confirmed to its legacy stored aliases", () => {
    expect(storedOrderStatusValues("confirmed")).toEqual(["confirmed", "placed", "paid"]);
    expect(storedOrderStatusValues("shipped")).toEqual(["shipped"]);
  });
});

describe("applyOrderTransition", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("applies an allowed transition and rejects a forbidden one", async () => {
    const id = await seedOrder(db, { status: "pending_confirmation" });
    expect(
      await applyOrderTransition(db, {
        orderId: id,
        from: ["pending_confirmation"],
        to: "confirmed",
      }),
    ).toEqual({ ok: true });
    expect(
      await applyOrderTransition(db, { orderId: id, from: ["confirmed"], to: "delivered" }),
    ).toEqual({ ok: false, reason: "invalid_transition" });
  });

  it("matches legacy stored values for confirmed", async () => {
    const id = await seedOrder(db, { status: "placed" });
    expect(
      await applyOrderTransition(db, { orderId: id, from: ["confirmed"], to: "shipped" }),
    ).toEqual({ ok: true });
    const row = await db.select({ status: schema.order.status }).from(schema.order);
    expect(row[0]?.status).toBe("shipped");
  });

  it("returns invalid_transition when the stored status moved on", async () => {
    const id = await seedOrder(db, { status: "shipped" });
    expect(
      await applyOrderTransition(db, { orderId: id, from: ["confirmed"], to: "processing" }),
    ).toEqual({ ok: false, reason: "invalid_transition" });
  });
});

describe("applyPaymentTransition", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("stamps a claim and a verification", async () => {
    const id = await seedOrder(db);
    expect(
      await applyPaymentTransition(db, {
        orderId: id,
        from: ["unpaid"],
        to: "pending_review",
        now: 1000,
      }),
    ).toEqual({ ok: true });
    expect(
      await applyPaymentTransition(db, {
        orderId: id,
        from: ["pending_review"],
        to: "paid",
        reference: "TRX-1",
        reviewedBy: "admin-1",
        now: 2000,
      }),
    ).toEqual({ ok: true });

    const row = await db.select().from(schema.order);
    expect(row[0]).toMatchObject({
      paymentStatus: "paid",
      paymentClaimedAt: 1000,
      paymentReviewedAt: 2000,
      paymentReference: "TRX-1",
      paymentReviewedBy: "admin-1",
      paidAt: 2000,
    });
  });

  it("rejects a verification that skips the guard or races another writer", async () => {
    const id = await seedOrder(db, { paymentStatus: "paid" });
    expect(await applyPaymentTransition(db, { orderId: id, from: ["unpaid"], to: "paid" })).toEqual(
      { ok: false, reason: "invalid_transition" },
    );
    expect(
      await applyPaymentTransition(db, { orderId: id, from: ["paid"], to: "pending_review" }),
    ).toEqual({ ok: false, reason: "invalid_transition" });
  });

  it("records a full refund", async () => {
    const id = await seedOrder(db, { paymentStatus: "paid" });
    expect(
      await applyPaymentTransition(db, { orderId: id, from: ["paid"], to: "refunded" }),
    ).toEqual({ ok: true });
    const row = await db.select().from(schema.order);
    expect(row[0]?.paymentStatus).toBe("refunded");
  });
});

describe("recordPaymentEvent", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("appends an event with the caller's clock", async () => {
    const id = await seedOrder(db);
    await recordPaymentEvent(db, {
      orderId: id,
      type: "claim",
      actor: "customer",
      reference: "TRX-9",
      now: 5000,
    });
    const events = await db.select().from(schema.paymentEvent);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "claim",
      actor: "customer",
      reference: "TRX-9",
      createdAt: 5000,
    });
  });
});

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});
