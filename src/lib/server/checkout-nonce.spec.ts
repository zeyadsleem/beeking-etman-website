import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Cookies } from "@sveltejs/kit";
import { issueCheckoutNonce, verifyCheckoutNonce } from "./checkout-nonce";
import { signOrderToken, verifyOrderToken } from "./order-access";

function cookieJar() {
  const values = new Map<string, string>();
  const cookies = {
    get: (name: string) => values.get(name),
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    delete: (name: string) => {
      values.delete(name);
    },
    set: vi.fn<Cookies["set"]>((name, value) => {
      values.set(name, value);
    }),
  };
  return { cookies, values };
}

afterEach(() => vi.useRealTimers());

describe("checkout nonce cookies", () => {
  it("bounds cookie growth while preserving recent checkout tabs", async () => {
    const { cookies, values } = cookieJar();
    const first = await issueCheckoutNonce(cookies, "secret");
    for (let i = 0; i < 10; i++) await issueCheckoutNonce(cookies, "secret");
    expect(values.size).toBeLessThanOrEqual(8);
    expect(await verifyCheckoutNonce(cookies, first, "secret")).toBe(false);
  });
  it("keeps independent HttpOnly proofs for tabs and retries", async () => {
    const { cookies } = cookieJar();
    const first = await issueCheckoutNonce(cookies, "secret");
    const second = await issueCheckoutNonce(cookies, "secret");
    expect(first).not.toBe(second);
    for (const nonce of [first, second, first]) {
      expect(await verifyCheckoutNonce(cookies, nonce, "secret")).toBe(true);
    }
    expect(cookies.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/checkout",
        maxAge: expect.any(Number),
      }),
    );
  });

  it("rejects absent, copied, malformed, tampered and wrong-secret proofs", async () => {
    const { cookies, values } = cookieJar();
    const nonce = await issueCheckoutNonce(cookies, "secret");
    expect(await verifyCheckoutNonce(cookieJar().cookies, nonce, "secret")).toBe(false);
    expect(await verifyCheckoutNonce(cookies, crypto.randomUUID(), "secret")).toBe(false);
    expect(await verifyCheckoutNonce(cookies, nonce, "other-secret")).toBe(false);
    const [name, token] = [...values][0];
    for (const raw of ["", "invalid", `${token}0`, token.replace(nonce, crypto.randomUUID())]) {
      values.set(name, raw);
      expect(await verifyCheckoutNonce(cookies, nonce, "secret")).toBe(false);
    }
  });

  it("enforces signed expiry even if the browser retains the cookie", async () => {
    vi.useFakeTimers();
    const { cookies } = cookieJar();
    const nonce = await issueCheckoutNonce(cookies, "secret");
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(await verifyCheckoutNonce(cookies, nonce, "secret")).toBe(false);
  });

  it("accepts a checkout proof issued under the legacy cookie prefix", async () => {
    const { cookies, values } = cookieJar();
    const nonce = crypto.randomUUID();
    const expires = Date.now() + 60 * 60 * 1000;
    values.set(
      `honey_checkout_${nonce}`,
      await signOrderToken(`checkout:${nonce}:${expires}`, "secret"),
    );
    expect(await verifyCheckoutNonce(cookies, nonce, "secret")).toBe(true);
  });

  it("does not interchange checkout proofs and order access tokens", async () => {
    const { cookies, values } = cookieJar();
    const nonce = await issueCheckoutNonce(cookies, "secret");
    const [name, token] = [...values][0];
    expect(await verifyOrderToken(token, nonce, "secret")).toBe(false);
    values.set(name, await signOrderToken(nonce, "secret"));
    expect(await verifyCheckoutNonce(cookies, nonce, "secret")).toBe(false);
  });
});
