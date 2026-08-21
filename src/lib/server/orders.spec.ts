import { afterAll, describe, expect, it, vi } from "vite-plus/test";

vi.setConfig({ testTimeout: 30_000 });
import { unlinkSync, existsSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { createOrder, isNonceConflict } from "./orders";
import { SHIPPING_COST } from "$lib/cart";
import { isBusyError } from "$lib/server/sqlite";
import type { Customer } from "./orders";

const DB_FILE = "orders-test.db";

let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client?.close();
  client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
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
    CREATE TABLE store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE,
      nonce TEXT UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid', user_id TEXT, created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      product_name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )`);
  const cat = (
    await db
      .insert(schema.category)
      .values({ name: "عسل السدر", slug: "sidr" })
      .returning({ id: schema.category.id })
  )[0];
  const p = (
    await db
      .insert(schema.product)
      .values({
        name: "عسل سدر مصري",
        slug: "sidr-egyptian",
        description: "د",
        price: 0,
        stock: 0,
        image: "https://example.com/h.jpg",
        categoryId: cat.id,
        featured: 0,
        createdAt: Date.now(),
      })
      .returning()
  )[0];
  const v = (
    await db
      .insert(schema.productVariant)
      .values({
        productId: p.id,
        name: "500 جرام",
        price: 380_00,
        stock: 3,
        image: "https://example.com/h.jpg",
        sortOrder: 0,
      })
      .returning()
  )[0];
  return { db, p, v };
}

