import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const mailEnv = vi.hoisted(() => ({
  ADMIN_NOTIFY_EMAILS: "ops@example.com, owner@example.com",
}));

vi.mock("$env/dynamic/private", () => ({
  env: {
    ORDER_ACCESS_SECRET: "secret",
    ORIGIN: "https://example.com",
    PAYMENT_INSTAPAY_ADDRESS: "shop@instapay",
    PAYMENT_WALLET_NUMBER: "01000000000",
    get ADMIN_NOTIFY_EMAILS() {
      return mailEnv.ADMIN_NOTIFY_EMAILS;
    },
  },
}));

import {
  sendEmail,
  sendOrderConfirmation,
  sendPaymentClaimed,
  sendPaymentConfirmed,
  sendPaymentFailed,
  sendRefund,
} from "./email";

const DB_FILE = "email-test.db";
let client: ReturnType<typeof createClient> | null = null;

async function buildDb(): Promise<LibSQLDatabase<typeof schema>> {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_notification`);
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
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
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL REFERENCES store_order(id),
      product_id TEXT NOT NULL,
      variant_id TEXT,
      product_name TEXT NOT NULL,
      variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL
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
  return db;
}

async function seedOrder(
  db: LibSQLDatabase<typeof schema>,
  opts: { method?: string; total?: number } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.order).values({
    id,
    number: `HNY-${id.slice(0, 6)}`,
    email: "customer@example.com",
    name: "أحمد",
    phone: "01012345678",
    address: "شارع 9",
    city: "القاهرة",
    total: opts.total ?? 260_00,
    status: "pending_confirmation",
    paymentStatus: "unpaid",
    paymentMethod: opts.method ?? "instapay",
    createdAt: Date.now(),
  });
  await db.insert(schema.orderItem).values({
    orderId: id,
    productId: crypto.randomUUID(),
    variantId: null,
    productName: "عسل سدر مصري",
    variantName: "كيلو",
    quantity: 2,
    unitPrice: 130_00,
  });
  return id;
}

function outbox(db: LibSQLDatabase<typeof schema>) {
  return db.select().from(schema.notification);
}

async function rowsFor(db: LibSQLDatabase<typeof schema>, type: string) {
  return (await outbox(db)).filter((row) => row.type === type);
}

/** The stored body is JSON `{html,text}`; assert against both renderings. */
function bodyOf(row: { body: string }): { html: string; text: string } {
  return JSON.parse(row.body) as { html: string; text: string };
}

describe("sendEmail", () => {
  it("is a no-op when the EMAIL binding is absent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // No platform at all — should not throw.
    await sendEmail(undefined, {
      to: "test@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("EMAIL binding unavailable"));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("test@example.com");
    warn.mockRestore();
  });

  it("is a no-op when platform exists but EMAIL is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Platform with no EMAIL binding — exercises the platform?.env.EMAIL path.
    await sendEmail({ env: {} } as unknown as App.Platform, {
      to: "test@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("calls env.EMAIL.send when binding is available", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg-123" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const platform = { env: { EMAIL: { send: sendMock } } } as unknown as App.Platform;

    await sendEmail(platform, {
      to: "user@test.com",
      subject: "Test",
      html: "<p>Body</p>",
      text: "Body",
    });

    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: "Test",
        html: "<p>Body</p>",
        text: "Body",
      }),
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("order received email", () => {
  let db: LibSQLDatabase<typeof schema>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("enqueues the receiving account and the exact amount for a transfer order", async () => {
    const orderId = await seedOrder(db, { method: "instapay", total: 260_00 });

    await sendOrderConfirmation(db, orderId);

    const [row] = await rowsFor(db, "order_received");
    expect(row).toMatchObject({
      channel: "email",
      recipient: "customer@example.com",
      status: "pending", // enqueue-only; the worker's drain delivers it
    });
    const { html, text } = bodyOf(row!);
    for (const rendering of [html, text]) {
      expect(rendering).toContain("shop@instapay");
      expect(rendering).toContain("٢٦٠");
      expect(rendering).toContain("/checkout/success/");
      expect(rendering).not.toMatch(/تم الدفع|تم استلام المبلغ|paid/i);
    }
    expect(row!.subject).toContain("تم استلام الطلب");
    expect(text).toContain("تعليمات التحويل");
    // The new-order digest rides the canonical admin_alert type.
    const adminRows = await rowsFor(db, "admin_alert");
    expect(adminRows).toHaveLength(2);
    expect(adminRows.map((adminRow) => adminRow.recipient).sort()).toEqual([
      "ops@example.com",
      "owner@example.com",
    ]);
  });

  it("names the wallet number for a wallet order", async () => {
    const orderId = await seedOrder(db, { method: "wallet" });

    await sendOrderConfirmation(db, orderId);

    const [row] = await rowsFor(db, "order_received");
    expect(bodyOf(row!).text).toContain("01000000000");
    expect(bodyOf(row!).text).toContain("رقم المحفظة");
  });

  it("states the amount is due on delivery for a COD order", async () => {
    const orderId = await seedOrder(db, { method: "cod" });

    await sendOrderConfirmation(db, orderId);

    const [row] = await rowsFor(db, "order_received");
    const { html, text } = bodyOf(row!);
    for (const rendering of [html, text]) {
      expect(rendering).toContain("المبلغ المستحق عند الاستلام");
      expect(rendering).not.toMatch(/تم الدفع|paid/i);
      expect(rendering).not.toContain("shop@instapay");
    }
    expect(row!.subject).toContain("تم استلام الطلب");
  });
});

describe("settlement notification emails", () => {
  let db: LibSQLDatabase<typeof schema>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("acknowledges a claim to the customer and alerts every admin", async () => {
    const orderId = await seedOrder(db, { method: "wallet" });

    await sendPaymentClaimed(db, orderId);

    const rows = await rowsFor(db, "payment_claimed");
    expect(rows).toHaveLength(3); // customer + two ADMIN_NOTIFY_EMAILS
    const recipients = rows.map((row) => row.recipient).sort();
    expect(recipients).toEqual(["customer@example.com", "ops@example.com", "owner@example.com"]);
    for (const row of rows) expect(row.status).toBe("pending");
    const customer = rows.find((row) => row.recipient === "customer@example.com")!;
    expect(bodyOf(customer).text).toContain("سجّلنا إشعارك بالتحويل");
    expect(bodyOf(customer).text).not.toMatch(/تم تأكيد الدفع|payment confirmed/i);
    const admin = rows.find((row) => row.recipient === "ops@example.com")!;
    expect(admin.subject).toContain("مراجعة تحويل");
    expect(bodyOf(admin).text).toContain("/admin/orders/");
    expect(bodyOf(admin).text).toContain("العميل أكّد إنه حوّل المبلغ");
  });

  it("confirms a verified payment stating only what happened", async () => {
    const orderId = await seedOrder(db, { method: "instapay" });

    await sendPaymentConfirmed(db, orderId);

    const [row] = await rowsFor(db, "payment_confirmed");
    expect(row).toMatchObject({ recipient: "customer@example.com", status: "pending" });
    expect(bodyOf(row!).text).toContain("تأكد الدفع");
    expect(bodyOf(row!).text).toContain("المبلغ المدفوع");
  });

  it("still enqueues the customer acknowledgement when no admins are configured", async () => {
    const previous = mailEnv.ADMIN_NOTIFY_EMAILS;
    mailEnv.ADMIN_NOTIFY_EMAILS = "";
    try {
      const orderId = await seedOrder(db, { method: "wallet" });

      await sendPaymentClaimed(db, orderId);

      const rows = await rowsFor(db, "payment_claimed");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ recipient: "customer@example.com", status: "pending" });
    } finally {
      mailEnv.ADMIN_NOTIFY_EMAILS = previous;
    }
  });

  it("notifies the customer of a rejected claim without claiming money arrived", async () => {
    const orderId = await seedOrder(db, { method: "wallet" });

    await sendPaymentFailed(db, orderId);

    const [row] = await rowsFor(db, "payment_failed");
    expect(row).toMatchObject({ recipient: "customer@example.com", status: "pending" });
    expect(bodyOf(row!).text).toContain("لم نتمكن من تأكيد التحويل");
    expect(bodyOf(row!).text).not.toMatch(/تم الدفع|paid/i);
  });

  it("records the refunded amount and its reference", async () => {
    const orderId = await seedOrder(db, { method: "instapay" });

    await sendRefund(db, orderId, "RF-77");

    const [row] = await rowsFor(db, "refund");
    expect(row).toMatchObject({ recipient: "customer@example.com", status: "pending" });
    expect(bodyOf(row!).text).toContain("RF-77");
    expect(bodyOf(row!).text).toContain("المبلغ المسترد");
    // formatEGP renders Arabic-Indic digits: 260.00 EGP.
    expect(bodyOf(row!).text).toContain("٢٦٠");
    expect(bodyOf(row!).text).toContain("ج.م.");
    // The shop moves the money manually; the system records the decision.
    expect(bodyOf(row!).text).toContain("يدويًا");
  });
});

afterAll(() => {
  client?.close();
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
});
