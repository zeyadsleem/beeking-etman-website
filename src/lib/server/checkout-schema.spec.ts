import { describe, expect, it } from "vite-plus/test";
import { checkoutSchema, formatZodErrors } from "./checkout-schema";

const base = {
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  city: "القاهرة",
  address: "شارع 9",
  nonce: crypto.randomUUID(),
};

describe("checkoutSchema nonce", () => {
  it("accepts a valid uuid nonce", () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a non-uuid nonce", () => {
    const result = checkoutSchema.safeParse({ ...base, nonce: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing nonce", () => {
    const result = checkoutSchema.safeParse({
      email: base.email,
      name: base.name,
      phone: base.phone,
      city: base.city,
      address: base.address,
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutSchema payment fields", () => {
  it("no longer requires card fields (payment is simulated)", () => {
    expect(
      checkoutSchema.safeParse({
        ...base,
        cardNumber: "4242424242424242",
        cardExpiry: "08/28",
        cardCvc: "123",
      }).success,
    ).toBe(true);
  });

  it("does not echo removed fields into the parsed data", () => {
    const result = checkoutSchema.safeParse({ ...base, cardNumber: "4242424242424242" });
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("cardNumber");
  });
});

describe("formatZodErrors nonce", () => {
  it("surfaces the nonce message when the nonce is not a UUID", () => {
    const result = checkoutSchema.safeParse({ ...base, nonce: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatZodErrors(result.error).nonce).toBe("انتهت صلاحية النموذج، أعد تحميل الصفحة");
  });
});
