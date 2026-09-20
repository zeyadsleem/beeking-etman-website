import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { HOLD_EXPIRY_GRACE_MS, releaseExpiredHolds } from "./expiry";
import { runSettlementJobs } from "./jobs";

const DB_FILE = "settlement-expiry-test.db";

// Fake clock: deadlines are absolute epoch ms, so the injected `now` alone
// decides every selection.
const NOW = 1_700_000_000_000;
const EXPIRED_AT = NOW - 10 * 60_000;
const WITHIN_GRACE_AT = NOW - 60_000;

let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
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
    CREATE TABLE store_product_variant (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL REFERENCES store_order(id),
      product_id TEXT NOT NULL,
      variant_id TEXT REFERENCES store_product_variant(id),
      product_name TEXT NOT NULL,
      variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL
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
  // This fixture mirrors only the 0019 `trg_order_status_cancel_restock` trigger
  // (spec §3.5): only pre-shipment statuses restock.
  await db.run(`
    CREATE TRIGGER trg_order_status_cancel_restock
    AFTER UPDATE OF status ON store_order
    WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.stock_version = 'atomic'
      AND OLD.status IN ('pending_confirmation','confirmed','processing','placed','paid')
    BEGIN
      UPDATE store_product_variant
      SET stock = stock + COALESCE((
        SELECT SUM(quantity)
        FROM store_order_item
        WHERE order_id = NEW.id AND variant_id = store_product_variant.id
      ), 0)
      WHERE id IN (SELECT variant_id FROM store_order_item WHERE order_id = NEW.id AND variant_id IS NOT NULL);
    END`);
  return db;
}

interface SeedOptions {
  status?: string;
  paymentStatus?: string;
  method?: string;
  holdExpiresAt?: number | null;
  stockVersion?: "atomic" | "legacy";
}

async function seedOrder(
  db: Awaited<ReturnType<typeof buildDb>>,
  opts: SeedOptions = {},
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
    stockVersion: opts.stockVersion ?? "atomic",
    paymentMethod: opts.method ?? "instapay",
    holdExpiresAt: opts.holdExpiresAt === undefined ? EXPIRED_AT : opts.holdExpiresAt,
    createdAt: NOW - 24 * 3_600_000,
  });
  return id;
}

async function seedHold(
  db: Awaited<ReturnType<typeof buildDb>>,
  opts: SeedOptions & { quantity?: number } = {},
): Promise<{ orderId: string; variantId: string; quantity: number }> {
  const variantId = crypto.randomUUID();
  await db.insert(schema.productVariant).values({
    id: variantId,
    productId: crypto.randomUUID(),
    name: "كيلو",
    price: 50_00,
    stock: 0,
    image: "https://example.com/h.jpg",
    sortOrder: 0,
  });
  const orderId = await seedOrder(db, opts);
  const quantity = opts.quantity ?? 2;
  await db.insert(schema.orderItem).values({
    orderId,
    productId: crypto.randomUUID(),
    variantId,
    productName: "عسل سدر مصري",
    variantName: "كيلو",
    quantity,
    unitPrice: 50_00,
  });
  return { orderId, variantId, quantity };
}

async function orderRow(db: Awaited<ReturnType<typeof buildDb>>, id: string) {
  const row = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
  if (!row) throw new Error(`order ${id} not found`);
  return row;
}

async function expiryEvents(db: Awaited<ReturnType<typeof buildDb>>, orderId: string) {
  return db.select().from(schema.paymentEvent).where(eq(schema.paymentEvent.orderId, orderId));
}

async function variantStock(db: Awaited<ReturnType<typeof buildDb>>, variantId: string) {
  const row = await db
    .select({ stock: schema.productVariant.stock })
    .from(schema.productVariant)
    .where(eq(schema.productVariant.id, variantId))
    .get();
  if (!row) throw new Error(`variant ${variantId} not found`);
  return row.stock;
}

