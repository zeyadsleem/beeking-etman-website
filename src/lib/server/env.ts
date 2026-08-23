import { building, dev } from "$app/environment";
import { env } from "$env/dynamic/private";

const MIN_SECRET_LENGTH = 32;
// Plausibility, not RFC completeness: one @ separating local part from a
// dotted domain, no whitespace anywhere (so empty/blank values never pass).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlausibleEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Pure production-env contract, exercised directly by unit tests and by the
 * boot-time check below. Throws on any misconfiguration so production fails
 * fast at startup instead of misbehaving per-request. Optional vars must be
 * well-formed when present; absent vars stay legal.
 */
export function validateProductionEnv(vars: Record<string, string | undefined>): void {
  const secret = vars.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set (required in production)");
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }
  const orderAccessSecret = vars.ORDER_ACCESS_SECRET;
  if (!orderAccessSecret)
    throw new Error("ORDER_ACCESS_SECRET is not set (required in production)");
  if (orderAccessSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ORDER_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }
  if (!vars.ORIGIN) throw new Error("ORIGIN is not set (required in production)");
  // Bootstrap admin promotion compares this against sign-in emails; a typo'd
  // value would silently never promote anyone, so fail fast instead.
  const adminEmail = vars.ADMIN_EMAIL;
  if (adminEmail !== undefined && !isPlausibleEmail(adminEmail)) {
    throw new Error("ADMIN_EMAIL must be a plausible email address when set");
  }
  // Stored media URLs are built as `${base}/${key}`; a blank or non-https base
  // would corrupt every uploaded image URL (or leak an insecure scheme), so
  // reject it at boot rather than per upload.
  const mediaBase = vars.MEDIA_PUBLIC_BASE_URL;
  if (mediaBase !== undefined && !isHttpsUrl(mediaBase)) {
    throw new Error("MEDIA_PUBLIC_BASE_URL must be a non-empty https:// URL when set");
  }
}

function validateEnv(): void {
  // SvelteKit imports the server bundle during the build step (postbuild
  // analysis) with `building = true`; skip validation then so `vite build`
  // works without secrets set. Production runtime still fails fast.
  if (building) return;
  if (dev) return;
  validateProductionEnv(env);
}

validateEnv();
