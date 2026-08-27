/**
 * Cron-trigger skeleton for abandoned-cart recovery.
 *
 * Cloudflare cron triggers require a Workers deployment (not Pages).
 * To activate:
 *   1. Create a Worker entry that imports this handler.
 *   2. Add a `[[cron]]` section to `wrangler.jsonc` (see that file for the
 *      commented-out example) or to a dedicated `wrangler.workers.jsonc`.
 *   3. The domain must have email sending onboarded (see README).
 *
 * Schedule: daily at 08:00 UTC (10:00 Cairo time).
 */

import type { ScheduledEvent, ExecutionContext } from "@cloudflare/workers-types";

interface ScheduledEnv {
  DB: unknown;
  EMAIL: unknown;
}

/**
 * Entry point for the cron-triggered Worker. Currently logs and no-ops.
 * Phase 6 will implement abandoned-cart detection and recovery emails here.
 */
export async function handleCronTrigger(
  event: ScheduledEvent,
  env: ScheduledEnv,
  ctx: ExecutionContext,
): Promise<void> {
  console.log("[cron] scheduled event received at", new Date(event.scheduledTime).toISOString());

  // Phase 6: abandoned-cart recovery
  // 1. Query D1 for carts last updated > 2 hours ago with no completed order
  // 2. For each abandoned cart, send a recovery email via the EMAIL binding
  // 3. Log results: carts found, emails sent, errors
  ctx.waitUntil(
    (async () => {
      console.log("[cron] no-op — abandoned-cart recovery not yet implemented");
    })(),
  );
}
