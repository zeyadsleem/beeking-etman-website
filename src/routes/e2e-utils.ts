import { test as base, type Page, type Response } from "@playwright/test";

/**
 * Waits until the SvelteKit app is hydrated and its router is attached
 * (`+layout.svelte` sets `window.__appReady` in an `$effect` after mount).
 * Clicking before this point falls through to native navigation, which makes
 * client-side-routing assertions flaky against the slow wrangler dev server.
 */
export async function waitForApp(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __appReady?: boolean }).__appReady === true,
    undefined,
    { timeout },
  );
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
