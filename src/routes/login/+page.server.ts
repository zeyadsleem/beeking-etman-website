import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { promoteAdminByEmail } from "$lib/server/admin/bootstrap";
import { auth } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { env } from "$env/dynamic/private";
import { getLang } from "$lib/server/lang";
import { safeRedirectTarget } from "$lib/server/login-redirect";
import { AUTH_RATE_LIMITS, clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { t } from "$lib/i18n/messages";
import type { Actions, PageServerLoad } from "./$types";

const loginLimiter = createDbRateLimiter(db, AUTH_RATE_LIMITS.login);

export const load: PageServerLoad = (event) => {
  const redirectTo = event.url.searchParams.get("redirectTo");
  if (event.locals.user) redirect(302, safeRedirectTarget(redirectTo));
  return { redirectTo: safeRedirectTarget(redirectTo) };
};

export const actions: Actions = {
  signIn: async (event) => {
    const lang = getLang(event);
    if (!(await loginLimiter.allow(`login:${clientAddressKey(event)}`))) {
      return fail(429, { message: t(lang, "errors.tooManyAttempts") });
    }
    const form = Object.fromEntries(await event.request.formData());
    const email = typeof form.email === "string" ? form.email : "";
    const password = typeof form.password === "string" ? form.password : "";
    try {
      await auth.api.signInEmail({ body: { email, password } });
    } catch (error) {
      if (error instanceof APIError)
        return fail(400, { message: t(lang, "errors.invalidCredentials") });
      return fail(500, { message: t(lang, "errors.unexpected") });
    }
    await promoteAdminByEmail(db, email, { ADMIN_EMAIL: env.ADMIN_EMAIL });
    redirect(302, safeRedirectTarget(event.url.searchParams.get("redirectTo")));
  },
};
