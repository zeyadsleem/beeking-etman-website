import { fail, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import {
  createAddress,
  deleteAddress,
  formatZodErrors,
  addressSchema,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "$lib/server/addresses";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { getLang } from "$lib/server/lang";
import { loginRedirectPath } from "$lib/server/login-redirect";
import { t } from "$lib/i18n/messages";
import type { Actions, PageServerLoad } from "./$types";

const mutationLimiter = createDbRateLimiter(db, { windowMs: 60_000, max: 30 });

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user) redirect(302, loginRedirectPath(event.url));
  return {
    lang: getLang(event),
    addresses: await listAddresses(db, event.locals.user.id),
  };
};

type FieldErrors = Record<string, string>;

export const actions: Actions = {
  create: async (event) => {
    const lang = getLang(event);
    if (!event.locals.user) redirect(302, "/login");
    if (!(await mutationLimiter.allow(`addr:${clientAddressKey(event)}`))) {
      return fail(429, {
        errors: { label: t(lang, "errors.tooManyAttempts") },
        values: {} satisfies Record<string, string>,
      });
    }
    const form = Object.fromEntries(await event.request.formData());
    const parsed = addressSchema(lang).safeParse(form);
    if (!parsed.success) {
      return fail(400, { errors: formatZodErrors(parsed.error), values: form } satisfies {
        errors: FieldErrors;
        values: Record<string, FormDataEntryValue>;
      });
    }
    const result = await createAddress(db, event.locals.user.id, parsed.data);
    if (!result.ok) {
      return fail(result.error === "limit_reached" ? 409 : 400, {
        errors: {
          label: t(
            lang,
            result.error === "limit_reached" ? "addresses.limitReached" : "errors.unexpected",
          ),
        },
        values: form,
      } satisfies { errors: FieldErrors; values: Record<string, FormDataEntryValue> });
    }
    return { saved: true };
  },

  update: async (event) => {
    const lang = getLang(event);
    if (!event.locals.user) redirect(302, "/login");
    if (!(await mutationLimiter.allow(`addr:${clientAddressKey(event)}`))) {
      return fail(429, {
        errors: { label: t(lang, "errors.tooManyAttempts") },
        values: {} satisfies Record<string, string>,
      });
    }
    const form = Object.fromEntries(await event.request.formData());
    const id = typeof form.id === "string" ? form.id : "";
    const parsed = addressSchema(lang).safeParse(form);
    if (!parsed.success) {
      return fail(400, { errors: formatZodErrors(parsed.error), values: form } satisfies {
        errors: FieldErrors;
        values: Record<string, FormDataEntryValue>;
      });
    }
    const result = await updateAddress(db, event.locals.user.id, id, parsed.data);
    if (!result.ok)
      return fail(404, { errors: { label: t(lang, "addresses.notFound") }, values: form });
    return { saved: true };
  },

  setDefault: async (event) => {
    const lang = getLang(event);
    if (!event.locals.user) redirect(302, "/login");
    if (!(await mutationLimiter.allow(`addr:${clientAddressKey(event)}`))) {
      return fail(429, {
        errors: { label: t(lang, "errors.tooManyAttempts") },
        values: {} satisfies Record<string, string>,
      });
    }
    const form = Object.fromEntries(await event.request.formData());
    const id = typeof form.id === "string" ? form.id : "";
    const result = await setDefaultAddress(db, event.locals.user.id, id);
    if (!result.ok) return fail(404, { errors: { label: t(lang, "addresses.notFound") } });
    return { saved: true };
  },

  delete: async (event) => {
    const lang = getLang(event);
    if (!event.locals.user) redirect(302, "/login");
    if (!(await mutationLimiter.allow(`addr:${clientAddressKey(event)}`))) {
      return fail(429, {
        errors: { label: t(lang, "errors.tooManyAttempts") },
        values: {} satisfies Record<string, string>,
      });
    }
    const form = Object.fromEntries(await event.request.formData());
    const id = typeof form.id === "string" ? form.id : "";
    const result = await deleteAddress(db, event.locals.user.id, id);
    if (!result.ok) return fail(404, { errors: { label: t(lang, "addresses.notFound") } });
    return { saved: true };
  },
};
