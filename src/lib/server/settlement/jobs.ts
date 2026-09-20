import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { releaseExpiredHolds, type ReleasedHold } from "./expiry";

/**
 * Settlement hook the email/settlement worker's `scheduled()` handler (EM-4)
 * will call every 5 minutes; the worker does not exist yet. Returns the holds
 * released in this run. The EM-4 worker supplies the notifier from the
 * SvelteKit-free outbox module (EM-3); this module stays email-free so the
 * Worker can import it.
 */
export async function runSettlementJobs(
  db: LibSQLDatabase<typeof schema>,
  now: number = Date.now(),
  onReleased?: (released: readonly ReleasedHold[]) => Promise<void>,
): Promise<ReleasedHold[]> {
  return releaseExpiredHolds(db, now, onReleased);
}
