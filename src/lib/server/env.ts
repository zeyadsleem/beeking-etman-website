import { building, dev } from "$app/environment";
import { env } from "$env/dynamic/private";

const MIN_SECRET_LENGTH = 32;

function validateEnv(): void {
  // SvelteKit imports the server bundle during the build step (postbuild
  // analysis) with `building = true`; skip validation then so `vite build`
  // works without secrets set. Production runtime still fails fast.
  if (building) return;
  if (dev) return;
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set (required in production)");
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }
  const orderAccessSecret = env.ORDER_ACCESS_SECRET;
  if (!orderAccessSecret)
    throw new Error("ORDER_ACCESS_SECRET is not set (required in production)");
  if (orderAccessSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ORDER_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }
  if (!env.ORIGIN) throw new Error("ORIGIN is not set (required in production)");
}

validateEnv();
