/**
 * Canonical production origin used for <link rel="canonical">, Open Graph
 * URLs and JSON-LD @id values. Override with PUBLIC_SITE_URL (Vite public
 * static env, inlined at build time) when the store moves to a custom
 * domain; preview deployments then still emit the stable production origin
 * instead of self-canonicalizing.
 */
const DEFAULT_SITE_URL = "https://beeking-etman-website.pages.dev";

interface PublicEnv {
  PUBLIC_SITE_URL?: string;
}

function publicEnv(): PublicEnv {
  return (import.meta.env ?? {}) as PublicEnv;
}

export function siteOrigin(): string {
  const raw = publicEnv().PUBLIC_SITE_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export function canonicalUrl(pathname: string): string {
  return `${siteOrigin()}${pathname}`;
}
