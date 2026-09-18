import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { t } from "$lib/i18n/messages";
import type { AdminOrderItemRow, AdminOrderRow, OrderStatus } from "$lib/server/admin/orders";
import type { ActionData } from "./$types";
import OrderDetailPage from "./+page.svelte";

const order: AdminOrderRow & { shippingCost: number } = {
  id: "order-1",
  number: "HNY-000001",
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  address: "شارع 9",
  city: "القاهرة",
  total: 100_00,
  shippingCost: 0,
  status: "pending_confirmation",
  createdAt: Date.parse("2026-08-23T10:00:00Z"),
};

const items: AdminOrderItemRow[] = [
  {
    id: "item-1",
    productId: "product-1",
    productName: "عسل سدر مصري",
    variantName: "كيلو",
    quantity: 2,
    unitPrice: 50_00,
  },
];

function detailData(
  transitions: readonly OrderStatus[],
  customerWhatsappUrl: string | null = "https://wa.me/201000000000?text=order",
): {
  data: {
    order: AdminOrderRow & { shippingCost: number };
    items: AdminOrderItemRow[];
    transitions: readonly OrderStatus[];
    customerWhatsappUrl: string | null;
    lang: "ar";
  };
  form: ActionData;
} {
  // ActionData is `… | null`: the page renders identically with no action result.
  return { data: { order, items, transitions, customerWhatsappUrl, lang: "ar" }, form: null };
}

describe("admin order detail transitions", () => {
  it("keeps non-destructive transitions as direct form submits", async () => {
    render(OrderDetailPage, detailData(["shipped", "delivered"]));

    const shipped = page.getByRole("button", { name: t("ar", "admin.order.markShipped") });
    await expect.element(shipped).toHaveAttribute("type", "submit");
    const delivered = page.getByRole("button", { name: t("ar", "admin.order.markDelivered") });
    await expect.element(delivered).toHaveAttribute("type", "submit");
    // No destructive action offered here, so no dialog ever mounts.
    await expect.element(page.getByTestId("cancel-confirm-dialog")).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog instead of submitting on cancel", async () => {
    render(OrderDetailPage, detailData(["shipped", "cancelled"]));

    const trigger = page.getByRole("button", { name: t("ar", "admin.order.cancel") });
    // The trigger must not be a submit button: one click can never fire the
    // irreversible restocking transition directly.
    await expect.element(trigger).toHaveAttribute("type", "button");
    await trigger.click();

    const dialog = page.getByTestId("cancel-confirm-dialog");
    await expect.element(dialog).toBeInTheDocument();
    await expect.element(dialog).toHaveTextContent(t("ar", "admin.order.confirmCancel"));
  });

  it("closes the dialog without cancelling when dismissed", async () => {
    render(OrderDetailPage, detailData(["cancelled"]));

    await page.getByRole("button", { name: t("ar", "admin.order.cancel") }).click();
    const dialog = page.getByTestId("cancel-confirm-dialog");
    await expect.element(dialog).toBeInTheDocument();

    // Scoped + exact: the Arabic dismiss label ("إلغاء") is a prefix of the
    // trigger label ("إلغاء الطلب"), which would otherwise match both.
    await dialog.getByRole("button", { name: t("ar", "addresses.cancel"), exact: true }).click();
    await expect.element(dialog).not.toBeInTheDocument();
  });
});

describe("admin order WhatsApp CTA", () => {
  it("links to the customer phone with a prefilled message", async () => {
    render(
      OrderDetailPage,
      detailData(["confirmed"], "https://wa.me/201000000000?text=%D8%B7%D9%84%D8%A8"),
    );
    await expect
      .element(page.getByTestId("customer-whatsapp"))
      .toHaveAttribute("href", "https://wa.me/201000000000?text=%D8%B7%D9%84%D8%A8");
  });

  it("renders no CTA when the phone cannot be normalized", async () => {
    render(OrderDetailPage, detailData(["confirmed"], null));
    await expect.element(page.getByTestId("customer-whatsapp")).not.toBeInTheDocument();
  });
});