describe("releaseExpiredHolds selection", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("cancels an unaccepted order past the grace window and appends one expiry event", async () => {
    const { orderId, variantId, quantity } = await seedHold(db, {
      status: "pending_confirmation",
      paymentStatus: "unpaid",
      method: "instapay",
      holdExpiresAt: EXPIRED_AT,
    });

    expect(await releaseExpiredHolds(db, NOW)).toEqual([orderId]);

    expect(await orderRow(db, orderId)).toMatchObject({
      status: "cancelled",
      paymentStatus: "unpaid",
    });
    expect(await variantStock(db, variantId)).toBe(quantity);
    const events = await expiryEvents(db, orderId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "expiry", actor: "system", createdAt: NOW });
  });

  it("applies rule 1 to a COD order the shop never accepted", async () => {
    const { orderId, variantId, quantity } = await seedHold(db, {
      status: "pending_confirmation",
      paymentStatus: "unpaid",
      method: "cod",
      holdExpiresAt: EXPIRED_AT,
    });

    expect(await releaseExpiredHolds(db, NOW)).toEqual([orderId]);

    expect(await orderRow(db, orderId)).toMatchObject({
      status: "cancelled",
      paymentStatus: "unpaid",
    });
    expect(await variantStock(db, variantId)).toBe(quantity);
  });

  it("selects a hold exactly at the grace boundary and skips a younger one", async () => {
    const atBoundary = await seedOrder(db, {
      status: "pending_confirmation",
      holdExpiresAt: NOW - HOLD_EXPIRY_GRACE_MS,
    });
    const oneMsYounger = await seedOrder(db, {
      status: "pending_confirmation",
      holdExpiresAt: NOW - HOLD_EXPIRY_GRACE_MS + 1,
    });
    const withinGrace = await seedOrder(db, {
      status: "pending_confirmation",
      holdExpiresAt: WITHIN_GRACE_AT,
    });

    expect(await releaseExpiredHolds(db, NOW)).toEqual([atBoundary]);
    expect((await orderRow(db, atBoundary)).status).toBe("cancelled");
    expect((await orderRow(db, oneMsYounger)).status).toBe("pending_confirmation");
    expect((await orderRow(db, withinGrace)).status).toBe("pending_confirmation");
  });

  it("cancels accepted transfer orders whose payment never arrived, failing only an open claim", async () => {
    const confirmed = await seedHold(db, {
      status: "confirmed",
      paymentStatus: "unpaid",
      method: "instapay",
      holdExpiresAt: EXPIRED_AT,
    });
    const processing = await seedHold(db, {
      status: "processing",
      paymentStatus: "pending_review",
      method: "wallet",
      holdExpiresAt: EXPIRED_AT,
    });

    expect((await releaseExpiredHolds(db, NOW)).sort()).toEqual(
      [confirmed.orderId, processing.orderId].sort(),
    );

    expect(await orderRow(db, confirmed.orderId)).toMatchObject({
      status: "cancelled",
      paymentStatus: "unpaid",
      paymentReviewedAt: null,
    });
    expect(await orderRow(db, processing.orderId)).toMatchObject({
      status: "cancelled",
      paymentStatus: "failed",
      paymentReviewedAt: NOW,
    });
    expect(await variantStock(db, confirmed.variantId)).toBe(confirmed.quantity);
    expect(await variantStock(db, processing.variantId)).toBe(processing.quantity);
  });

  it("never cancels COD orders in confirmed or processing", async () => {
    const confirmed = await seedOrder(db, {
      status: "confirmed",
      paymentStatus: "unpaid",
      method: "cod",
      holdExpiresAt: EXPIRED_AT,
    });
    const processing = await seedOrder(db, {
      status: "processing",
      paymentStatus: "unpaid",
      method: "cod",
      holdExpiresAt: EXPIRED_AT,
    });

    expect(await releaseExpiredHolds(db, NOW)).toEqual([]);
    expect((await orderRow(db, confirmed)).status).toBe("confirmed");
    expect((await orderRow(db, processing)).status).toBe("processing");
    expect(await db.select().from(schema.paymentEvent)).toHaveLength(0);
  });

  it("never touches shipped, delivered, cancelled, or settled-payment orders", async () => {
    const paid = await seedOrder(db, {
      status: "confirmed",
      paymentStatus: "paid",
      method: "instapay",
      holdExpiresAt: EXPIRED_AT,
    });
    const shipped = await seedOrder(db, {
      status: "shipped",
      paymentStatus: "unpaid",
      method: "instapay",
      holdExpiresAt: EXPIRED_AT,
    });
    const delivered = await seedOrder(db, {
      status: "delivered",
      paymentStatus: "pending_review",
      method: "wallet",
      holdExpiresAt: EXPIRED_AT,
    });
    const cancelled = await seedOrder(db, {
      status: "cancelled",
      paymentStatus: "unpaid",
      method: "instapay",
      holdExpiresAt: EXPIRED_AT,
    });

    expect(await releaseExpiredHolds(db, NOW)).toEqual([]);
    expect((await orderRow(db, paid)).paymentStatus).toBe("paid");
    expect((await orderRow(db, shipped)).status).toBe("shipped");
    expect((await orderRow(db, delivered)).status).toBe("delivered");
    expect((await orderRow(db, cancelled)).status).toBe("cancelled");
    expect(await db.select().from(schema.paymentEvent)).toHaveLength(0);
  });

  it("never selects rows without a hold deadline", async () => {
    const unaccepted = await seedOrder(db, {
      status: "pending_confirmation",
      method: "cod",
      holdExpiresAt: null,
    });
    const acceptedTransfer = await seedOrder(db, {
      status: "confirmed",
      paymentStatus: "unpaid",
      method: "instapay",
      holdExpiresAt: null,
    });

    expect(await releaseExpiredHolds(db, NOW)).toEqual([]);
    expect((await orderRow(db, unaccepted)).status).toBe("pending_confirmation");
    expect((await orderRow(db, acceptedTransfer)).status).toBe("confirmed");
  });

  it("never selects legacy stock rows, which have no restock trigger release", async () => {
    const { orderId, variantId } = await seedHold(db, {
      status: "confirmed",
      paymentStatus: "unpaid",
      method: "instapay",
      holdExpiresAt: EXPIRED_AT,
      stockVersion: "legacy",
    });

    expect(await releaseExpiredHolds(db, NOW)).toEqual([]);
    expect((await orderRow(db, orderId)).status).toBe("confirmed");
    expect(await variantStock(db, variantId)).toBe(0);
    expect(await expiryEvents(db, orderId)).toHaveLength(0);
  });
});

