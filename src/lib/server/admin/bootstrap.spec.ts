import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { isAdminEmail, promoteAdminByEmail, type AdminEnv } from "./bootstrap";

// Plain records satisfy AdminEnv, so tests inject env directly instead of
// mutating process.env (which SvelteKit's dynamic env module does not reflect
// under vitest).
const adminEnv = (adminEmail?: string): AdminEnv => ({
  ADMIN_EMAIL: adminEmail,
});

const DB_FILE = "admin-bootstrap-test.db";

async function buildDb() {
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS user`);
  // Mirrors production migration 0000 (`user` table + unique email index)
  // and 0008 (`role`/`banned`/`ban_reason`/`ban_expires` added as nullable;
  // no default on role; impersonated_by lives on session, not user).
  await db.run(`CREATE TABLE user (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    email_verified INTEGER DEFAULT false NOT NULL,
    image TEXT,
    created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
    updated_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL)`);
  await db.run(`CREATE UNIQUE INDEX user_email_unique ON user (email)`);
  await db.run(`ALTER TABLE user ADD role TEXT`);
  await db.run(`ALTER TABLE user ADD banned INTEGER DEFAULT false`);
  await db.run(`ALTER TABLE user ADD ban_reason TEXT`);
  await db.run(`ALTER TABLE user ADD ban_expires INTEGER`);
  return db;
}

async function seedUser(
  db: Awaited<ReturnType<typeof buildDb>>,
  email: string,
  role: string | null = "user",
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.user).values({
    id,
    name: "Owner",
    email,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("isAdminEmail", () => {
  it("compares case-insensitively and fails when unset", () => {
    expect(isAdminEmail("OWNER@Beeking.com", adminEnv("owner@beeking.com"))).toBe(true);
    expect(isAdminEmail("owner@beeking.com", adminEnv())).toBe(false);
  });
});

describe("promoteAdminByEmail", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
    db = await buildDb();
  });

  it("promotes the matching user case-insensitively", async () => {
    await seedUser(db, "owner@beeking.com");
    const promoted = await promoteAdminByEmail(
      db,
      "OWNER@beeking.com",
      adminEnv("Owner@Beeking.com"),
    );
    expect(promoted).toBe(true);
    const row = await db.select().from(schema.user).get();
    expect(row?.role).toBe("admin");
  });

  it("is a no-op when emails differ or ADMIN_EMAIL is unset", async () => {
    await seedUser(db, "owner@beeking.com");
    const mismatched = await promoteAdminByEmail(
      db,
      "owner@beeking.com",
      adminEnv("other@beeking.com"),
    );
    expect(mismatched).toBe(false);
    const unset = await promoteAdminByEmail(db, "owner@beeking.com", adminEnv());
    expect(unset).toBe(false);
    const row = await db.select().from(schema.user).get();
    expect(row?.role).toBe("user");
  });

  it("returns false for unknown users without throwing", async () => {
    const promoted = await promoteAdminByEmail(
      db,
      "ghost@beeking.com",
      adminEnv("owner@beeking.com"),
    );
    expect(promoted).toBe(false);
    expect(await db.select().from(schema.user).get()).toBeUndefined();
  });
});
