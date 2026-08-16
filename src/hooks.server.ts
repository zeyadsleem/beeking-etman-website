import type { Handle } from "@sveltejs/kit";
import { building } from "$app/environment";
import { auth } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { t } from "$lib/i18n/messages";
import { svelteKitHandler } from "better-auth/svelte-kit";

// Better Auth's JSON API (POST /api/auth/sign-in/email, /api/auth/sign-up/email)
// is served by the svelteKitHandler below and would otherwise bypass the
// rate limiter that guards the form actions. Limit the same paths here, with
// the same windows/keys as the matching form actions so both entry points
// share one bucket per endpoint (login 10/60s, register 5/1h).
const loginLimiter = createDbRateLimiter(db, { windowMs: 60_000, max: 10 });
const registerLimiter = createDbRateLimiter(db, { windowMs: 3_600_000, max: 5 });

const AUTH_RATE_LIMITED_PATHS = new Map<string, (ip: string) => Promise<boolean>>([
  ["/sign-in/email", (ip) => loginLimiter.allow(`login:${ip}`)],
  ["/sign-up/email", (ip) => registerLimiter.allow(`register:${ip}`)],
]);

const handleBetterAuth: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
  }

  if (!building && event.request.method === "POST" && event.url.pathname.startsWith("/api/auth/")) {
    const limiter = AUTH_RATE_LIMITED_PATHS.get(event.url.pathname.slice("/api/auth".length));
    if (limiter && !(await limiter(clientAddressKey(event)))) {
      return new Response(
        JSON.stringify({ message: t(getLang(event), "errors.tooManyAttempts") }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
