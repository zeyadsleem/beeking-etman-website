import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { page } from "vite-plus/test/browser";
import type { SubmitFunction } from "@sveltejs/kit";
import CheckoutPage from "./+page.svelte";
import type { PageData } from "./$types";
import { state } from "$lib/cart-store.svelte";

const enhanced = vi.hoisted(() => ({ submit: undefined as SubmitFunction | undefined }));
vi.mock("$app/forms", () => ({
  enhance: (_form: HTMLFormElement, submit: SubmitFunction) => {
    enhanced.submit = submit;
  },
}));
vi.mock("$lib/analytics-events", () => ({
  trackBeginCheckout: vi.fn(),
  trackAddToCart: vi.fn(),
  trackRemoveFromCart: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  state.items = [
    {
      variantId: "new-variant",
      productId: "product",
      name: "Honey",
      variantName: "Jar",
      slug: "honey",
      categorySlug: "honey",
      department: "honey",
      image: "",
      quantity: 2,
      price: 100,
      stock: 5,
    },
  ];
});

describe("enhanced checkout redirects", () => {
  it.each([
    { location: "/checkout/success/order-id?replayed=1", remaining: 1 },
    { location: "/checkout/success/order-id", remaining: 0 },
  ])("leaves $remaining cart lines after $location", async ({ location, remaining }) => {
    render(CheckoutPage, {
      data: {
        lang: "en",
        nonce: crypto.randomUUID(),
        items: [],
        savedAddresses: [],
        governorates: ["cairo"],
        defaultGovernorate: "cairo",
        totals: { subtotal: 0, shipping: 0, total: 0 },
        isLoggedIn: false,
        missingVariantIds: [],
        paymentMethods: ["cod"],
      } as unknown as PageData,
      form: null,
    });
    if (!enhanced.submit) throw new Error("Checkout enhancement was not registered");
    const callback = await enhanced.submit({} as Parameters<SubmitFunction>[0]);
    if (!callback) throw new Error("Checkout enhancement returned no callback");
    const update = vi.fn();
    await callback({
      result: { type: "redirect", status: 303, location },
      update,
      formData: new FormData(),
      formElement: document.createElement("form"),
      action: new URL("https://example.com/checkout?/submit"),
    });
    expect(state.items).toHaveLength(remaining);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("payment method field", () => {
  function baseData(paymentMethods: ("cod" | "instapay" | "wallet")[]) {
    return {
      lang: "en",
      nonce: crypto.randomUUID(),
      items: [],
      savedAddresses: [],
      governorates: ["cairo"],
      defaultGovernorate: "cairo",
      totals: { subtotal: 0, shipping: 0, total: 0 },
      isLoggedIn: false,
      missingVariantIds: [],
      paymentMethods,
    } as unknown as PageData;
  }

  it("renders a radio per offered method", async () => {
    render(CheckoutPage, { data: baseData(["cod", "instapay"]), form: null });
    await expect.element(page.getByRole("radio", { name: /Cash on delivery/ })).toBeVisible();
    await expect.element(page.getByRole("radio", { name: /InstaPay transfer/ })).toBeVisible();
    await expect
      .element(page.getByRole("radio", { name: /Vodafone Cash transfer/ }))
      .not.toBeInTheDocument();
  });

  it("shows the no-methods notice and disables submit", async () => {
    render(CheckoutPage, { data: baseData([]), form: null });
    await expect
      .element(page.getByText("No payment method is available right now", { exact: false }))
      .toBeVisible();
    await expect.element(page.getByRole("button", { name: "Place order" })).toBeDisabled();
  });
});
