import { and, eq, lt, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { isBusyError, sleep, SQLITE_BUSY_RETRIES } from "$lib/server/sqlite";
import * as schema from "$lib/server/db/schema";

const GLOBAL_PRUNE_PROBABILITY = 0.01;
const GLOBAL_PRUNE_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface DbRateLimiter {
  allow(key: string): Promise<boolean>;
}

export function createDbRateLimiter(
  db: LibSQLDatabase<typeof schema>,
  options: { windowMs: number; max: number },
): DbRateLimiter {
  const { windowMs, max } = options;
  return {
    async allow(key): Promise<boolean> {
      const now = Date.now();
      const bucket = Math.floor(now / windowMs) * windowMs;

      await pruneExpiredKeys(db, key, bucket);
      if (Math.random() < GLOBAL_PRUNE_PROBABILITY) {
        await pruneAbandonedKeys(db, now - GLOBAL_PRUNE_WINDOW_MS);
      }

      for (let attempt = 0; attempt < SQLITE_BUSY_RETRIES; attempt++) {
        try {
          const [row] = await db
            .insert(schema.rateLimit)
            .values({ key, windowStart: bucket, count: 1 })
            .onConflictDoUpdate({
              target: [schema.rateLimit.key, schema.rateLimit.windowStart],
              set: { count: sql`${schema.rateLimit.count} + 1` },
            })
            .returning({ count: schema.rateLimit.count });
          return (row?.count ?? 1) <= max;
        } catch (error) {
          if (isBusyError(error) && attempt < SQLITE_BUSY_RETRIES - 1) {
            await sleep((attempt + 1) * 50);
            continue;
          }
          throw error;
        }
      }
      return false;
    },
  };
}

function pruneExpiredKeys(
  db: LibSQLDatabase<typeof schema>,
  key: string,
  bucket: number,
): Promise<unknown> {
  return db
    .delete(schema.rateLimit)
    .where(and(eq(schema.rateLimit.key, key), lt(schema.rateLimit.windowStart, bucket)));
}

async function pruneAbandonedKeys(
  db: LibSQLDatabase<typeof schema>,
  before: number,
): Promise<void> {
  try {
    await db.delete(schema.rateLimit).where(lt(schema.rateLimit.windowStart, before));
  } catch {
    // Best-effort cleanup; never blocks a request.
  }
}

export function clientAddressKey(event: { getClientAddress(): string }): string {
  try {
    return event.getClientAddress();
  } catch {
    return "unknown";
  }
}
