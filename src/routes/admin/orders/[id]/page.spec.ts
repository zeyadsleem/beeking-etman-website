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

vi.mock("$env/dynamic/private", () => ({
  env: {
    ORIGIN: "https://example.com",
    ADMIN_NOTIFY_EMAILS: "",
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
  await db.run(`DROP TABLE IF EXISTS store_notification`);
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_payment_event`);
  await db.run(`DROP TABLE IF EXISTS store_admin_audit`);
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
  await db.run(`
    CREATE TABLE store_payment_event (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, type TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'system', actor_user_id TEXT, method TEXT,
      reference TEXT, note TEXT, created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_admin_audit (
      id TEXT PRIMARY KEY NOT NULL, admin_user_id TEXT, action TEXT NOT NULL,
      target_type TEXT NOT NULL, target_id TEXT NOT NULL, details TEXT,
      created_at INTEGER NOT NULL
    )`);
  // Mirrors the 0018 DDL (email delivery spec §3.2).
  await db.run(`
    CREATE TABLE store_notification (
      id                  text PRIMARY KEY NOT NULL,
      type                text NOT NULL,
      channel             text NOT NULL DEFAULT 'email',
      recipient           text NOT NULL,
      from_address        text NOT NULL DEFAULT '',
      subject             text NOT NULL,
      body                text NOT NULL,
      status              text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','sending','sent','failed','dead')),
      attempt_count       integer NOT NULL DEFAULT 0,
      next_attempt_at     integer,
      last_error          text,
      provider_message_id text,
      locked_at           integer,
      idempotency_key     text,
      created_at          integer NOT NULL,
      sent_at             integer
    )`);
  await db.run(`DROP TABLE IF EXISTS user`);
  await db.run(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0, image TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      role TEXT, banned INTEGER DEFAULT false NOT NULL,
      ban_reason TEXT, ban_expires INTEGER
    )`);
  testDb = db;
  state.database = db;
}

let orderCounter = 0;

interface SeedOrderOptions {
  status?: OrderStatus;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentReference?: string | null;
  paymentReviewedBy?: string | null;
  holdExpiresAt?: number | null;
}

async function seedOrder(
  db: LibSQLDatabase<typeof schema>,
  opts: SeedOrderOptions = {},
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
    paymentStatus: opts.paymentStatus ?? "simulated",
    paymentMethod: opts.paymentMethod ?? "instapay",
    paymentReference: opts.paymentReference ?? null,
    paymentReviewedBy: opts.paymentReviewedBy ?? null,
    holdExpiresAt: opts.holdExpiresAt ?? null,
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
  userId?: string;
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
    locals: {
      user: opts.role === undefined ? undefined : { id: opts.userId, role: opts.role },
    },
  } as unknown as RequestEvent;
}

interface DetailEvent {
  id: string;
  type: string;
  reference: string | null;
  note: string | null;
  createdAt: number;
}

interface DetailData {
  order: AdminOrderRow;
  items: AdminOrderItemRow[];
  events: DetailEvent[];
  settlement: {
    canVerify: boolean;
    canReject: boolean;
    canRefund: boolean;
    canExtendHold: boolean;
  };
  reviewerLabel: string | null;
  transitions: readonly OrderStatus[];
  customerWhatsappUrl: string | null;
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

type Action = (event: RequestEvent) => Promise<unknown>;
type LoadFn = (event: RequestEvent) => Promise<unknown>;

let load: LoadFn;
let update: Action;
let markPaid: Action;
let rejectClaim: Action;
let refund: Action;
let extendHold: Action;

beforeAll(async () => {
  const module = await import("./+page.server");
  load = module.load as unknown as LoadFn;
  const actions = module.actions as Record<string, Action>;
  update = actions.update;
  markPaid = actions.mark_paid;
  rejectClaim = actions.reject_claim;
  refund = actions.refund;
  extendHold = actions.extend_hold;
});

// logAdminAction is fire-and-forget by design; poll briefly so the assertion
// sees the row the same request wrote without coupling the spec to its timing.
async function auditRowsFor(action: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await currentDb()
      .select()
      .from(schema.adminAudit)
      .where(eq(schema.adminAudit.action, action));
    if (rows.length > 0) return rows;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return [];
}

afterAll(() => {
  client?.close();
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

beforeEach(buildDb);

describe("admin order detail load", () => {
  it("builds an international customer WhatsApp link from the local phone", async () => {
    const db = currentDb();
    const id = await seedOrder(db);

    const data = asData(await load(fakeEvent(id)));

    expect(data.customerWhatsappUrl).toContain("https://wa.me/201012345678?text=");
    expect(decodeURIComponent(data.customerWhatsappUrl ?? "")).toContain("HNY-");
  });

  it("returns the order with its items and allowed transitions", async () => {
    const db = currentDb();
    const id = await seedOrder(db);
    await seedOrderItem(db, id, { quantity: 3 });

    const data = asData(await load(fakeEvent(id)));

    expect(data.order.id).toBe(id);
    expect(data.order.status).toBe("pending_confirmation");
    expect(data.items).toHaveLength(1);
    expect(data.items[0]?.productName).toBe("عسل سدر مصري");
    expect(data.items[0]?.quantity).toBe(3);
    expect(data.transitions).toEqual(["confirmed", "cancelled"]);
    expect(data.lang).toBe("ar"); // no cookie/header → Arabic default
  });

  it("exposes no transitions once the order is terminal", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { status: "delivered" });

    const data = asData(await load(fakeEvent(id)));

    expect(data.transitions).toEqual([]);
  });

  it("returns the settlement timeline and the available review actions", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "pending_review", paymentMethod: "wallet" });
    await db.insert(schema.paymentEvent).values({
      orderId: id,
      type: "claim",
      actor: "customer",
      reference: "TRX-3",
      createdAt: 1234,
    });

    const data = asData(await load(fakeEvent(id)));

    expect(data.settlement).toEqual({
      canVerify: true,
      canReject: true,
      canRefund: false,
      canExtendHold: true,
    });
    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({
      type: "claim",
      reference: "TRX-3",
      createdAt: 1234,
    });
  });

  it("labels the reviewer with the admin name and falls back to the stored id", async () => {
    const db = currentDb();
    await db.insert(schema.user).values({
      id: "admin-1",
      name: "منى",
      email: "mona@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const id = await seedOrder(db, { paymentStatus: "paid", paymentReviewedBy: "admin-1" });

    const data = asData(await load(fakeEvent(id)));

    expect(data.reviewerLabel).toBe("منى");

    const orphanId = await seedOrder(db, { paymentStatus: "paid", paymentReviewedBy: "ghost" });
    const orphan = asData(await load(fakeEvent(orphanId)));

    expect(orphan.reviewerLabel).toBe("ghost");
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
      await update(fakeEvent(id, { role: "admin" }, { id, status: "confirmed" })),
    );

    expect(message).toBe(t("ar", "admin.order.updated"));
    const row = await db.select({ status: schema.order.status }).from(schema.order).get();
    expect(row?.status).toBe("confirmed");
    const notifications = await db.select().from(schema.notification);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "status_update",
      recipient: "a@example.com",
      status: "pending",
    });
  });

  it("enqueues shipped and delivered status updates with their labels", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { status: "confirmed" });

    successOf(await update(fakeEvent(id, { role: "admin" }, { id, status: "shipped" })));
    successOf(await update(fakeEvent(id, { role: "admin" }, { id, status: "delivered" })));

    const notifications = await db.select().from(schema.notification);
    expect(notifications).toHaveLength(2);
    for (const notification of notifications) {
      expect(notification).toMatchObject({
        type: "status_update",
        recipient: "a@example.com",
        status: "pending",
      });
    }
    const bodies = notifications.map(
      (notification) => JSON.parse(notification.body).text as string,
    );
    expect(bodies.some((body) => body.includes("تم الشحن 📦"))).toBe(true);
    expect(bodies.some((body) => body.includes("تم التسليم ✅"))).toBe(true);
    expect(bodies.join("\n")).not.toMatch(/تم الدفع|paid/i);
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

  it("ignores a posted order id and transitions the route order only", async () => {
    const db = currentDb();
    const first = await seedOrder(db);
    const second = await seedOrder(db);

    const message = successOf(
      await update(fakeEvent(first, { role: "admin" }, { id: second, status: "confirmed" })),
    );

    expect(message).toBe(t("ar", "admin.order.updated"));
    const rows = await db
      .select({ id: schema.order.id, status: schema.order.status })
      .from(schema.order);
    expect(rows.find((row) => row.id === first)?.status).toBe("confirmed");
    expect(rows.find((row) => row.id === second)?.status).toBe("pending_confirmation");
  });
});

