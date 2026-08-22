import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import {
  MAX_ADDRESSES,
  addressSchema,
  createAddress,
  deleteAddress,
  getDefaultAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "./addresses";

const DB_FILE = "addresses-test.db";

async function buildDb() {
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_address`);
  // Mirrors the production migration: no foreign key on user_id (deliberate
  // convention from Task 1), and embedded libsql enforces FKs by default.
  await db.run(`CREATE TABLE store_address (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    label TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
    address TEXT NOT NULL, city TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  await db.run(`CREATE INDEX IF NOT EXISTS store_address_userId_idx ON store_address(user_id)`);
  return db;
}

const USER = "u1";
const base = {
  label: "البيت",
  name: "سارة",
  phone: "01012345678",
  address: "12 شارع النيل",
  city: "القاهرة",
};

function addr(overrides: Partial<typeof base> = {}) {
  return { ...base, ...overrides };
}

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("addressSchema", () => {
  it("rejects bad phone, empty label, overlong fields", () => {
    expect(addressSchema().safeParse(addr({ phone: "123" })).success).toBe(false);
    expect(addressSchema().safeParse(addr({ label: "" })).success).toBe(false);
    expect(addressSchema().safeParse(addr({ label: "x".repeat(41) })).success).toBe(false);
    expect(addressSchema().safeParse(addr({ address: "x".repeat(201) })).success).toBe(false);
    expect(addressSchema().safeParse(addr()).success).toBe(true);
  });
});

describe("createAddress", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("creates and makes the first address the default", async () => {
    const r = await createAddress(db, USER, addr());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.isDefault).toBe(1);
    const def = await getDefaultAddress(db, USER);
    expect(def?.id).toBe(r.value.id);
  });

  it("second address is not default; swapping moves default", async () => {
    await createAddress(db, USER, addr());
    const second = await createAddress(db, USER, addr({ label: "الشغل" }));
    expect(second.ok).toBe(true);
    if (!second.ok || !second.value) return;
    expect(second.value.isDefault).toBe(0);
    const swap = await setDefaultAddress(db, USER, second.value.id);
    expect(swap.ok).toBe(true);
    const def = await getDefaultAddress(db, USER);
    expect(def?.id).toBe(second.value.id);
    const all = await listAddresses(db, USER);
    expect(all.filter((a) => a.isDefault === 1)).toHaveLength(1);
  });

  it("enforces the 10-address cap", async () => {
    for (let i = 0; i < MAX_ADDRESSES; i++) {
      const r = await createAddress(db, USER, addr({ label: `عنوان ${i}` }));
      expect(r.ok).toBe(true);
    }
    const extra = await createAddress(db, USER, addr({ label: "زائد" }));
    expect(extra).toEqual({ ok: false, error: "limit_reached" });
  });
});

describe("updateAddress / deleteAddress", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("updates own address and rejects foreign/unknown ids", async () => {
    const mine = await createAddress(db, USER, addr());
    if (!mine.ok) throw new Error("seed failed");
    const upd = await updateAddress(db, USER, mine.value.id, addr({ name: "منى" }));
    expect(upd.ok).toBe(true);
    const foreign = await updateAddress(db, "u2", mine.value.id, addr());
    const unknown = await updateAddress(db, USER, "nope", addr());
    expect(foreign).toEqual({ ok: false, error: "not_found" });
    expect(unknown).toEqual({ ok: false, error: "not_found" });
  });

  it("deleting the default promotes the most recent remaining address", async () => {
    const a = await createAddress(db, USER, addr());
    const b = await createAddress(db, USER, addr({ label: "الثاني" }));
    if (!(a.ok && b.ok)) throw new Error("seed failed");
    const del = await deleteAddress(db, USER, a.value.id);
    expect(del.ok).toBe(true);
    const def = await getDefaultAddress(db, USER);
    expect(def?.id).toBe(b.value.id);
    expect(await listAddresses(db, USER)).toHaveLength(1);
  });

  it("deleting another user's address does nothing", async () => {
    const a = await createAddress(db, USER, addr());
    if (!a.ok) throw new Error("seed failed");
    await deleteAddress(db, "u9", a.value.id);
    expect(await listAddresses(db, USER)).toHaveLength(1);
  });
});
