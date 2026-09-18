import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";

// Seeding-heavy tests and per-test schema rebuilds brush against vitest
// defaults when the whole suite runs in parallel — same guard as the sibling
// admin orders specs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { isActionFailure, type RequestEvent } from "@sveltejs/kit";
import * as schema from "$lib/server/db/schema";
import type { AdminOrderItemRow, AdminOrderRow, OrderStatus } from "$lib/server/admin/orders";
import { t, type Lang } from "$lib/i18n/messages";

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

const DB_FILE = "admin-order-detail-test.db";

let client: ReturnType<typeof createClient> | null = null;
let testDb: LibSQLDatabase<typeof schema> | null = null;

function currentDb(): LibSQLDatabase<typeof schema> {
  if (!testDb) throw new Error("test database not built yet");
  return testDb;
}

// getOrderWithItems / transitionOrderStatus touch exactly these tables; the
// DDL mirrors production migrations (see sibling admin/orders.spec.ts).
async function buildDb(): Promise<void> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
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
  await db.run(`
    CREATE TABLE store_product_variant (
      id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL,
      name_en TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(
    `CREATE UNIQUE INDEX store_product_variant_productId_name_unique ON store_product_variant (product_id, name)`,
  );
  await db.run(`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      variant_id TEXT,
      product_name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TRIGGER trg_order_status_cancel_restock
    AFTER UPDATE OF status ON store_order
    WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.stock_version = 'atomic'
    BEGIN
      UPDATE store_product_variant
      SET stock = stock + COALESCE((
        SELECT SUM(quantity)
        FROM store_order_item
        WHERE order_id = NEW.id AND variant_id = store_product_variant.id
      ), 0)
      WHERE id IN (SELECT variant_id FROM store_order_item WHERE order_id = NEW.id AND variant_id IS NOT NULL);
    END`);
  testDb = db;
  state.database = db;
}

let orderCounter = 0;

async function seedOrder(
  db: LibSQLDatabase<typeof schema>,
  opts: { status?: OrderStatus } = {},
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
    createdAt: Date.now(),
  });
  return id;
}

interface SeedItemOptions {
  productId?: string;
  variantId?: string;
  variantName?: string;
  quantity?: number;
}

async function seedOrderItem(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  opts: SeedItemOptions = {},
): Promise<{ itemId: string; productId: string }> {
  const productId = opts.productId ?? crypto.randomUUID();
  const itemId = crypto.randomUUID();
  await db.insert(schema.orderItem).values({
    id: itemId,
    orderId,
    productId,
    variantId: opts.variantId ?? null,
    productName: "عسل سدر مصري",
    variantName: opts.variantName ?? "كيلو",
    quantity: opts.quantity ?? 2,
    unitPrice: 50_00,
  });
  return { itemId, productId };
}

async function seedVariant(
  db: LibSQLDatabase<typeof schema>,
  productId: string,
  stock: number,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.productVariant).values({
    id,
    productId,
    name: "كيلو",
    price: 50_00,
    stock,
    image: "https://example.com/h.jpg",
    sortOrder: 0,
  });
  return id;
}

interface EventOptions {
  role?: string;
  langCookie?: Lang;
}

// The handlers read `params`, `locals.user?.role`, `url`, `cookies.get`, and
// request headers (getLang) — fabricate exactly that surface.
function fakeEvent(
  id: string,
  opts: EventOptions = {},
  formData?: Record<string, string>,
): RequestEvent {
  const body = new FormData();
  if (formData) for (const [key, value] of Object.entries(formData)) body.set(key, value);
  return {
    params: { id },
    url: new URL(`http://localhost/admin/orders/${id}`),
    cookies: { get: () => opts.langCookie },
    request: new Request(`http://localhost/admin/orders/${id}`, {
      method: "POST",
      body,
    }),
    locals: { user: opts.role === undefined ? undefined : { role: opts.role } },
  } as unknown as RequestEvent;
}

interface DetailData {
  order: AdminOrderRow;
  items: AdminOrderItemRow[];
  transitions: readonly OrderStatus[];
  lang: Lang;
}

// Test-only narrowings, mirroring the sibling page.load.spec.ts precedent:
// the loader always returns data and actions return plain results/failures.
function asData(result: unknown): DetailData {
  return result as DetailData;
}

function failureOf(result: unknown): { status: number; message: string } {
  if (!isActionFailure(result)) throw new Error("expected an ActionFailure");
  const data = result.data as { message?: string } | undefined;
  return { status: result.status, message: data?.message ?? "" };
}

function successOf(result: unknown): string {
  if (
    isActionFailure(result) ||
    typeof result !== "object" ||
    result === null ||
    !("success" in result)
  ) {
    throw new Error("expected a success action result");
  }
  return String((result as { success: unknown }).success);
}

type UpdateAction = (event: RequestEvent) => Promise<unknown>;
type LoadFn = (event: RequestEvent) => Promise<unknown>;

