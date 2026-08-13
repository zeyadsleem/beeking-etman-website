import { describe, expect, it } from "vite-plus/test";
import { parse, serialize } from "cookie";
import { readCartFromString, signCartCookie, verifyCartCookie } from "./cart-cookie";

const SECRET = "test-secret-for-cookie-signing";

function headerFor(lines: Array<{ variantId: string; quantity: number }>): string {
  return parse(serialize("honey_cart", signCartCookie(SECRET, lines))).honey_cart ?? "";
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
  it("verify only checks format", () => {
    expect(verifyCartCookie("a.b").ok).toBe(true);
    expect(verifyCartCookie("no-dot").ok).toBe(false);
  });
});
