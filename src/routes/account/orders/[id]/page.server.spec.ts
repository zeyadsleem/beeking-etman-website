import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Cookies } from "@sveltejs/kit";
import * as schema from "$lib/server/db/schema";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const mockState = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("$lib/server/db", () => ({
  get db() {
    return mockState.db;
  },
}));
vi.mock("$env/dynamic/private", () => ({
  env: {
    PAYMENT_INSTAPAY_ADDRESS: "shop@instapay",
    PAYMENT_WALLET_NUMBER: "01000000000",
    WHATSAPP_NUMBER: "+20 100 000 0000",
  },
}));

import { load } from "./+page.server";

const DB_FILE = "account-order-detail-test.db";
const USER_ID = "user-1";

let client: ReturnType<typeof createClient> | null = null;

async function buildDb() {
  client ??= createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  mockState.db = db;
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
  return db;
}

async function seedOrder(
  opts: {
    method?: string;
    paymentStatus?: string;
    status?: string;
    userId?: string | null;
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
    userId: opts.userId === undefined ? USER_ID : opts.userId,
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

function loadEvent(id: string, user: { id: string } | null = { id: USER_ID }) {
  return {
    params: { id },
    cookies: cookieJar(),
    locals: { user },
    setHeaders: vi.fn(),
    url: new URL(`https://example.com/account/orders/${id}`),
    request: new Request(`https://example.com/account/orders/${id}`),
  } as unknown as Parameters<typeof load>[0];
}

beforeEach(async () => {
  await buildDb();
});

describe("account order detail load", () => {
  it("shows the receiving account while a transfer order is claimable", async () => {
    const id = await seedOrder({ method: "instapay" });

    const data = (await load(loadEvent(id))) as {
      order: Record<string, unknown>;
      payment: { methodLabelKey: string | null; account: string | null; claimable: boolean };
      whatsappUrl: string | null;
    };

    expect(data.payment).toEqual({
      methodLabelKey: "checkout.method.instapay",
      account: "shop@instapay",
      claimable: true,
    });
    expect(data.whatsappUrl).toContain("https://wa.me/201000000000?text=");
    expect(data.order).not.toHaveProperty("paymentStatus");
    expect(data.order).not.toHaveProperty("paymentMethod");
  });

  it("hides the account once the claim is under review", async () => {
    const id = await seedOrder({ paymentStatus: "pending_review" });

    const data = (await load(loadEvent(id))) as {
      payment: { account: string | null; claimable: boolean };
    };

    expect(data.payment).toMatchObject({ account: null, claimable: false });
  });

  it("never offers a transfer account for COD or cancelled orders", async () => {
    const cod = await seedOrder({ method: "cod" });
    const cancelled = await seedOrder({ status: "cancelled" });

    const codData = (await load(loadEvent(cod))) as {
      payment: { methodLabelKey: string | null; account: string | null; claimable: boolean };
    };
    expect(codData.payment).toEqual({
      methodLabelKey: "checkout.method.cod",
      account: null,
      claimable: false,
    });

    const cancelledData = (await load(loadEvent(cancelled))) as {
      payment: { account: string | null; claimable: boolean };
    };
    expect(cancelledData.payment).toMatchObject({ account: null, claimable: false });
  });

  it("redirects signed-out visitors and hides other users' orders", async () => {
    const id = await seedOrder();
    await expect(load(loadEvent(id, null))).rejects.toMatchObject({ status: 302 });
    await expect(load(loadEvent(id, { id: "other-user" }))).rejects.toMatchObject({
      status: 404,
    });
  });
});

afterAll(() => {
  for (const file of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
});
