import { fail, redirect } from "@sveltejs/kit";
import { inArray } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { readCartCookie, clearCartCookie } from "$lib/server/cart-cookie";
import { checkoutSchema, formatZodErrors } from "$lib/server/checkout-schema";
import { createOrder } from "$lib/server/orders";
import { linesToItems, computeTotals } from "$lib/cart";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  const lines = readCartCookie(cookies, env.BETTER_AUTH_SECRET || env.ORIGIN || "dev-secret");
  if (lines.length === 0) redirect(302, "/cart");
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await db.select().from(schema.product).where(inArray(schema.product.id, ids));
  const catalog = products.map((p) => ({
    productId: p.id,
    name: p.name,
    slug: p.slug,
    image: p.image,
    price: p.price,
    stock: p.stock,
  }));
  const items = linesToItems(lines, catalog);
  return { items, totals: computeTotals(items) };
};

export const actions: Actions = {
  submit: async (event) => {
    const { request, cookies, locals } = event;
    const form = Object.fromEntries(await request.formData());

    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      return fail(400, { errors: formatZodErrors(parsed.error), values: form });
    }

    const lines = readCartCookie(cookies, env.BETTER_AUTH_SECRET || env.ORIGIN || "dev-secret");
    if (lines.length === 0) {
      return fail(400, { errors: { cart: "سلتك فارغة" }, values: form });
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
      return fail(409, { errors: { cart: result.message }, values: form });
    }

    clearCartCookie(cookies);
    redirect(303, `/checkout/success/${result.orderId}`);
  },
};
