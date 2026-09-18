import { describe, expect, it } from "vite-plus/test";
import { checkoutSchema, formatZodErrors } from "./checkout-schema";

const base = {
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  city: "القاهرة",
  address: "شارع 9",
  governorate: "cairo",
  paymentMethod: "cod",
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
  it("accepts the supported methods and rejects anything else", () => {
    for (const paymentMethod of ["cod", "instapay", "wallet"]) {
      expect(checkoutSchema.safeParse({ ...base, paymentMethod }).success).toBe(true);
    }
    expect(checkoutSchema.safeParse({ ...base, paymentMethod: "paymob" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, paymentMethod: "bogus" }).success).toBe(false);
  });

  it("requires a payment method", () => {
    const { paymentMethod: _omitted, ...withoutMethod } = base;
    expect(checkoutSchema.safeParse(withoutMethod).success).toBe(false);
  });

  it("does not echo removed fields into the parsed data", () => {
    const result = checkoutSchema.safeParse({ ...base, cardNumber: "4242424242424242" });
    if (!result.success) return;
    expect(result.data).not.toHaveProperty("cardNumber");
  });
});

describe("checkoutSchema field bounds", () => {
  it("rejects an oversized address", () => {
    const result = checkoutSchema.safeParse({ ...base, address: "ا".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects an oversized name", () => {
    const result = checkoutSchema.safeParse({ ...base, name: "ا".repeat(81) });
    expect(result.success).toBe(false);
  });

  it("rejects an oversized city", () => {
    const result = checkoutSchema.safeParse({ ...base, city: "ا".repeat(61) });
    expect(result.success).toBe(false);
  });

  it("rejects an oversized email", () => {
    const result = checkoutSchema.safeParse({
      ...base,
      email: `${"a".repeat(250)}@example.com`,
    });
    expect(result.success).toBe(false);
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
