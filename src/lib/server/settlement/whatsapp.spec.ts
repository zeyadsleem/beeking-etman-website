import { describe, expect, it } from "vite-plus/test";
import { t } from "$lib/i18n/messages";
import {
  adminOrderWhatsappText,
  customerOrderWhatsappText,
  normalizeWhatsappNumber,
  whatsappLink,
} from "./whatsapp";

describe("normalizeWhatsappNumber", () => {
  it("keeps digits only", () => {
    expect(normalizeWhatsappNumber("+20 100 000 0000")).toBe("201000000000");
    expect(normalizeWhatsappNumber(" 0100-000-0000 ")).toBe("01000000000");
  });

  it("rejects implausible or missing values", () => {
    expect(normalizeWhatsappNumber("123")).toBeNull();
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber(undefined)).toBeNull();
    expect(normalizeWhatsappNumber("1".repeat(20))).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("encodes the prefilled text", () => {
    expect(whatsappLink("201000000000", "طلب 123")).toBe(
      "https://wa.me/201000000000?text=%D8%B7%D9%84%D8%A8%20123",
    );
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
    expect(text).not.toContain("simulated");
  });

  it("addresses the customer by name for the shop", () => {
    expect(adminOrderWhatsappText({ number: "HNY-1", name: "أحمد" }, "ar")).toContain("أحمد");
    expect(adminOrderWhatsappText({ number: "HNY-1", name: "Ahmed" }, "ar")).toContain("HNY-1");
  });
});