describe("releaseExpiredHolds idempotency", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("releases stock and appends one event across replayed runs", async () => {
    const { orderId, variantId, quantity } = await seedHold(db, { holdExpiresAt: EXPIRED_AT });

    expect(await releaseExpiredHolds(db, NOW)).toEqual([orderId]);
    expect(await releaseExpiredHolds(db, NOW)).toEqual([]);

    expect(await variantStock(db, variantId)).toBe(quantity);
    expect(await expiryEvents(db, orderId)).toHaveLength(1);
  });

  it("releases stock and appends one event when two runs are issued together (replayed runs)", async () => {
    const { orderId, variantId, quantity } = await seedHold(db, { holdExpiresAt: EXPIRED_AT });

    const runs = await Promise.all([releaseExpiredHolds(db, NOW), releaseExpiredHolds(db, NOW)]);

    expect(runs.flat()).toEqual([orderId]);
    expect(await variantStock(db, variantId)).toBe(quantity);
    expect(await expiryEvents(db, orderId)).toHaveLength(1);
  });

  it("releases nothing when a competing cancellation wins between selection and update", async () => {
    const { orderId, variantId, quantity } = await seedHold(db, { holdExpiresAt: EXPIRED_AT });
    const realBatch = db.batch.bind(db) as (statements: unknown) => Promise<unknown>;
    let competed = false;
    // The first batch call lands after the job's SELECT: cancel the order
    // directly so the job's conditional UPDATE loses the race.
    const batchSpy = vi.spyOn(db, "batch").mockImplementation((async (statements: unknown) => {
      if (!competed) {
        competed = true;
        await db
          .update(schema.order)
          .set({ status: "cancelled" })
          .where(eq(schema.order.id, orderId));
      }
      return realBatch(statements);
    }) as unknown as typeof db.batch);

    try {
      expect(await releaseExpiredHolds(db, NOW)).toEqual([]);
    } finally {
      batchSpy.mockRestore();
    }

    // The competitor's trigger restocked once; the losing run restocked nothing
    // and appended no event.
    expect(await variantStock(db, variantId)).toBe(quantity);
    expect(await expiryEvents(db, orderId)).toHaveLength(0);
  });
});

describe("runSettlementJobs", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("releases expired holds through the EM-4 hook", async () => {
    const { orderId, variantId, quantity } = await seedHold(db, { holdExpiresAt: EXPIRED_AT });

    expect(await runSettlementJobs(db, NOW)).toEqual([orderId]);

    expect((await orderRow(db, orderId)).status).toBe("cancelled");
    expect(await variantStock(db, variantId)).toBe(quantity);
    expect(await expiryEvents(db, orderId)).toHaveLength(1);
  });
});

afterAll(() => {
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
});
