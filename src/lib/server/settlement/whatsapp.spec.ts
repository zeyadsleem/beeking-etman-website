import { describe, expect, it } from "vite-plus/test";
import { t } from "$lib/i18n/messages";
import {
  adminOrderWhatsappText,
  customerOrderWhatsappText,
  normalizeWhatsappNumber,
  whatsappLink,
} from "./whatsapp";

describe("normalizeWhatsappNumber", () => {
  it("converts international and Egyptian local forms to digits", () => {
    expect(normalizeWhatsappNumber("+20 100 000 0000")).toBe("201000000000");
    expect(normalizeWhatsappNumber("00201000000000")).toBe("201000000000");
    expect(normalizeWhatsappNumber("0100-000-0000")).toBe("201000000000");
    expect(normalizeWhatsappNumber("01112345678")).toBe("201112345678");
  });

  it("rejects implausible or missing values", () => {
    expect(normalizeWhatsappNumber("12345678")).toBeNull();
    expect(normalizeWhatsappNumber("123")).toBeNull();
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber(undefined)).toBeNull();
    expect(normalizeWhatsappNumber("1".repeat(20))).toBeNull();
  });

  it("rejects 0-leading values that are not Egyptian mobiles", () => {
    expect(normalizeWhatsappNumber("0123456789")).toBeNull();
    expect(normalizeWhatsappNumber("011234567890")).toBeNull();
    expect(normalizeWhatsappNumber("0101234567")).toBeNull();
    expect(normalizeWhatsappNumber("00123456789")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("encodes the prefilled text", () => {
    expect(whatsappLink("201000000000", "طلب 123")).toBe(
      "https://wa.me/201000000000?text=%D8%B7%D9%84%D8%A8%20123",
    );
  });

  it("refuses an unnormalized number", () => {
    expect(() => whatsappLink("01012345678", "x")).toThrow();
  });
});

describe("order messages", () => {
  it("includes the order number, total, and method label", () => {
    const text = customerOrderWhatsappText(
      { number: "HNY-1", total: 12345, method: "instapay" },
      "ar",
    );
    expect(text).toContain("HNY-1");
    expect(text).toContain(t("ar", "checkout.method.instapay"));
  });

  it("omits methods the checkout never offers", () => {
    const text = customerOrderWhatsappText(
      { number: "HNY-1", total: 100, method: "simulated" },
      "en",
    );
    expect(text).toContain("HNY-1");
    expect(text).not.toContain(t("en", "checkout.paymentTitle"));
    expect(text).not.toContain("simulated");
  });

  it("addresses the customer by name for the shop", () => {
    const arabic = adminOrderWhatsappText({ number: "HNY-1", name: "أحمد" }, "ar");
    expect(arabic).toContain("أحمد");
    expect(arabic).toContain("HNY-1");
    expect(adminOrderWhatsappText({ number: "HNY-2", name: "Ahmed" }, "en")).toContain("Ahmed");
  });
});
