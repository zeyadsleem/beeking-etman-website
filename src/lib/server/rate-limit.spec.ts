import { afterAll, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { clientAddressKey, createDbRateLimiter } from "./rate-limit";

const DB_FILE = "rate-limit-test.db";

async function buildDb() {
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_rate_limit`);
  await db.run(`
    CREATE TABLE store_rate_limit (
      key TEXT NOT NULL, window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(key, window_start)
    )`);
  return db;
}

/** Sleep until the start of the next fixed window after `windowMs`. */
async function waitForNextBucket(windowMs: number): Promise<void> {
  const now = Date.now();
  const nextBoundary = (Math.floor(now / windowMs) + 1) * windowMs;
  await new Promise((resolve) => setTimeout(resolve, nextBoundary - now + 5));
}

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("createDbRateLimiter", () => {
  it("allows requests up to the max in one window", async () => {
    const db = await buildDb();
    const limiter = createDbRateLimiter(db, { windowMs: 3_600_000, max: 3 });
    expect(await limiter.allow("k")).toBe(true);
    expect(await limiter.allow("k")).toBe(true);
    expect(await limiter.allow("k")).toBe(true);
  });

  it("denies once the window budget is exhausted", async () => {
    const db = await buildDb();
    const limiter = createDbRateLimiter(db, { windowMs: 3_600_000, max: 3 });
    await limiter.allow("k");
    await limiter.allow("k");
    await limiter.allow("k");
    expect(await limiter.allow("k")).toBe(false);
  });

  it("accumulates counts in the same window", async () => {
    const db = await buildDb();
    const limiter = createDbRateLimiter(db, { windowMs: 3_600_000, max: 10 });
    await limiter.allow("k");
    await limiter.allow("k");
    const row = await db.select().from(schema.rateLimit).where(eq(schema.rateLimit.key, "k")).get();
    expect(row?.count).toBe(2);
  });

  it("resets the count when the window rolls over", async () => {
    const db = await buildDb();
    const limiter = createDbRateLimiter(db, { windowMs: 100, max: 1 });
    // Within a single window max=1 allows the first call and would deny the
    // next; after the boundary the counter must start fresh at 1 again.
    expect(await limiter.allow("k")).toBe(true);
    await waitForNextBucket(100);
    expect(await limiter.allow("k")).toBe(true);
    await waitForNextBucket(100);
    expect(await limiter.allow("k")).toBe(true);
  });

  it("prunes stale buckets for a key on rollover", async () => {
    const db = await buildDb();
    const limiter = createDbRateLimiter(db, { windowMs: 100, max: 100 });
    await limiter.allow("k");
    const first = await db
      .select()
      .from(schema.rateLimit)
      .where(eq(schema.rateLimit.key, "k"))
      .get();
    expect(first?.windowStart).toBeDefined();
    await waitForNextBucket(100);
    await limiter.allow("k");

    const rows = await db.select().from(schema.rateLimit).where(eq(schema.rateLimit.key, "k"));
    expect(rows).toHaveLength(1);
    expect(rows[0].windowStart).toBeGreaterThan(first?.windowStart ?? 0);
    expect(rows[0].count).toBe(1);
  });

  it("keeps namespaced keys independent", async () => {
    const db = await buildDb();
    const limiter = createDbRateLimiter(db, { windowMs: 3_600_000, max: 1 });
    expect(await limiter.allow("login:1.2.3.4")).toBe(true);
    expect(await limiter.allow("register:1.2.3.4")).toBe(true);
    expect(await limiter.allow("login:1.2.3.4")).toBe(false);
    expect(await limiter.allow("register:1.2.3.4")).toBe(false);
    expect(await limiter.allow("login:5.6.7.8")).toBe(true);
  });

  it("ignores rows belonging to other keys when pruning", async () => {
    const db = await buildDb();
    await db.insert(schema.rateLimit).values({ key: "other", windowStart: 1, count: 5 });
    const limiter = createDbRateLimiter(db, { windowMs: 3_600_000, max: 1 });
    expect(await limiter.allow("k")).toBe(true);
    const rows = await db
      .select({ key: schema.rateLimit.key, windowStart: schema.rateLimit.windowStart })
      .from(schema.rateLimit)
      .where(sql`${schema.rateLimit.windowStart} = 1`);
    expect(rows).toEqual([{ key: "other", windowStart: 1 }]);
  });
});

describe("clientAddressKey", () => {
  it("returns the client address", () => {
    expect(clientAddressKey({ getClientAddress: () => "10.0.0.7" })).toBe("10.0.0.7");
  });

  it("falls back to unknown when getClientAddress throws", () => {
    expect(
      clientAddressKey({
        getClientAddress: () => {
          throw new Error("no client address outside request scope");
        },
      }),
    ).toBe("unknown");
  });
});
