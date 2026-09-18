import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { t } from "$lib/i18n/messages";
import type { AdminOrderRow } from "$lib/server/admin/orders";
import type { PageData } from "./$types";
import OrdersPage from "./+page.svelte";

const order: AdminOrderRow = {
  id: "order-1",
  number: "HNY-000001",
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  address: "شارع 9",
  city: "القاهرة",
  total: 100_00,
  status: "pending_confirmation",
  paymentStatus: "pending_review",
  paymentMethod: "instapay",
  createdAt: Date.parse("2026-08-23T10:00:00Z"),
};

type ListData = Pick<
  PageData,
  "items" | "total" | "page" | "pageSize" | "status" | "payment" | "q" | "lang"
>;

function listData(overrides: Partial<ListData> = {}): { data: ListData } {
  return {
    data: {
      items: [order],
      total: 1,
      page: 1,
      pageSize: 20,
      status: null,
      payment: null,
      q: undefined,
      lang: "ar",
      ...overrides,
    },
  };
}

describe("admin orders list", () => {
  it("renders the payment method column and the payment status badge", async () => {
    render(OrdersPage, listData());

    const row = page.getByTestId("admin-order-row");
    await expect.element(row).toHaveTextContent(t("ar", "admin.orders.paymentColumn"));
    await expect.element(row).toHaveTextContent(t("ar", "checkout.method.instapay"));
    await expect.element(row).toHaveTextContent(t("ar", "admin.orders.payment.pending_review"));
  });

  it("links the review-queue shortcut to the pending review filter", async () => {
    render(OrdersPage, listData({ status: "shipped", payment: "paid" }));

    await expect
      .element(page.getByTestId("review-queue-shortcut"))
      .toHaveAttribute("href", "/admin/orders?status=shipped&payment=pending_review");
  });

  it("keeps the other active filters when flipping one payment chip", async () => {
    render(OrdersPage, listData({ q: "HNY", status: "shipped", payment: "paid" }));

    const unpaid = page.getByRole("link", {
      name: t("ar", "admin.orders.payment.unpaid"),
      exact: true,
    });
    await expect
      .element(unpaid)
      .toHaveAttribute("href", "/admin/orders?q=HNY&status=shipped&payment=unpaid");
  });
});
