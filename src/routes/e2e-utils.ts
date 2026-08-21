import type { Page } from "@playwright/test";

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
