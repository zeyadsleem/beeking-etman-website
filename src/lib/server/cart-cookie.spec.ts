import { describe, expect, it, vi } from "vite-plus/test";
import { parse, serialize } from "cookie";
import type { Cookies } from "@sveltejs/kit";
import type { CartLine } from "$lib/cart";
import {
  CART_COOKIE_NAME,
  clearCartCookie,
  readCartCookie,
  readCartFromString,
  sanitizeCartLines,
  setCartCookie,
  signCartCookie,
} from "./cart-cookie";

const SECRET = "test-secret-for-cookie-signing";

function headerFor(lines: CartLine[]): string {
  return parse(serialize(CART_COOKIE_NAME, signCartCookie(SECRET, lines)))[CART_COOKIE_NAME] ?? "";
}

describe("cart-cookie", () => {
  it("round-trips valid lines", () => {
    expect(readCartFromString(headerFor([{ variantId: "v1", quantity: 2 }]), SECRET)).toEqual([
      { variantId: "v1", quantity: 2 },
    ]);
  });
  it("rejects a tampered payload", () => {
    const [payload] = headerFor([{ variantId: "v1", quantity: 2 }]).split(".");
    expect(readCartFromString(`${payload}.Zm9v`, SECRET)).toEqual([]);
  });
  it("rejects a mismatched secret", () => {
    expect(
      readCartFromString(
        signCartCookie(SECRET, [{ variantId: "v1", quantity: 1 }]),
        "other-secret",
      ),
    ).toEqual([]);
  });
  it("sanitizes out malformed entries", () => {
    expect(signCartCookie(SECRET, [{ variantId: "", quantity: 0 }])).toContain("[]");
  });
  it("drops junk on read", () => {
    expect(readCartFromString("garbage", SECRET)).toEqual([]);
  });
  it("drops a legacy blend entry and keeps the regular line", () => {
    expect(
      sanitizeCartLines([
        { kind: "blend", id: "blend-1", baseVariantId: "b1", jarSize: "half", additives: [] },
        { variantId: "v1", quantity: 2 },
      ]),
    ).toEqual([{ variantId: "v1", quantity: 2 }]);
  });
});

describe("cart-cookie rename compatibility", () => {
  const LEGACY_NAME = "honey_cart";

  function fakeCookies(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
      cookies: {
        get: (name: string) => values.get(name),
        set: vi.fn((name: string, value: string) => {
          values.set(name, value);
        }),
        delete: vi.fn((name: string) => {
          values.delete(name);
        }),
      } as unknown as Cookies,
      values,
    };
  }

  it("reads a cart stored under the legacy cookie name", () => {
    const { cookies } = fakeCookies({
      [LEGACY_NAME]: signCartCookie(SECRET, [{ variantId: "v1", quantity: 2 }]),
    });
    expect(readCartCookie(cookies, SECRET)).toEqual([{ variantId: "v1", quantity: 2 }]);
  });

  it("prefers the new cookie name when both are present", () => {
    const { cookies } = fakeCookies({
      [CART_COOKIE_NAME]: signCartCookie(SECRET, [{ variantId: "new", quantity: 2 }]),
      [LEGACY_NAME]: signCartCookie(SECRET, [{ variantId: "old", quantity: 1 }]),
    });
    expect(readCartCookie(cookies, SECRET)).toEqual([{ variantId: "new", quantity: 2 }]);
  });

  it("writes the new name and retires the legacy one on set", () => {
    const { cookies } = fakeCookies();
    setCartCookie(cookies, SECRET, [{ variantId: "v1", quantity: 1 }]);
    expect(cookies.set).toHaveBeenCalledWith(
      CART_COOKIE_NAME,
      expect.any(String),
      expect.any(Object),
    );
    expect(cookies.delete).toHaveBeenCalledWith(LEGACY_NAME, { path: "/" });
  });

  it("clears both names", () => {
    const { cookies } = fakeCookies();
    clearCartCookie(cookies);
    expect(cookies.delete).toHaveBeenCalledWith(CART_COOKIE_NAME, { path: "/" });
    expect(cookies.delete).toHaveBeenCalledWith(LEGACY_NAME, { path: "/" });
  });
});
