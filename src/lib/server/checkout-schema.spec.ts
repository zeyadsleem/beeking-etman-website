import { describe, expect, it } from "vite-plus/test";
import { checkoutSchema, formatZodErrors } from "./checkout-schema";

const base = {
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  city: "القاهرة",
  address: "شارع 9",
  cardNumber: "4242424242424242",
  cardCvc: "123",
  nonce: crypto.randomUUID(),
};

function expiryFor(monthsFromNow: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear() % 100).padStart(2, "0");
  return `${month}/${year}`;
}

// Last day of the previous month, computed without any day-of-month overflow
// (new Date(y, m, 0) is always valid), so the test never crosses into the
// current month on the 31st.
function lastMonthExpiry(): string {
  const now = new Date();
  const lastDayOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const month = String(lastDayOfPreviousMonth.getMonth() + 1).padStart(2, "0");
  const year = String(lastDayOfPreviousMonth.getFullYear() % 100).padStart(2, "0");
  return `${month}/${year}`;
}

describe("checkoutSchema nonce", () => {
  it("accepts a valid uuid nonce", () => {
    expect(checkoutSchema.safeParse({ ...base, cardExpiry: expiryFor(6) }).success).toBe(true);
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
      cardNumber: base.cardNumber,
      cardExpiry: expiryFor(6),
      cardCvc: base.cardCvc,
    });
    expect(result.success).toBe(false);
  });
});

describe("checkoutSchema card expiry", () => {
  it("accepts a card valid through the current month", () => {
    const now = new Date();
    const expiry = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear() % 100).padStart(2, "0")}`;
    expect(checkoutSchema.safeParse({ ...base, cardExpiry: expiry }).success).toBe(true);
  });

  it("accepts a future expiry", () => {
    expect(checkoutSchema.safeParse({ ...base, cardExpiry: expiryFor(12) }).success).toBe(true);
  });

  it("rejects an expired card", () => {
    const result = checkoutSchema.safeParse({ ...base, cardExpiry: expiryFor(-12) });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid format", () => {
    expect(checkoutSchema.safeParse({ ...base, cardExpiry: "13/29" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, cardExpiry: "08" }).success).toBe(false);
  });

  it("rejects a card that expired last month", () => {
    expect(checkoutSchema.safeParse({ ...base, cardExpiry: lastMonthExpiry() }).success).toBe(
      false,
    );
  });

  it("surfaces the expiry message for an expired card", () => {
    const result = checkoutSchema.safeParse({ ...base, cardExpiry: expiryFor(-12) });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatZodErrors(result.error).cardExpiry).toBe("انتهت صلاحية البطاقة");
  });

  it("surfaces the format message, not the expiry one, for a malformed date", () => {
    const result = checkoutSchema.safeParse({ ...base, cardExpiry: "13/29" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatZodErrors(result.error).cardExpiry).toBe("التاريخ بصيغة MM/YY");
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
