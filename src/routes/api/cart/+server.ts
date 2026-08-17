import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import { resolveCartItems } from "$lib/server/store";
import {
  getCartSecret,
  sanitizeCartLines,
  readCartCookie,
  setCartCookie,
} from "$lib/server/cart-cookie";

export const GET: RequestHandler = async (event) => {
  const lines = readCartCookie(event.cookies, getCartSecret(env));
  const { items } = await resolveCartItems(db, lines, getLang(event));
  return json({
    items: items.map((i) => ({ variantId: i.variantId, name: i.name, variantName: i.variantName })),
  });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const items = (body as { items?: unknown } | null)?.items;
  setCartCookie(cookies, getCartSecret(env), sanitizeCartLines(items));
  return json({ ok: true });
};
