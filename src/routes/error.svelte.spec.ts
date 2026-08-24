import { page } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";

// +error.svelte reads SvelteKit's reactive `page`; substitute a single
// mutable object that each test reshapes before rendering.
const state = vi.hoisted(() => ({
  page: {
    status: 404,
    error: null as { message: string } | null,
    url: new URL("http://localhost/some/missing/path"),
    data: {} as { lang?: "ar" | "en" },
  },
}));

vi.mock("$app/state", () => ({ page: state.page }));

import ErrorPage from "./+error.svelte";

describe("+error page", () => {
  it("renders a branded 404 with the thrown message and navigation CTAs", async () => {
    state.page.status = 404;
    state.page.error = { message: "Product not found" };

    render(ErrorPage, { data: { lang: "en" } });

    await expect.element(page.getByTestId("error-code")).toHaveTextContent("404");
    await expect.element(page.getByTestId("error-title")).toHaveTextContent("Page not found");
    await expect.element(page.getByTestId("error-body")).toHaveTextContent("Product not found");
    await expect.element(page.getByTestId("error-home-link")).toHaveAttribute("href", "/");
    await expect.element(page.getByTestId("error-store-link")).toHaveAttribute("href", "/products");
  });

  it("falls back to generic server-error copy for non-404 statuses", async () => {
    state.page.status = 500;
    state.page.error = null;

    render(ErrorPage, { data: { lang: "en" } });

    await expect.element(page.getByTestId("error-code")).toHaveTextContent("500");
    await expect.element(page.getByTestId("error-title")).toHaveTextContent("Something went wrong");
  });

  it("defaults to Arabic when layout data failed to load", async () => {
    state.page.status = 404;
    state.page.error = null;

    render(ErrorPage, { data: null });

    await expect.element(page.getByTestId("error-title")).toHaveTextContent("الصفحة غير موجودة");
    await expect.element(page.getByTestId("error-store-link")).toHaveTextContent("تصفح المتجر");
  });

  // Header's switchLanguage() saves the cookie then calls invalidateAll(),
  // which patches the reactive `page.data` — but the `data` prop handed to
  // +error.svelte keeps the stale snapshot from the failed navigation. The
  // page must follow the live layout language instead of that snapshot.
  it("follows the live layout language over the stale error-page snapshot", async () => {
    state.page.status = 404;
    state.page.error = null;
    state.page.data = { lang: "en" };

    render(ErrorPage, { data: { lang: "ar" } });

    await expect.element(page.getByTestId("error-title")).toHaveTextContent("Page not found");
    await expect
      .element(page.getByTestId("error-store-link"))
      .toHaveTextContent("Browse the store");
  });
});
