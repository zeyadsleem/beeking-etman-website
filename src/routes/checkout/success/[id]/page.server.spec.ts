import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Cookies } from "@sveltejs/kit";
import * as schema from "$lib/server/db/schema";
import { setOrderAccessCookie } from "$lib/server/order-access";
import { t } from "$lib/i18n/messages";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const mockState = vi.hoisted(() => ({
  db: undefined as unknown,
  allow: true,
  limiterOptions: [] as { windowMs: number; max: number }[],
}));

vi.mock("$lib/server/db", () => ({
  get db() {
    return mockState.db;
  },
}));
vi.mock("$env/dynamic/private", () => ({
  env: {
    ORDER_ACCESS_SECRET: "secret",
    ORIGIN: "https://example.com",
    PAYMENT_INSTAPAY_ADDRESS: "shop@instapay",
    PAYMENT_WALLET_NUMBER: "01000000000",
    WHATSAPP_NUMBER: "+20 100 000 0000",
    ADMIN_NOTIFY_EMAILS: "ops@example.com",
  },
}));
vi.mock("$lib/server/rate-limit", () => ({
  clientAddressKey: () => "test",
  createDbRateLimiter: (_db: unknown, options: { windowMs: number; max: number }) => {
    mockState.limiterOptions.push(options);
    return { allow: async () => mockState.allow };
  },
}));

import { actions, load } from "./+page.server";

const DB_FILE = "success-page-test.db";
let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  mockState.db = db;
  await db.run(`DROP TABLE IF EXISTS store_notification`);
  await db.run(`DROP TABLE IF EXISTS store_payment_event`);
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
  opts: {
    method?: string;
    paymentStatus?: string;
    status?: string;
    reference?: string | null;
  } = {},
): Promise<string> {
  const db = mockState.db as Awaited<ReturnType<typeof buildDb>>;
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
    paymentReference: opts.reference ?? null,
    createdAt: Date.now(),
  });
  return id;
}

function cookieJar(): Cookies {
  const values = new Map<string, string>();
  return {
    get: (name) => values.get(name),
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    set: vi.fn((name, value) => {
      values.set(name, value);
    }),
    delete: vi.fn((name) => {
      values.delete(name);
    }),
    serialize: () => "",
  };
}

function loadEvent(id: string, cookies: Cookies) {
  return {
    params: { id },
    cookies,
    locals: {},
    setHeaders: vi.fn(),
    request: new Request(`https://example.com/checkout/success/${id}`),
  } as unknown as Parameters<typeof load>[0];
}

function claimEvent(id: string, cookies: Cookies, form: Record<string, string> = {}) {
  return {
    params: { id },
    cookies,
    locals: {},
    setHeaders: vi.fn(),
    request: new Request(`https://example.com/checkout/success/${id}?/claim`, {
      method: "POST",
      body: new URLSearchParams(form),
    }),
  } as unknown as Parameters<NonNullable<typeof actions.claim>>[0];
}

beforeEach(async () => {
  mockState.allow = true;
  await buildDb();
});

describe("claim rate limits", () => {
  it("configures 5 claims per order and 20 per IP per hour", () => {
    expect(mockState.limiterOptions).toEqual(
      expect.arrayContaining([
        { windowMs: 3_600_000, max: 5 },
        { windowMs: 3_600_000, max: 20 },
      ]),
    );
  });
});

describe("success page load", () => {
  it("projects a claimable transfer order and hides PII", async () => {
    const id = await seedOrder({ method: "instapay" });
    const cookies = cookieJar();
    await setOrderAccessCookie(cookies, id, "secret");

    const data = (await load(loadEvent(id, cookies))) as {
      order: Record<string, unknown>;
      claim: { claimable: boolean; account: string | null; isTransfer: boolean; status: string };
    };

    expect(data.claim).toMatchObject({
      isTransfer: true,
      account: "shop@instapay",
      status: "unpaid",
      claimable: true,
    });
    expect(data.order).not.toHaveProperty("email");
    expect(data.order).not.toHaveProperty("nonce");

    const withWhatsapp = data as unknown as { whatsappUrl: string | null };
    expect(withWhatsapp.whatsappUrl).toContain("https://wa.me/201000000000?text=");
    const decoded = decodeURIComponent(withWhatsapp.whatsappUrl ?? "");
    expect(decoded).toContain("HNY-");
    expect(decoded).toContain(t("ar", "checkout.paymentTitle"));
    expect(decoded).toContain(t("ar", "checkout.method.instapay"));
  });

  it("reports claimed, paid, and refunded states", async () => {
    const claimed = await seedOrder({ paymentStatus: "pending_review", reference: "TRX-1" });
    const paid = await seedOrder({ paymentStatus: "paid" });
    const refunded = await seedOrder({ paymentStatus: "refunded" });
    const claimedCookies = cookieJar();
    const paidCookies = cookieJar();
    const refundedCookies = cookieJar();
    await setOrderAccessCookie(claimedCookies, claimed, "secret");
    await setOrderAccessCookie(paidCookies, paid, "secret");
    await setOrderAccessCookie(refundedCookies, refunded, "secret");

    const claimedData = (await load(loadEvent(claimed, claimedCookies))) as {
      claim: { claimed: boolean; claimable: boolean; reference: string | null };
    };
    expect(claimedData.claim).toMatchObject({
      claimed: true,
      claimable: false,
      reference: "TRX-1",
    });

    const paidData = (await load(loadEvent(paid, paidCookies))) as { claim: { paid: boolean } };
    expect(paidData.claim.paid).toBe(true);

    const refundedData = (await load(loadEvent(refunded, refundedCookies))) as {
      claim: { refunded: boolean; claimable: boolean };
    };
    expect(refundedData.claim).toMatchObject({ refunded: true, claimable: false });
  });

  it("treats COD orders as non-transfer", async () => {
    const id = await seedOrder({ method: "cod" });
    const cookies = cookieJar();
    await setOrderAccessCookie(cookies, id, "secret");

    const data = (await load(loadEvent(id, cookies))) as {
      claim: { isTransfer: boolean; account: string | null; claimable: boolean };
    };
    expect(data.claim).toMatchObject({ isTransfer: false, account: null, claimable: false });
  });

  it("rejects a reader without the capability cookie", async () => {
    const id = await seedOrder();
    await expect(load(loadEvent(id, cookieJar()))).rejects.toMatchObject({ status: 404 });
  });
});

