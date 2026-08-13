import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import { clientAddressKey, createRateLimiter } from "$lib/server/rate-limit";
import type { Actions, PageServerLoad } from "./$types";

const registerLimiter = createRateLimiter({ windowMs: 3_600_000, max: 5 });

export const load: PageServerLoad = (event) => {
  if (event.locals.user) redirect(302, "/account/orders");
};

export const actions: Actions = {
  register: async (event) => {
    if (!registerLimiter.allow(clientAddressKey(event))) {
      return fail(429, { message: "محاولات كثيرة، حاول لاحقًا" });
    }
    const form = Object.fromEntries(await event.request.formData());
    const name = typeof form.name === "string" ? form.name : "";
    const email = typeof form.email === "string" ? form.email : "";
    const password = typeof form.password === "string" ? form.password : "";
    if (!name.trim()) return fail(400, { message: "أدخل الاسم" });
    try {
      await auth.api.signUpEmail({ body: { name, email, password } });
    } catch (error) {
      if (error instanceof APIError)
        return fail(400, { message: "تعذر إنشاء الحساب، تحقق من البيانات" });
      return fail(500, { message: "حدث خطأ غير متوقع" });
    }
    redirect(302, "/account/orders");
  },
};
