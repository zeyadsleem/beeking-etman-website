import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { getLang } from "$lib/server/lang";
import { loginRedirectPath } from "$lib/server/login-redirect";
import { t } from "$lib/i18n/messages";
import type { Actions, PageServerLoad } from "./$types";

const accountLimiter = createDbRateLimiter(db, { windowMs: 60_000, max: 15 });

export const load: PageServerLoad = (event) => {
  if (!event.locals.user) redirect(302, loginRedirectPath(event.url));
  return {
    lang: getLang(event),
    user: { email: event.locals.user.email },
  };
};

export const actions: Actions = {
  changePassword: async (event) => {
    const lang = getLang(event);
    if (!(await accountLimiter.allow(`acct:${clientAddressKey(event)}`))) {
      return fail(429, { passwordError: t(lang, "errors.tooManyAttempts") });
    }
    const form = Object.fromEntries(await event.request.formData());
    const currentPassword = typeof form.currentPassword === "string" ? form.currentPassword : "";
    const newPassword = typeof form.newPassword === "string" ? form.newPassword : "";
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: event.request.headers,
      });
    } catch (error) {
      if (error instanceof APIError)
        return fail(400, { passwordError: t(lang, "errors.currentPasswordWrong") });
      return fail(500, { passwordError: t(lang, "errors.unexpected") });
    }
    return { passwordChanged: true };
  },
};
