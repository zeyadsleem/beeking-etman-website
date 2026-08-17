import { fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { clearCartCookie, getCartSecret, readCartCookie } from "$lib/server/cart-cookie";
import { createCheckoutSchema, formatZodErrors } from "$lib/server/checkout-schema";
import { createOrder } from "$lib/server/orders";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { resolveCartItems } from "$lib/server/store";
import { computeTotals } from "$lib/cart";
import { t } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";
import type { Actions, PageServerLoad } from "./$types";

const CARD_FIELDS = new Set(["cardNumber", "cardExpiry", "cardCvc"]);
const CHECKOUT_LIMIT = createDbRateLimiter(db, { windowMs: 60_000, max: 10 });

export type CheckoutFail = {
  errors: Record<string, string>;
  values: Record<string, FormDataEntryValue>;
};

function shippingValues(
  form: Record<string, FormDataEntryValue>,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(Object.entries(form).filter(([key]) => !CARD_FIELDS.has(key)));
}

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const nonce = crypto.randomUUID();
  const lines = readCartCookie(event.cookies, getCartSecret(env));
  if (lines.length === 0) redirect(302, "/cart");
  const { items, missing } = await resolveCartItems(db, lines, lang);
  if (items.length === 0) redirect(302, "/cart");
  return { nonce, items, missingVariantIds: missing, totals: computeTotals(items) };
};

export const actions: Actions = {
  submit: async (event) => {
    const { request, cookies, locals } = event;
    const lang = getLang(event);
    const form = Object.fromEntries(await request.formData());
    const values = shippingValues(form);

    if (!(await CHECKOUT_LIMIT.allow(`checkout:${clientAddressKey(event)}`))) {
      const errors: Record<string, string> = { cart: t(lang, "errors.tooManyAttempts") };
      return fail(429, { errors, values } satisfies CheckoutFail);
    }

    const parsed = createCheckoutSchema(lang).safeParse(form);
    if (!parsed.success) {
      return fail(400, { errors: formatZodErrors(parsed.error), values } satisfies CheckoutFail);
    }

    const lines = readCartCookie(cookies, getCartSecret(env));
    if (lines.length === 0) {
      const errors: Record<string, string> = { cart: t(lang, "checkout.cartEmpty") };
      return fail(400, { errors, values } satisfies CheckoutFail);
    }

    const result = await createOrder(
      db,
      lines,
      {
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        address: parsed.data.address,
        city: parsed.data.city,
      },
      parsed.data.nonce,
      locals.user?.id,
      lang,
    );

    if (!result.ok) {
      const errors: Record<string, string> = { cart: result.message };
      return fail(409, { errors, values } satisfies CheckoutFail);
    }

    clearCartCookie(cookies);
    redirect(303, `/checkout/success/${result.orderId}`);
  },
};
