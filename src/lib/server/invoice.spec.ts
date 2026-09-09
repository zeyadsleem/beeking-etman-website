import { describe, expect, it } from "vite-plus/test";
import { formatEGP } from "$lib/currency";
import { generateInvoiceHtml } from "./invoice";

describe("invoice shipping snapshot", () => {
  it("prints the stored shipping charge rather than today's shipping policy", () => {
    const order = {
      number: "HNY-123456",
      createdAt: 0,
      name: "Customer",
      email: "customer@example.com",
      phone: "01012345678",
      address: "Delivery address",
      city: "Aswan",
      total: 30000,
      shippingCost: 10000,
      status: "placed",
    };
    const html = generateInvoiceHtml(order, [
      { productName: "Honey", variantName: "Jar", quantity: 1, unitPrice: 20000 },
    ]);
    expect(html).toContain(formatEGP(order.shippingCost));
    expect(html).toContain(formatEGP(order.total));
    expect(html).not.toContain(formatEGP(6000));
  });
});
