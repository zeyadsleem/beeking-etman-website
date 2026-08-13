import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { getCartSecret, sanitizeCartLines, setCartCookie } from "$lib/server/cart-cookie";

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
