/**
 * PostHog analytics client — lazy-loaded to avoid blocking the main bundle.
 *
 * All public functions are safe to call server-side (they become no-ops)
 * and safe to call before initialization completes.
 */
import { browser } from "$app/environment";
import type { PostHog } from "posthog-js";

let instance: PostHog | null = null;
let initPromise: Promise<PostHog> | null = null;

/**
 * Lazily import and initialise PostHog. Safe to call multiple times —
 * subsequent calls are no-ops that return the cached instance.
 */
export async function initPostHog(key: string): Promise<PostHog | null> {
  if (instance) return instance;
  if (!browser || !key) return null;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const posthog = (await import("posthog-js")).default;
    posthog.init(key, {
      api_host: "https://us.i.posthog.com",
      autocapture: true,
      capture_pageview: false,
      capture_pageleave: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      persistence: "localStorage+cookie",
    });
    instance = posthog;
    return posthog;
  })();

  return initPromise;
}

/** Fire a custom event. No-op if PostHog is not initialized. */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  instance?.capture(name, properties);
}

/** Set person properties on the current identified user. No-op if not initialized. */
export function setPersonProperties(props: Record<string, string>): void {
  instance?.people.set(props);
}

/** Return the raw PostHog instance (or null). */
export function getPostHog(): PostHog | null {
  return instance;
}
