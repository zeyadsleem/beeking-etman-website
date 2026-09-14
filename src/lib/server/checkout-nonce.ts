import { dev } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";
import { signOrderToken, verifyOrderToken } from "./order-access";

const COOKIE_PREFIX = "beeking_checkout_";
// Pre-rename prefix, still accepted so checkout tabs opened just before the
// rename can submit (nonces live one hour).
const LEGACY_COOKIE_PREFIX = "honey_checkout_";
const MAX_AGE = 60 * 60;

export async function issueCheckoutNonce(
  cookies: Pick<Cookies, "set" | "getAll" | "delete">,
  secret: string,
): Promise<string> {
  const existing = cookies
    .getAll()
    .filter(({ name }) => name.startsWith(COOKIE_PREFIX) || name.startsWith(LEGACY_COOKIE_PREFIX));
  for (const { name } of existing.slice(0, Math.max(0, existing.length - 7))) {
    cookies.delete(name, { path: "/checkout" });
  }
  const nonce = crypto.randomUUID();
  const expires = Date.now() + MAX_AGE * 1000;
  cookies.set(COOKIE_PREFIX + nonce, await signOrderToken(`checkout:${nonce}:${expires}`, secret), {
    path: "/checkout",
    httpOnly: true,
    sameSite: "lax",
    secure: !dev,
    maxAge: MAX_AGE,
  });
  return nonce;
}

export async function verifyCheckoutNonce(
  cookies: Pick<Cookies, "get">,
  nonce: string,
  secret: string,
): Promise<boolean> {
  const token = cookies.get(COOKIE_PREFIX + nonce) ?? cookies.get(LEGACY_COOKIE_PREFIX + nonce);
  if (!token) return false;
  const body = token.split(".")[0];
  const expires = Number(body.split(":")[2]);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) return false;
  return verifyOrderToken(token, `checkout:${nonce}:${expires}`, secret);
}
