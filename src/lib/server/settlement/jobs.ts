import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { releaseExpiredHolds } from "./expiry";

/**
 * Settlement hook the email/settlement worker's `scheduled()` handler (EM-4)
 * will call every 5 minutes; the worker does not exist yet. Returns the ids
 * whose holds were released in this run.
 */
export async function runSettlementJobs(
  db: LibSQLDatabase<typeof schema>,
  now: number = Date.now(),
): Promise<string[]> {
  return releaseExpiredHolds(db, now);
}