describe("claim action", () => {
  it("records a claim with attribution and a sanitized reference", async () => {
    const id = await seedOrder();
    const cookies = cookieJar();
    await setOrderAccessCookie(cookies, id, "secret");
    const event = claimEvent(id, cookies, {
      reference: ` ${"x".repeat(200)}\u202Eevil`,
    });
    event.locals.user = { id: "user-1" } as App.Locals["user"];

    await expect(actions.claim(event)).resolves.toMatchObject({ claimSubmitted: true });

    const db = mockState.db as Awaited<ReturnType<typeof buildDb>>;
    const order = await db.select().from(schema.order);
    expect(order[0]?.paymentStatus).toBe("pending_review");
    const reference = order[0]?.paymentReference ?? "";
    expect(reference.length).toBe(120);
    expect(reference).not.toContain("\u202E");

    const events = await db.select().from(schema.paymentEvent);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "claim",
      actor: "customer",
      actorUserId: "user-1",
      method: "instapay",
    });
  });

  it("enqueues the claim acknowledgement and the admin alert", async () => {
    const id = await seedOrder();
    const cookies = cookieJar();
    await setOrderAccessCookie(cookies, id, "secret");

    await expect(actions.claim(claimEvent(id, cookies))).resolves.toMatchObject({
      claimSubmitted: true,
    });

    const db = mockState.db as Awaited<ReturnType<typeof buildDb>>;
    const rows = await db.select().from(schema.notification);
    expect(rows).toHaveLength(2); // customer + the single ADMIN_NOTIFY_EMAILS entry
    expect(rows.map((row) => row.recipient).sort()).toEqual(["a@example.com", "ops@example.com"]);
    for (const row of rows) {
      expect(row.type).toBe("payment_claimed");
      expect(row.status).toBe("pending");
    }
    const customer = rows.find((row) => row.recipient === "a@example.com");
    expect(JSON.parse(customer?.body ?? "{}")).toMatchObject({
      text: expect.stringContaining("سجّلنا إشعارك بالتحويل"),
    });
  });

  it("records the claim even when the notification insert fails", async () => {
    const id = await seedOrder();
    const cookies = cookieJar();
    await setOrderAccessCookie(cookies, id, "secret");
    const db = mockState.db as Awaited<ReturnType<typeof buildDb>>;
    await db.run(`DROP TABLE store_notification`);

    await expect(actions.claim(claimEvent(id, cookies))).resolves.toMatchObject({
      claimSubmitted: true,
    });

    const order = await db.select().from(schema.order);
    expect(order[0]?.paymentStatus).toBe("pending_review");
  });

  it("answers a duplicate claim with the friendly already-claimed error", async () => {
    const id = await seedOrder({ paymentStatus: "pending_review" });
    const cookies = cookieJar();
    await setOrderAccessCookie(cookies, id, "secret");

    const result = await actions.claim(claimEvent(id, cookies));
    expect(result).toMatchObject({ status: 400 });
    expect((result as { data: { claimError: string } }).data.claimError).toBe(
      t("ar", "success.claim.alreadyClaimed"),
    );
  });

  it("refuses a claim without the capability cookie", async () => {
    const id = await seedOrder();
    await expect(actions.claim(claimEvent(id, cookieJar()))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns 429 when a limit rejects the request", async () => {
    const id = await seedOrder();
    const cookies = cookieJar();
    await setOrderAccessCookie(cookies, id, "secret");
    mockState.allow = false;

    const result = await actions.claim(claimEvent(id, cookies));
    expect(result).toMatchObject({ status: 429 });
  });

  it("refuses a claim on a COD order", async () => {
    const id = await seedOrder({ method: "cod" });
    const cookies = cookieJar();
    await setOrderAccessCookie(cookies, id, "secret");

    const result = await actions.claim(claimEvent(id, cookies));
    expect(result).toMatchObject({ status: 400 });
    expect((result as { data: { claimError: string } }).data.claimError).toBe(
      t("ar", "success.claim.error.notTransfer"),
    );
  });
});

afterAll(() => {
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
});