const customer: Customer = {
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  address: "شارع 9",
  city: "القاهرة",
};

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("createOrder", () => {
  it("creates an order, decrements variant stock, stores variantName", async () => {
    const { db, v } = await buildDb();
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 2 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(380_00 * 2);
    expect(result.orderNumber).toMatch(/^HNY-\d{6}$/);

    const order = await db
      .select()
      .from(schema.order)
      .where(eq(schema.order.id, result.orderId))
      .get();
    expect(order?.number).toBe(result.orderNumber);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(1);
    const items = await db
      .select()
      .from(schema.orderItem)
      .where(eq(schema.orderItem.orderId, result.orderId));
    expect(items).toEqual([
      expect.objectContaining({
        productName: "عسل سدر مصري",
        variantName: "500 جرام",
        quantity: 2,
        unitPrice: 380_00,
      }),
    ]);
  });

  it("executes all writes in a single batch (decrement + order + items)", async () => {
    const { db, v } = await buildDb();
    const batchSpy = vi.spyOn(db, "batch");
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 2 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(true);
    expect(batchSpy).toHaveBeenCalledTimes(1);
    const statements = batchSpy.mock.calls[0]?.[0] ?? [];
    expect(statements).toHaveLength(3); // 1 guarded decrement + 1 order insert + 1 items insert
  });

  it("compensates a committed batch when a concurrent checkout wins the stock race", async () => {
    const { db, v } = await buildDb();
    const originalBatch = db.batch.bind(db);
    const batchSpy = vi.spyOn(db, "batch").mockImplementationOnce(async (statements) => {
      // Simulate a concurrent winner consuming all stock between the
      // sufficiency pre-read and the batch commit.
      await db.run(sql`UPDATE store_product_variant SET stock = 0 WHERE id = ${v.id}`);
      return originalBatch(statements);
    });
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 2 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("عسل سدر مصري");
    expect(batchSpy).toHaveBeenCalledTimes(2); // main batch + compensation batch
    expect(await db.select().from(schema.order)).toEqual([]);
    expect(await db.select().from(schema.orderItem)).toEqual([]);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(0); // winner keeps the stock; loser restored nothing
  });

  it("restores only the applied decrements when one of two variants loses the race", async () => {
    const { db, p, v } = await buildDb();
    const p2 = (
      await db
        .insert(schema.product)
        .values({
          name: "غذاء ملكات",
          slug: "royal-jelly",
          description: "د",
          price: 0,
          stock: 0,
          image: "https://example.com/r.jpg",
          categoryId: p.categoryId,
          featured: 0,
          createdAt: Date.now(),
        })
        .returning()
    )[0];
    const b = (
      await db
        .insert(schema.productVariant)
        .values({
          productId: p2.id,
          name: "1 كيلو",
          price: 700_00,
          stock: 3,
          image: "https://example.com/r.jpg",
          sortOrder: 1,
        })
        .returning()
    )[0];
    const originalBatch = db.batch.bind(db);
    const batchSpy = vi.spyOn(db, "batch").mockImplementationOnce(async (statements) => {
      await db.run(sql`UPDATE store_product_variant SET stock = 0 WHERE id = ${b.id}`);
      return originalBatch(statements);
    });
    const result = await createOrder(
      db,
      [
        { variantId: v.id, quantity: 1 },
        { variantId: b.id, quantity: 1 },
      ],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("غذاء ملكات");
    expect(batchSpy).toHaveBeenCalledTimes(2); // main batch + compensation batch
    expect(await db.select().from(schema.order)).toEqual([]);
    expect(await db.select().from(schema.orderItem)).toEqual([]);
    const aStock = await db
      .select({ stock: schema.productVariant.stock })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(aStock?.stock).toBe(3); // A's applied decrement was added back
    const bStock = await db
      .select({ stock: schema.productVariant.stock })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, b.id))
      .get();
    expect(bStock?.stock).toBe(0); // B lost the race; nothing restored
  });

  it("treats D1-shaped results (meta.changes) as affected-row counts", async () => {
    const { db, v } = await buildDb();
    const d1BatchResult = (changes: number[]) =>
      changes.map((c) => ({ meta: { changes: c } })) as never;
    const batchSpy = vi
      .spyOn(db, "batch")
      .mockImplementationOnce(async () => d1BatchResult([1, 1, 1]));
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 1 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(true);
    expect(batchSpy).toHaveBeenCalledTimes(1); // no compensation on all-applied
  });

  it("compensates when a D1-shaped decrement reports zero changes", async () => {
    const { db, v } = await buildDb();
    const d1BatchResult = (changes: number[]) =>
      changes.map((c) => ({ meta: { changes: c } })) as never;
    const batchSpy = vi
      .spyOn(db, "batch")
      .mockImplementationOnce(async () => d1BatchResult([1, 1, 0]));
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 1 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("عسل سدر مصري");
    expect(batchSpy).toHaveBeenCalledTimes(2); // main batch + compensation batch
    expect(await db.select().from(schema.order)).toEqual([]);
    expect(await db.select().from(schema.orderItem)).toEqual([]);
    const stock = await db
      .select({ stock: schema.productVariant.stock })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(3); // the only decrement was the lost one, so nothing is added back
  });

  it("retries the whole batch when the order number collides", async () => {
    const { db, v } = await buildDb();
    const batchSpy = vi
      .spyOn(db, "batch")
      .mockRejectedValueOnce(new Error("UNIQUE constraint failed: store_order.number"));
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 1 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderNumber).toMatch(/^HNY-\d{6}$/);
    expect(batchSpy).toHaveBeenCalledTimes(2);
    expect(await db.select().from(schema.order)).toHaveLength(1);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(2); // decremented exactly once despite the retry
  });

  it("returns the replayed order on a mid-flight nonce conflict without touching stock", async () => {
    const { db, v } = await buildDb();
    const nonce = crypto.randomUUID();
    vi.spyOn(db, "batch").mockImplementationOnce(async () => {
      // A concurrent request wins the race and commits first.
      await db.insert(schema.order).values({
        id: "winner-id",
        number: "HNY-999999",
        nonce,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        total: 380_00,
        status: "paid",
        userId: null,
        createdAt: Date.now(),
      });
      throw new Error("UNIQUE constraint failed: store_order.nonce");
    });
    const result = await createOrder(db, [{ variantId: v.id, quantity: 1 }], customer, nonce);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderId).toBe("winner-id");
    expect(result.orderNumber).toBe("HNY-999999");
    expect(await db.select().from(schema.order)).toHaveLength(1);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(3); // losing request must not decrement anything
  });

  it("retries once on SQLITE_BUSY then succeeds", async () => {
    const { db, v } = await buildDb();
    const busy = new Error("database is locked") as Error & { code: string };
    busy.code = "SQLITE_BUSY";
    const batchSpy = vi.spyOn(db, "batch").mockRejectedValueOnce(busy);
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 1 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(true);
    expect(batchSpy).toHaveBeenCalledTimes(2);
  });

  it("aborts aggregated multi-line demand exceeding stock before any write", async () => {
    const { db, v } = await buildDb();
    const batchSpy = vi.spyOn(db, "batch");
    const result = await createOrder(
      db,
      [
        { variantId: v.id, quantity: 2 },
        { variantId: v.id, quantity: 2 },
      ],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("عسل سدر مصري");
    expect(batchSpy).not.toHaveBeenCalled();
    expect(await db.select().from(schema.order)).toEqual([]);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(3);
  });

  it("rejects an empty cart", async () => {
    const { db } = await buildDb();
    const result = await createOrder(db, [], customer, crypto.randomUUID());
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-stock and writes nothing", async () => {
    const { db, v } = await buildDb();
    const result = await createOrder(
      db,
      [{ variantId: v.id, quantity: 5 }],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("عسل سدر مصري");
    expect(await db.select().from(schema.order)).toEqual([]);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(3);
  });

  it("returns the same order for a replayed nonce (idempotency)", async () => {
    const { db, v } = await buildDb();
    const nonce = crypto.randomUUID();
    const first = await createOrder(db, [{ variantId: v.id, quantity: 1 }], customer, nonce);
    const second = await createOrder(db, [{ variantId: v.id, quantity: 1 }], customer, nonce);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.orderId).toBe(first.orderId);
    expect(second.orderNumber).toBe(first.orderNumber);
    expect(second.total).toBe(first.total);

    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(2);
    const orders = await db.select().from(schema.order);
    expect(orders).toHaveLength(1);
  });

  it("places an order with a blend line (base + additive units)", async () => {
    const { db, v } = await buildDb();
    const categoryId = (await db.select({ id: schema.category.id }).from(schema.category).get())!
      .id;
    const additive = (
      await db
        .insert(schema.product)
        .values({
          name: "غذاء ملكات",
          nameEn: "Royal Jelly",
          slug: "royal-jelly-test",
          description: "د",
          descriptionEn: "d",
          price: 0,
          stock: 0,
          image: "https://example.com/rj.jpg",
          categoryId,
          featured: 0,
          createdAt: Date.now(),
        })
        .returning()
    )[0];
    const additiveVariant = (
      await db
        .insert(schema.productVariant)
        .values({
          productId: additive.id,
          name: "5 جم",
          nameEn: "5g",
          price: 85_00,
          stock: 2,
          image: "https://example.com/rj.jpg",
          sortOrder: 0,
        })
        .returning()
    )[0];

    const result = await createOrder(
      db,
      [
        {
          kind: "blend",
          id: "blend-1",
          baseVariantId: v.id,
          jarSize: "half",
          additives: [{ key: "royalJelly", variantId: additiveVariant.id, qty: 2 }],
        },
      ],
      customer,
      crypto.randomUUID(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(380_00 + 2 * 85_00 + SHIPPING_COST);

    const baseStock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(baseStock?.stock).toBe(2);
    const additiveStock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, additiveVariant.id))
      .get();
    expect(additiveStock?.stock).toBe(0);

    const items = await db.select().from(schema.orderItem);
    expect(items).toHaveLength(2);
    expect(items).toEqual([
      expect.objectContaining({
        productName: "عسل سدر مصري",
        variantName: "نص كيلو",
        quantity: 1,
        unitPrice: 380_00,
      }),
      expect.objectContaining({
        productName: "غذاء ملكات",
        variantName: "",
        quantity: 2,
        unitPrice: 85_00,
      }),
    ]);
  });
});

