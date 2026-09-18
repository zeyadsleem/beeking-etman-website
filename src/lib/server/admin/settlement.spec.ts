import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { extendHold, rejectClaim, refundPayment, verifyPayment } from "./settlement";

const DB_FILE = "admin-settlement-test.db";

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
  opts: {
    status?: string;
    paymentStatus?: string;
    method?: string;
    paymentReference?: string | null;
    holdExpiresAt?: number | null;
  } = {},
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
    paymentReference: opts.paymentReference ?? null,
    holdExpiresAt: opts.holdExpiresAt ?? null,
    createdAt: Date.now(),
  });
  return id;
}

async function eventsFor(
  db: Awaited<ReturnType<typeof buildDb>>,
  orderId: string,
): Promise<(typeof schema.paymentEvent.$inferSelect)[]> {
  return db.select().from(schema.paymentEvent).where(eq(schema.paymentEvent.orderId, orderId));
}

describe("verifyPayment", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("moves unpaid to paid, stamps the review, and appends a verified event", async () => {
    const id = await seedOrder(db);

    expect(
      await verifyPayment(db, {
        orderId: id,
        reference: "TRX-9",
        actorUserId: "admin-1",
        now: 5000,
      }),
    ).toEqual({ ok: true });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order).toMatchObject({
      paymentStatus: "paid",
      paymentReference: "TRX-9",
      paidAt: 5000,
      paymentReviewedAt: 5000,
      paymentReviewedBy: "admin-1",
    });
    const events = await eventsFor(db, id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "verified",
      actor: "admin",
      actorUserId: "admin-1",
      reference: "TRX-9",
      note: null,
      createdAt: 5000,
    });
  });

  it("accepts a note in place of the transfer reference", async () => {
    const id = await seedOrder(db, { paymentStatus: "pending_review" });

    expect(await verifyPayment(db, { orderId: id, note: "cash counted" })).toEqual({ ok: true });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.paymentStatus).toBe("paid");
    const events = await eventsFor(db, id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "verified", note: "cash counted" });
  });

  it("preserves the customer's claim reference when verifying by note only", async () => {
    const id = await seedOrder(db, {
      paymentStatus: "pending_review",
      paymentReference: "TRX-9",
    });

    expect(await verifyPayment(db, { orderId: id, note: "cash counted" })).toEqual({ ok: true });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order).toMatchObject({ paymentStatus: "paid", paymentReference: "TRX-9" });
  });

  it("requires a reference or a note and appends no event otherwise", async () => {
    const id = await seedOrder(db);

    expect(await verifyPayment(db, { orderId: id, reference: "  " })).toEqual({
      ok: false,
      reason: "invalid_input",
    });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.paymentStatus).toBe("unpaid");
    expect(await eventsFor(db, id)).toHaveLength(0);
  });

  it("refuses an already paid order without appending an event", async () => {
    const id = await seedOrder(db, { paymentStatus: "paid" });

    expect(await verifyPayment(db, { orderId: id, note: "double check" })).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(await eventsFor(db, id)).toHaveLength(0);
  });
});

describe("rejectClaim", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("moves pending_review to failed and appends a rejected event", async () => {
    const id = await seedOrder(db, { paymentStatus: "pending_review" });

    expect(
      await rejectClaim(db, {
        orderId: id,
        note: "no transfer found",
        actorUserId: "admin-1",
        now: 6000,
      }),
    ).toEqual({ ok: true });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order).toMatchObject({ paymentStatus: "failed", paymentReviewedAt: 6000 });
    const events = await eventsFor(db, id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "rejected",
      actor: "admin",
      actorUserId: "admin-1",
      note: "no transfer found",
      createdAt: 6000,
    });
  });

  it("requires a note", async () => {
    const id = await seedOrder(db, { paymentStatus: "pending_review" });

    expect(await rejectClaim(db, { orderId: id })).toEqual({ ok: false, reason: "invalid_input" });
    expect(await eventsFor(db, id)).toHaveLength(0);
  });

  it("refuses an order with no open claim", async () => {
    const id = await seedOrder(db);

    expect(await rejectClaim(db, { orderId: id, note: "rejected" })).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(await eventsFor(db, id)).toHaveLength(0);
  });
});

describe("refundPayment", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("moves paid to refunded and appends a refund event", async () => {
    const id = await seedOrder(db, { paymentStatus: "paid" });

    expect(
      await refundPayment(db, {
        orderId: id,
        reference: "RF-1",
        note: "customer changed mind",
        actorUserId: "admin-1",
        now: 7000,
      }),
    ).toEqual({ ok: true });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order).toMatchObject({ paymentStatus: "refunded", paymentReviewedAt: 7000 });
    const events = await eventsFor(db, id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "refund",
      actor: "admin",
      actorUserId: "admin-1",
      reference: "RF-1",
      note: "customer changed mind",
      createdAt: 7000,
    });
  });

  it("requires both the reason and the reference", async () => {
    const id = await seedOrder(db, { paymentStatus: "paid" });

    expect(await refundPayment(db, { orderId: id, reference: "RF-1" })).toEqual({
      ok: false,
      reason: "invalid_input",
    });
    expect(await refundPayment(db, { orderId: id, note: "reason only" })).toEqual({
      ok: false,
      reason: "invalid_input",
    });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.paymentStatus).toBe("paid");
    expect(await eventsFor(db, id)).toHaveLength(0);
  });

  it("refuses an unpaid order", async () => {
    const id = await seedOrder(db);

    expect(await refundPayment(db, { orderId: id, reference: "RF-1", note: "reason" })).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(await eventsFor(db, id)).toHaveLength(0);
  });
});

describe("extendHold", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("adds 24 hours to the current deadline and appends a note event", async () => {
    const id = await seedOrder(db, { holdExpiresAt: 10_000 });

    expect(await extendHold(db, { orderId: id, actorUserId: "admin-1", now: 1000 })).toEqual({
      ok: true,
    });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.holdExpiresAt).toBe(10_000 + 24 * 3_600_000);
    const events = await eventsFor(db, id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "note",
      actor: "admin",
      actorUserId: "admin-1",
      note: "hold extended 24h",
      createdAt: 1000,
    });
  });

  it("starts the window from now when no deadline exists", async () => {
    const id = await seedOrder(db);

    expect(await extendHold(db, { orderId: id, now: 2000 })).toEqual({ ok: true });

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.holdExpiresAt).toBe(2000 + 24 * 3_600_000);
  });

  it("refuses a shipped order without appending an event", async () => {
    const id = await seedOrder(db, { status: "shipped" });

    expect(await extendHold(db, { orderId: id, now: 2000 })).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(await eventsFor(db, id)).toHaveLength(0);
  });
});

afterAll(() => {
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
});
