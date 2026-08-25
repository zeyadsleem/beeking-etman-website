import { spawnSync } from "node:child_process";
import { test as base, type Page, type Response } from "@playwright/test";

/**
 * Clears auth rate-limit rows from the e2e D1 database.
 *
 * The register limiter allows 5/hour/IP in a fixed hourly bucket and retried
 * registrations within one run share that budget, so this clears `keyPrefix`
 * rows mid-run, right before a test registers. It must target the same
 * isolated miniflare directory the webServer chain seeds (see
 * E2E_D1_STATE in playwright.config.ts).
 */
export function clearRateLimitRows(keyPrefix: string): void {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "beeking",
      "--local",
      "--persist-to",
      process.env.E2E_D1_STATE ?? ".wrangler/state/e2e",
      "--command",
      `DELETE FROM store_rate_limit WHERE key LIKE '${keyPrefix}%'`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(`d1 rate-limit clear failed: ${result.stderr}`);
  }
}

/**
 * Waits until the SvelteKit app is hydrated and its router is attached
 * (`+layout.svelte` sets `window.__appReady` in an `$effect` after mount).
 * Clicking before this point falls through to native navigation, which makes
 * client-side-routing assertions flaky against the slow wrangler dev server.
 *
 * Self-healing: when the preview server crashes mid-load the HTML arrives but
 * module chunks fail, hydration never completes and __appReady never fires.
 * After a short backoff the page is reloaded against the restarted server
 * (retrying through connection refusals) and hydration is awaited again.
 */
export async function waitForApp(page: Page, timeout = 45_000): Promise<void> {
  const hydrate = async (): Promise<void> => {
    await page.waitForFunction(
      () => (window as unknown as { __appReady?: boolean }).__appReady === true,
      undefined,
      { timeout },
    );
  };
  try {
    await hydrate();
  } catch (error) {
    const deadline = Date.now() + RESTART_WINDOW_MS;
    for (;;) {
      await page.waitForTimeout(RESTART_BACKOFF_MS);
      try {
        await page.reload({ waitUntil: "domcontentloaded" });
        break;
      } catch (reloadError) {
        if (!isServerRestartError(reloadError) || Date.now() >= deadline) throw reloadError;
      }
    }
    await hydrate();
  }
}

/** Transient errors thrown while the wrangler preview restarts after a crash. */
function isServerRestartError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ERR_CONNECTION_REFUSED") ||
    message.includes("ERR_CONNECTION_RESET") ||
    message.includes("ERR_EMPTY_RESPONSE")
  );
}

const RESTART_BACKOFF_MS = 2_000;
const RESTART_WINDOW_MS = 120_000;

/**
 * Navigates, retrying while the wrangler preview webServer is down.
 *
 * The local preview (workerd) exits on benign client-side request aborts
 * (cloudflare/workers-sdk#14926) and takes ~15-30s to come back via the
 * restart loop in playwright.config.ts. A bare goto fails instantly with
 * ERR_CONNECTION_REFUSED during that window; this absorbs it instead of
 * burning a Playwright retry attempt.
 */
async function gotoWithRestartRetry(
  rawGoto: Page["goto"],
  page: Page,
  url: string,
  options?: Parameters<Page["goto"]>[1],
): Promise<Response | null> {
  const deadline = Date.now() + RESTART_WINDOW_MS;
  for (;;) {
    try {
      return await rawGoto(url, options);
    } catch (error) {
      if (!isServerRestartError(error) || Date.now() >= deadline) throw error;
      await page.waitForTimeout(RESTART_BACKOFF_MS);
    }
  }
}

/**
 * Playwright test with a `page` fixture whose `goto` survives preview-server
 * restart windows. Import `test` from here instead of "@playwright/test".
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const rawGoto = page.goto.bind(page);
    page.goto = (url, options) => gotoWithRestartRetry(rawGoto, page, url, options);
    await use(page);
  },
});
