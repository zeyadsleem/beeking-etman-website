import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import { clientAddressKey, createRateLimiter } from "$lib/server/rate-limit";
import type { Actions, PageServerLoad } from "./$types";

const loginLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export const load: PageServerLoad = (event) => {
  if (event.locals.user) redirect(302, "/account/orders");
};

export const actions: Actions = {
  signIn: async (event) => {
    if (!loginLimiter.allow(clientAddressKey(event))) {
      return fail(429, { message: "محاولات كثيرة، حاول لاحقًا" });
    }
    const form = Object.fromEntries(await event.request.formData());
    const email = String(form.email ?? "");
    const password = String(form.password ?? "");
    try {
      await auth.api.signInEmail({ body: { email, password } });
    } catch (error) {
      if (error instanceof APIError) return fail(400, { message: "بيانات الدخول غير صحيحة" });
      return fail(500, { message: "حدث خطأ غير متوقع" });
    }
    redirect(302, "/account/orders");
  },
};