describe("isNonceConflict", () => {
  it("returns true when the error message references store_order.nonce", () => {
    expect(isNonceConflict(new Error("UNIQUE constraint failed: store_order.nonce"))).toBe(true);
  });

  it("returns false when only the code is SQLITE_CONSTRAINT_UNIQUE", () => {
    const error = new Error("constraint failed") as Error & { code: string };
    error.code = "SQLITE_CONSTRAINT_UNIQUE";
    expect(isNonceConflict(error)).toBe(false);
  });

  it("returns false for unrelated errors", () => {
    expect(isNonceConflict(new Error("database is locked"))).toBe(false);
    expect(isNonceConflict(new Error("OUT_OF_STOCK:عسل سدر مصري"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isNonceConflict(null)).toBe(false);
    expect(isNonceConflict({ message: "store_order.nonce" })).toBe(false);
    expect(isNonceConflict("store_order.nonce")).toBe(false);
  });
});

describe("isBusyError", () => {
  it("returns true when the error code is SQLITE_BUSY", () => {
    const error = new Error("database is locked") as Error & { code: string };
    error.code = "SQLITE_BUSY";
    expect(isBusyError(error)).toBe(true);
  });

  it("returns true when the message mentions a locked database", () => {
    expect(isBusyError(new Error("database is locked"))).toBe(true);
  });

  it("returns false for unrelated and non-Error values", () => {
    expect(isBusyError(new Error("OUT_OF_STOCK:عسل سدر مصري"))).toBe(false);
    expect(isBusyError(null)).toBe(false);
  });
});
