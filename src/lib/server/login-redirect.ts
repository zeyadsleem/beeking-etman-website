/**
 * Spec-mandated `redirectTo` flow: auth guards send unauthenticated visitors
 * to `/login?redirectTo=<current path>`, and login/register send them to the
 * original destination after success. Client-supplied targets are validated
 * strictly — only same-origin absolute paths are accepted.
 */

const DEFAULT_REDIRECT_TARGET = "/account";

/** Build the `/login` URL that preserves the current path and query string. */
export function loginRedirectPath(current: URL): string {
  return `/login?redirectTo=${encodeURIComponent(current.pathname + current.search)}`;
}

/**
 * Validate a client-supplied redirect target. Accepts ONLY strings starting
 * with a single "/" (never "//", which browsers treat as protocol-relative)
 * and containing no backslash (WHATWG URL parsing treats "\" as "/" in
 * special schemes, so "/\host" would resolve off-origin); anything else
 * falls back to the account hub.
 */
export function safeRedirectTarget(raw: string | null | undefined): string {
  if (typeof raw !== "string") return DEFAULT_REDIRECT_TARGET;
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")
    ? raw
    : DEFAULT_REDIRECT_TARGET;
}
