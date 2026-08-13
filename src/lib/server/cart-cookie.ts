import { createHmac, timingSafeEqual } from "node:crypto";
import type { Cookies } from "@sveltejs/kit";
import type { CartLine } from "$lib/cart";

export const CART_COOKIE_NAME = "honey_cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function splitPayload(raw: string): { body: string; sig: string } {
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return { body: "", sig: "" };
  return { body: raw.slice(0, dot), sig: raw.slice(dot + 1) };
}

export function sanitizeCartLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { variantId, quantity } = entry as Record<string, unknown>;
    if (typeof variantId !== "string" || variantId.length === 0) return [];
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return [];
    return [{ variantId, quantity: Math.floor(quantity) }];
  });
}

export function signCartCookie(secret: string, lines: CartLine[]): string {
  const body = JSON.stringify(sanitizeCartLines(lines));
  return `${body}.${sign(secret, body)}`;
}

export function verifyCartCookie(raw: string): { ok: boolean } {
  const { body, sig } = splitPayload(raw);
  return { ok: body.length > 0 && sig.length > 0 };
}

export function readCartFromString(raw: string, secret: string): CartLine[] {
  const { body, sig } = splitPayload(raw);
  if (!body || !sig) return [];
  const expected = sign(secret, body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return [];
  try {
    return sanitizeCartLines(JSON.parse(body));
  } catch {
    return [];
  }
}

export function readCartCookie(cookies: Cookies, secret: string): CartLine[] {
  const raw = cookies.get(CART_COOKIE_NAME);
  if (!raw) return [];
  return readCartFromString(raw, secret);
}

export function setCartCookie(cookies: Cookies, secret: string, lines: CartLine[]): void {
  cookies.set(CART_COOKIE_NAME, signCartCookie(secret, lines), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearCartCookie(cookies: Cookies): void {
  cookies.delete(CART_COOKIE_NAME, { path: "/" });
}

export function getCartSecret(env: typeof import("$env/dynamic/private").env): string {
  return env.BETTER_AUTH_SECRET || env.ORIGIN || "dev-secret";
}
