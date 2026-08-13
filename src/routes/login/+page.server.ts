import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = (event) => {
  if (event.locals.user) redirect(302, "/account/orders");
};

export const actions: Actions = {
  signIn: async (event) => {
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
