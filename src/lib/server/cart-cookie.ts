import { createHmac, timingSafeEqual } from "node:crypto";
import { dev } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";
import { isAdditiveKey } from "$lib/blends";
import type { BlendLineAdditive, CartEntry, CartLine } from "$lib/cart";

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

function sanitizeRegularLine(entry: Record<string, unknown>): CartLine[] {
  const { variantId, quantity } = entry;
  if (typeof variantId !== "string" || variantId.length === 0) return [];
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return [];
  return [{ variantId, quantity: Math.floor(quantity) }];
}

function sanitizeBlendLine(entry: Record<string, unknown>): CartEntry[] {
  const { id, baseVariantId, jarSize, additives } = entry;
  if (typeof id !== "string" || id.length === 0) return [];
  if (typeof baseVariantId !== "string" || baseVariantId.length === 0) return [];
  if (jarSize !== "half" && jarSize !== "full") return [];
  if (!Array.isArray(additives)) return [];
  const cleaned = additives.flatMap((raw): BlendLineAdditive[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const { key, variantId, qty } = raw as Record<string, unknown>;
    if (!isAdditiveKey(key)) return [];
    if (typeof variantId !== "string" || variantId.length === 0) return [];
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) return [];
    return [{ key, variantId, qty: Math.floor(qty) }];
  });
  return [{ kind: "blend", id, baseVariantId, jarSize, additives: cleaned }];
}

export function sanitizeCartLines(input: unknown): CartEntry[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    if (record.kind === "blend") return sanitizeBlendLine(record);
    return sanitizeRegularLine(record);
  });
}

export function signCartCookie(secret: string, lines: CartEntry[]): string {
  const body = JSON.stringify(sanitizeCartLines(lines));
  return `${body}.${sign(secret, body)}`;
}

export function verifyCartCookie(raw: string): { ok: boolean } {
  const { body, sig } = splitPayload(raw);
  return { ok: body.length > 0 && sig.length > 0 };
}

export function readCartFromString(raw: string, secret: string): CartEntry[] {
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

export function readCartCookie(cookies: Cookies, secret: string): CartEntry[] {
  const raw = cookies.get(CART_COOKIE_NAME);
  if (!raw) return [];
  return readCartFromString(raw, secret);
}

export function setCartCookie(cookies: Cookies, secret: string, lines: CartEntry[]): void {
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
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (dev) return "dev-cart-signing-secret";
  throw new Error("BETTER_AUTH_SECRET is required to sign the cart cookie");
}
