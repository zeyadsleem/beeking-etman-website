import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { sanitizeCartLines, setCartCookie } from "$lib/server/cart-cookie";

export const POST: RequestHandler = async ({ request, cookies }) => {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const items = (body as { items?: unknown } | null)?.items;
  const secret = env.BETTER_AUTH_SECRET || env.ORIGIN || "dev-secret";
  setCartCookie(cookies, secret, sanitizeCartLines(items));
  return json({ ok: true });
};
