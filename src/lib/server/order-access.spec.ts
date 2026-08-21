import { describe, expect, it } from "vite-plus/test";
import {
  ORDER_ACCESS_COOKIE_NAME,
  readOrderAccessCookie,
  signOrderToken,
  verifyOrderToken,
} from "./order-access";

const SECRET = "test-secret-for-order-access-signing";
const ORDER_ID = "0b8f9d3e-6a2c-4f1e-9c7d-5a1b2c3d4e5f";

describe("order-access tokens", () => {
  it("round-trips a signed token for its order", async () => {
    const token = await signOrderToken(ORDER_ID, SECRET);
    expect(await verifyOrderToken(token, ORDER_ID, SECRET)).toBe(true);
  });

  it("uses the orderId.hexHmac format", async () => {
    const token = await signOrderToken(ORDER_ID, SECRET);
    expect(token).toMatch(new RegExp(`^${ORDER_ID}\\.[0-9a-f]{64}$`));
  });

  it("rejects a token presented for a different order", async () => {
    const token = await signOrderToken(ORDER_ID, SECRET);
    expect(await verifyOrderToken(token, "other-order-id", SECRET)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const [orderId] = (await signOrderToken(ORDER_ID, SECRET)).split(".");
    const forged = `${orderId}.${"0".repeat(64)}`;
    expect(await verifyOrderToken(forged, ORDER_ID, SECRET)).toBe(false);
  });

  it("rejects a mismatched secret", async () => {
    const token = await signOrderToken(ORDER_ID, SECRET);
    expect(await verifyOrderToken(token, ORDER_ID, "other-secret")).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyOrderToken("", ORDER_ID, SECRET)).toBe(false);
    expect(await verifyOrderToken("no-dot", ORDER_ID, SECRET)).toBe(false);
    expect(await verifyOrderToken(`${ORDER_ID}.`, ORDER_ID, SECRET)).toBe(false);
    expect(await verifyOrderToken(".abc", ORDER_ID, SECRET)).toBe(false);
    expect(await verifyOrderToken(`${ORDER_ID}.abc.def`, ORDER_ID, SECRET)).toBe(false);
    expect(await verifyOrderToken(`${ORDER_ID}.abc.trailing`, ORDER_ID, SECRET)).toBe(false);
  });
});

describe("order-access cookie", () => {
  function cookiesWith(raw: string | undefined): { get: (name: string) => string | undefined } {
    return { get: (name: string) => (name === ORDER_ACCESS_COOKIE_NAME ? raw : undefined) };
  }

  it("grants access when the cookie matches the order", async () => {
    const raw = await signOrderToken(ORDER_ID, SECRET);
    expect(await readOrderAccessCookie(cookiesWith(raw), ORDER_ID, SECRET)).toBe(true);
  });

  it("denies access without a cookie or for another order", async () => {
    expect(await readOrderAccessCookie(cookiesWith(undefined), ORDER_ID, SECRET)).toBe(false);
    const raw = await signOrderToken(ORDER_ID, SECRET);
    expect(await readOrderAccessCookie(cookiesWith(raw), "other-order-id", SECRET)).toBe(false);
  });
});