describe("admin order detail settlement actions", () => {
  it("marks a transfer order paid and writes the verified event and audit rows", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "pending_review", paymentMethod: "instapay" });

    const message = successOf(
      await markPaid(fakeEvent(id, { role: "admin", userId: "admin-1" }, { reference: "TRX-7" })),
    );

    expect(message).toBe(t("ar", "admin.order.paymentRecorded"));
    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order).toMatchObject({ paymentStatus: "paid", paymentReference: "TRX-7" });
    const events = await db
      .select()
      .from(schema.paymentEvent)
      .where(eq(schema.paymentEvent.orderId, id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "verified", reference: "TRX-7" });
    const audits = await auditRowsFor("order.payment_mark_paid");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ targetType: "order", targetId: id, adminUserId: "admin-1" });
    expect(JSON.parse(audits[0]?.details ?? "{}")).toEqual({
      to: "paid",
      reference: "TRX-7",
      note: null,
    });

    const notifications = await currentDb().select().from(schema.notification);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "payment_confirmed",
      recipient: "a@example.com",
      status: "pending",
    });
    const body = JSON.parse(notifications[0]!.body) as { html: string; text: string };
    expect(body.text).toContain("تأكد الدفع");
    expect(body.text).toContain("المبلغ المدفوع");
  });

  it("verifies with a note only, records it in the audit, and keeps the claim reference", async () => {
    const db = currentDb();
    const id = await seedOrder(db, {
      paymentStatus: "pending_review",
      paymentReference: "TRX-9",
    });

    const message = successOf(
      await markPaid(fakeEvent(id, { role: "admin" }, { note: "cash counted" })),
    );

    expect(message).toBe(t("ar", "admin.order.paymentRecorded"));
    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order).toMatchObject({ paymentStatus: "paid", paymentReference: "TRX-9" });
    const events = await db
      .select()
      .from(schema.paymentEvent)
      .where(eq(schema.paymentEvent.orderId, id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "verified", note: "cash counted", reference: null });
    const audits = await auditRowsFor("order.payment_mark_paid");
    expect(JSON.parse(audits[0]?.details ?? "{}")).toEqual({
      to: "paid",
      reference: null,
      note: "cash counted",
    });
  });

  it("rejects guests and non-admins for every settlement action", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "pending_review" });

    for (const action of [markPaid, rejectClaim, refund, extendHold]) {
      expect(failureOf(await action(fakeEvent(id))).status).toBe(403);
      expect(failureOf(await action(fakeEvent(id, { role: "user" }))).status).toBe(403);
    }

    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.paymentStatus).toBe("pending_review");
    expect(await db.select().from(schema.paymentEvent)).toHaveLength(0);
    expect(await auditRowsFor("order.payment_mark_paid")).toHaveLength(0);
  });

  it("requires input for mark_paid and appends nothing on failure", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "unpaid" });

    const result = failureOf(await markPaid(fakeEvent(id, { role: "admin" }, {})));

    expect(result.status).toBe(400);
    expect(result.message).toBe(t("ar", "admin.order.invalidInput"));
    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.paymentStatus).toBe("unpaid");
    expect(await db.select().from(schema.paymentEvent)).toHaveLength(0);
    expect(await db.select().from(schema.notification)).toHaveLength(0);
  });

  it("keeps the recorded payment when the notification insert fails", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "pending_review", paymentMethod: "instapay" });
    await db.run(`DROP TABLE store_notification`);

    const message = successOf(
      await markPaid(fakeEvent(id, { role: "admin", userId: "admin-1" }, { reference: "TRX-7" })),
    );

    expect(message).toBe(t("ar", "admin.order.paymentRecorded"));
    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.paymentStatus).toBe("paid");
    expect(await auditRowsFor("order.payment_mark_paid")).toHaveLength(1);
  });

  it("maps a settled order to 409 for mark_paid", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "paid" });

    const result = failureOf(
      await markPaid(fakeEvent(id, { role: "admin" }, { note: "late receipt" })),
    );

    expect(result.status).toBe(409);
    expect(result.message).toBe(t("ar", "admin.order.invalidTransition"));
  });

  it("rejects a claim and writes the rejected event and audit rows", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "pending_review" });

    const message = successOf(
      await rejectClaim(fakeEvent(id, { role: "admin" }, { note: "no transfer found" })),
    );

    expect(message).toBe(t("ar", "admin.order.paymentRecorded"));
    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.paymentStatus).toBe("failed");
    const events = await db
      .select()
      .from(schema.paymentEvent)
      .where(eq(schema.paymentEvent.orderId, id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "rejected", note: "no transfer found" });
    const audits = await auditRowsFor("order.payment_reject_claim");
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0]?.details ?? "{}")).toEqual({
      to: "failed",
      note: "no transfer found",
    });

    const notifications = await currentDb().select().from(schema.notification);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "payment_failed",
      recipient: "a@example.com",
      status: "pending",
    });
    const body = JSON.parse(notifications[0]!.body) as { text: string };
    expect(body.text).toContain("لم نتمكن من تأكيد التحويل");
    expect(body.text).not.toMatch(/تم الدفع|paid/i);
  });

  it("requires a note to reject a claim", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "pending_review" });

    expect(failureOf(await rejectClaim(fakeEvent(id, { role: "admin" }, {}))).status).toBe(400);
    expect(await db.select().from(schema.paymentEvent)).toHaveLength(0);
  });

  it("refunds a paid order and writes the refund event and audit rows", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "paid" });

    const message = successOf(
      await refund(
        fakeEvent(id, { role: "admin" }, { note: "customer changed mind", reference: "RF-1" }),
      ),
    );

    expect(message).toBe(t("ar", "admin.order.paymentRecorded"));
    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.paymentStatus).toBe("refunded");
    const events = await db
      .select()
      .from(schema.paymentEvent)
      .where(eq(schema.paymentEvent.orderId, id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "refund",
      reference: "RF-1",
      note: "customer changed mind",
    });
    const audits = await auditRowsFor("order.payment_refund");
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0]?.details ?? "{}")).toEqual({
      to: "refunded",
      reference: "RF-1",
      note: "customer changed mind",
    });

    const notifications = await currentDb().select().from(schema.notification);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "refund",
      recipient: "a@example.com",
      status: "pending",
    });
    const body = JSON.parse(notifications[0]!.body) as { text: string };
    expect(body.text).toContain("المبلغ المسترد");
    expect(body.text).toContain("RF-1");
  });

  it("requires both the reason and the reference to refund", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { paymentStatus: "paid" });

    expect(
      failureOf(await refund(fakeEvent(id, { role: "admin" }, { reference: "RF-1" }))).status,
    ).toBe(400);
    expect(
      failureOf(await refund(fakeEvent(id, { role: "admin" }, { note: "reason" }))).status,
    ).toBe(400);
    expect(await db.select().from(schema.paymentEvent)).toHaveLength(0);
  });

  it("extends the hold and writes the note event and audit rows", async () => {
    const db = currentDb();
    // The route action uses the real clock, so a far-future deadline keeps the
    // expected extension deterministic.
    const farFuture = 4_100_000_000_000;
    const id = await seedOrder(db, { holdExpiresAt: farFuture });

    const message = successOf(await extendHold(fakeEvent(id, { role: "admin" })));

    expect(message).toBe(t("ar", "admin.order.paymentRecorded"));
    const order = await db.select().from(schema.order).where(eq(schema.order.id, id)).get();
    expect(order?.holdExpiresAt).toBe(farFuture + 24 * 3_600_000);
    const events = await db
      .select()
      .from(schema.paymentEvent)
      .where(eq(schema.paymentEvent.orderId, id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "note", note: "hold extended 24h" });
    const audits = await auditRowsFor("order.payment_extend_hold");
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0]?.details ?? "{}")).toEqual({ hours: 24 });
  });

  it("refuses to extend a shipped order", async () => {
    const db = currentDb();
    const id = await seedOrder(db, { status: "shipped" });

    expect(failureOf(await extendHold(fakeEvent(id, { role: "admin" }))).status).toBe(409);
    expect(await db.select().from(schema.paymentEvent)).toHaveLength(0);
  });
});