let load: LoadFn;
let update: UpdateAction;

beforeAll(async () => {
  const module = await import("./+page.server");
  load = module.load as unknown as LoadFn;
  update = (module.actions as { update: UpdateAction }).update;
});

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

describe("admin order detail load", () => {
  it("returns the order with its items and allowed transitions", async () => {
    const db = currentDb();
    const id = await seedOrder(db);
    await seedOrderItem(db, id, { quantity: 3 });

    const data = asData(await load(fakeEvent(id)));

    expect(data.order.id).toBe(id);
    expect(data.order.status).toBe("placed");
    expect(data.items).toHaveLength(1);
    expect(data.items[0]?.productName).toBe("عسل سدر مصري");
    expect(data.items[0]?.quantity).toBe(3);
    expect(data.transitions).toEqual(["shipped", "cancelled"]);
    expect(data.lang).toBe("ar"); // no cookie/header → Arabic default
  });

  it("exposes no transitions once the order is terminal", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { status: "delivered" });

    const data = asData(await load(fakeEvent(id)));

    expect(data.transitions).toEqual([]);
  });

  it("throws a 404 for an unknown order id", async () => {
    await seedOrder(currentDb());

    await expect(load(fakeEvent(crypto.randomUUID()))).rejects.toMatchObject({ status: 404 });
  });
});

describe("admin order detail update action", () => {
  it("rejects guests with 403 even though the layout guards pages", async () => {
    const id = await seedOrder(currentDb());

    const result = failureOf(await update(fakeEvent(id, {}, { id, status: "shipped" })));

    expect(result.status).toBe(403);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("rejects authenticated non-admins with 403", async () => {
    const id = await seedOrder(currentDb());

    const result = failureOf(
      await update(fakeEvent(id, { role: "user" }, { id, status: "shipped" })),
    );

    expect(result.status).toBe(403);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("rejects malformed status payloads with 400", async () => {
    const id = await seedOrder(currentDb());

    const result = failureOf(
      await update(fakeEvent(id, { role: "admin" }, { id, status: "bogus" })),
    );

    expect(result.status).toBe(400);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });

  it("applies a legal transition, flips the row, and reports success", async () => {
    const db = currentDb();
    const id = await seedOrder(db);

    const message = successOf(
      await update(fakeEvent(id, { role: "admin" }, { id, status: "shipped" })),
    );

    expect(message).toBe(t("ar", "admin.order.updated"));
    const row = await db.select({ status: schema.order.status }).from(schema.order).get();
    expect(row?.status).toBe("shipped");
  });

  it("localizes the success message via the lang cookie", async () => {
    const db = currentDb();
    const id = await seedOrder(db);

    const message = successOf(
      await update(fakeEvent(id, { role: "admin", langCookie: "en" }, { id, status: "cancelled" })),
    );

    expect(message).toBe(t("en", "admin.order.updated"));
  });

  it("refuses illegal transitions with 409", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { status: "delivered" });

    const result = failureOf(
      await update(fakeEvent(id, { role: "admin" }, { id, status: "shipped" })),
    );

    expect(result.status).toBe(409);
    expect(result.message).toBe(t("ar", "admin.order.invalidTransition"));
  });

  it("maps a vanished order to a 404 not-found failure", async () => {
    await seedOrder(currentDb());

    await expect(
      update(
        fakeEvent(
          crypto.randomUUID(),
          { role: "admin" },
          { id: crypto.randomUUID(), status: "shipped" },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("cancelling restocks variant inventory through the real service", async () => {
    const db = currentDb();
    const id = await seedOrder(db);
    const productId = crypto.randomUUID();
    const variantId = await seedVariant(db, productId, 5);
    await seedOrderItem(db, id, { productId, variantId, quantity: 2 });

    const message = successOf(
      await update(fakeEvent(id, { role: "admin" }, { id, status: "cancelled" })),
    );

    expect(message).toBe(t("ar", "admin.order.updated"));
    const variant = await db
      .select({ stock: schema.productVariant.stock })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, variantId))
      .get();
    expect(variant?.stock).toBe(7); // 5 + 2 restocked
  });

  it("maps a restock failure to a retryable 500 failure", async () => {
    const db = currentDb();
    const id = await seedOrder(db);
    const productId = crypto.randomUUID();
    const variantId = await seedVariant(db, productId, 5);
    await seedOrderItem(db, id, { productId, variantId });
    // Force the cancel restock trigger to fail: dropping the variant table
    // makes the AFTER UPDATE trigger throw after the committed status flip.
    await db.run(`DROP TABLE store_product_variant`);

    const result = failureOf(
      await update(fakeEvent(id, { role: "admin" }, { id, status: "cancelled" })),
    );

    expect(result.status).toBe(500);
    expect(result.message).toBe(t("ar", "errors.unexpected"));
  });
});
