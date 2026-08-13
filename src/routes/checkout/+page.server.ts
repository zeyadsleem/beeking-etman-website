import { fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { clearCartCookie, getCartSecret, readCartCookie } from "$lib/server/cart-cookie";
import { checkoutSchema, formatZodErrors } from "$lib/server/checkout-schema";
import { createOrder } from "$lib/server/orders";
import { resolveCartItems } from "$lib/server/store";
import { computeTotals } from "$lib/cart";
import type { Actions, PageServerLoad } from "./$types";

const CARD_FIELDS = new Set(["cardNumber", "cardExpiry", "cardCvc"]);

export type CheckoutFail = {
  errors: Record<string, string>;
  values: Record<string, FormDataEntryValue>;
};

function shippingValues(
  form: Record<string, FormDataEntryValue>,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(Object.entries(form).filter(([key]) => !CARD_FIELDS.has(key)));
}

export const load: PageServerLoad = async ({ cookies }) => {
  const lines = readCartCookie(cookies, getCartSecret(env));
  if (lines.length === 0) redirect(302, "/cart");
  const items = await resolveCartItems(db, lines);
  if (items.length === 0) redirect(302, "/cart");
  return { items, totals: computeTotals(items) };
};

export const actions: Actions = {
  submit: async (event) => {
    const { request, cookies, locals } = event;
    const form = Object.fromEntries(await request.formData());
    const values = shippingValues(form);

    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      return fail(400, { errors: formatZodErrors(parsed.error), values } satisfies CheckoutFail);
    }

    const lines = readCartCookie(cookies, getCartSecret(env));
    if (lines.length === 0) {
      const errors: Record<string, string> = { cart: "سلتك فارغة" };
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
      locals.user?.id,
    );

    if (!result.ok) {
      const errors: Record<string, string> = { cart: result.message };
      return fail(409, { errors, values } satisfies CheckoutFail);
    }

    clearCartCookie(cookies);
    redirect(303, `/checkout/success/${result.orderId}`);
  },
};
