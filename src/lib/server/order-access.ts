import { dev } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";

// Guest order access: a per-order HMAC capability token stored in an
// HttpOnly cookie set at checkout completion. The success page grants
// access only to the owning user or a bearer of this token, so guest
// delivery details cannot be reached by guessing order URLs.
export const ORDER_ACCESS_COOKIE_NAME = "honey_order_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signOrderToken(orderId: string, secret: string): Promise<string> {
  return `${orderId}.${await hmac(secret, orderId)}`;
}

export async function verifyOrderToken(
  token: string,
  orderId: string,
  secret: string,
): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  if (token.slice(0, dot) !== orderId) return false;
  return constantTimeEqual(token.slice(dot + 1), await hmac(secret, orderId));
}

export async function setOrderAccessCookie(
  cookies: Cookies,
  orderId: string,
  secret: string,
): Promise<void> {
  cookies.set(ORDER_ACCESS_COOKIE_NAME, await signOrderToken(orderId, secret), {
    path: "/checkout/success",
    httpOnly: true,
    sameSite: "lax",
    secure: !dev,
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function readOrderAccessCookie(
  cookies: Pick<Cookies, "get">,
  orderId: string,
  secret: string,
): Promise<boolean> {
  const raw = cookies.get(ORDER_ACCESS_COOKIE_NAME);
  if (!raw) return false;
  return verifyOrderToken(raw, orderId, secret);
}

export function getOrderAccessSecret(env: typeof import("$env/dynamic/private").env): string {
  if (env.ORDER_ACCESS_SECRET) return env.ORDER_ACCESS_SECRET;
  if (dev) return "dev-order-access-signing-secret";
  throw new Error("ORDER_ACCESS_SECRET is required to sign the order access cookie");
}
