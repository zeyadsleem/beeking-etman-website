import { fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { clearCartCookie, getCartSecret, readCartCookie } from "$lib/server/cart-cookie";
import { getOrderAccessSecret, setOrderAccessCookie } from "$lib/server/order-access";
import { createCheckoutSchema, formatZodErrors } from "$lib/server/checkout-schema";
import { createAddress, listAddressSummaries } from "$lib/server/addresses";
import { createOrder } from "$lib/server/orders";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { resolveCartItems } from "$lib/server/store";
import { computeTotals } from "$lib/cart";
import { t } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";
import { sendOrderConfirmation } from "$lib/server/email";
import type { Actions, PageServerLoad } from "./$types";

const CHECKOUT_LIMIT = createDbRateLimiter(db, { windowMs: 60_000, max: 10 });

export type CheckoutFail = {
  errors: Record<string, string>;
  values: Record<string, FormDataEntryValue>;
};

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const nonce = crypto.randomUUID();
  const lines = readCartCookie(event.cookies, getCartSecret(env));
  if (lines.length === 0) redirect(302, "/cart");
  const { items, missing } = await resolveCartItems(db, lines, lang);
  if (items.length === 0) redirect(302, "/cart");
  let savedAddresses: Awaited<ReturnType<typeof listAddressSummaries>> = [];
  if (event.locals.user) {
    savedAddresses = await listAddressSummaries(db, event.locals.user.id);
  }
  return {
    nonce,
    items,
    missingVariantIds: missing,
    totals: computeTotals(items),
    savedAddresses,
    isLoggedIn: Boolean(event.locals.user),
  };
};

export const actions: Actions = {
  submit: async (event) => {
    const { request, cookies, locals } = event;
    const lang = getLang(event);
    const form = Object.fromEntries(await request.formData());

    if (!(await CHECKOUT_LIMIT.allow(`checkout:${clientAddressKey(event)}`))) {
      const errors: Record<string, string> = { cart: t(lang, "errors.tooManyAttempts") };
      return fail(429, { errors, values: form } satisfies CheckoutFail);
    }

    const parsed = createCheckoutSchema(lang).safeParse(form);
    if (!parsed.success) {
      return fail(400, {
        errors: formatZodErrors(parsed.error),
        values: form,
      } satisfies CheckoutFail);
    }

    const lines = readCartCookie(cookies, getCartSecret(env));
    if (lines.length === 0) {
      const errors: Record<string, string> = { cart: t(lang, "checkout.cartEmpty") };
      return fail(400, { errors, values: form } satisfies CheckoutFail);
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
      return fail(409, { errors, values: form } satisfies CheckoutFail);
    }

    await setOrderAccessCookie(cookies, result.orderId, getOrderAccessSecret(env));
    clearCartCookie(cookies);
    if (locals.user && form.saveAddress === "on") {
      // Best-effort only: a thrown DB error here must never surface as a
      // failed request — the order already exists and the cart is cleared,
      // so an error page would invite a duplicate-order retry. The redirect
      // deliberately stays outside the try so it always propagates.
      try {
        const saved = await createAddress(db, locals.user.id, {
          label: `${parsed.data.city} — ${parsed.data.name}`.slice(0, 40),
          name: parsed.data.name,
          phone: parsed.data.phone,
          address: parsed.data.address,
          city: parsed.data.city,
        });
        if (!saved.ok) console.error("post-checkout address save failed:", saved.error);
      } catch (cause) {
        console.error("post-checkout address save failed:", cause);
      }
    }

    // Best-effort order confirmation email — never block the redirect.
    try {
      await sendOrderConfirmation(event.platform, db, result.orderId);
    } catch (e) {
      console.error("[checkout] order confirmation email failed", e);
    }

    redirect(303, `/checkout/success/${result.orderId}`);
  },
};
