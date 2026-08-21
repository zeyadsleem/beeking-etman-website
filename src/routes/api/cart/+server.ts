import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { isBlendItem } from "$lib/cart";
import { getLang } from "$lib/server/lang";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { resolveCartItems } from "$lib/server/store";
import {
  getCartSecret,
  sanitizeCartLines,
  readCartCookie,
  setCartCookie,
} from "$lib/server/cart-cookie";

const CART_LIMIT = createDbRateLimiter(db, { windowMs: 60_000, max: 30 });

export const GET: RequestHandler = async (event) => {
  if (!(await CART_LIMIT.allow(`cart:${clientAddressKey(event)}`))) {
    return json({ items: [] }, { status: 429 });
  }
  const lines = readCartCookie(event.cookies, getCartSecret(env));
  const { items } = await resolveCartItems(db, lines, getLang(event));
  return json({
    items: items
      .map((i) =>
        isBlendItem(i)
          ? null
          : { variantId: i.variantId, name: i.name, variantName: i.variantName },
      )
      .filter((x): x is { variantId: string; name: string; variantName: string } => x !== null),
  });
};

export const POST: RequestHandler = async (event) => {
  if (!(await CART_LIMIT.allow(`cart:${clientAddressKey(event)}`))) {
    return json({ ok: false }, { status: 429 });
  }
  let body: unknown = null;
  try {
    body = await event.request.json();
  } catch {
    body = null;
  }
  const items = (body as { items?: unknown } | null)?.items;
  setCartCookie(event.cookies, getCartSecret(env), sanitizeCartLines(items));
  return json({ ok: true });
};
