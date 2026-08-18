import { page, userEvent } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import ProductImageGallery from "./ProductImageGallery.svelte";

const IMAGES = [
  "https://example.com/honey-1.jpg",
  "https://example.com/honey-2.jpg",
  "https://example.com/honey-3.jpg",
];

function props(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    images: IMAGES,
    productName: "عسل برسيم",
    lang: "ar" as const,
    viewTransitionName: "product-p1",
    activeKey: "v1",
    ...overrides,
  };
}

describe("ProductImageGallery", () => {
  it("shows the first image and switches when a thumbnail is clicked", async () => {
    render(ProductImageGallery, { props: props() });

    await expect.element(page.getByRole("img").first()).toHaveAttribute("src", IMAGES[0]);
    expect(page.getByRole("tab").elements()).toHaveLength(3);

    await page.getByRole("tab").nth(1).click();

    await expect.element(page.getByRole("img").first()).toHaveAttribute("src", IMAGES[1]);
    await expect.element(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  });

  it("opens the lightbox on the main image and shows the counter", async () => {
    render(ProductImageGallery, { props: props() });

    await page.getByRole("button", { name: "فتح معرض الصور" }).click();

    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect.element(page.getByRole("dialog").getByText("1 من 3")).toBeVisible();
  });

  it("navigates with arrow keys and closes with Escape", async () => {
    render(ProductImageGallery, { props: props({ lang: "en" }) });

    await page.getByRole("button", { name: "Open image gallery" }).click();
    await userEvent.keyboard("{ArrowRight}");

    await expect
      .element(page.getByRole("dialog").getByRole("img", { name: "عسل برسيم" }))
      .toHaveAttribute("src", IMAGES[1]);

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
  });

  it("resets to the first image when the active key changes", async () => {
    const result = render(ProductImageGallery, { props: props() });

    await page.getByRole("tab").nth(2).click();
    await expect.element(page.getByRole("img").first()).toHaveAttribute("src", IMAGES[2]);

    await result.rerender(props({ activeKey: "v2" }));

    await expect.element(page.getByRole("img").first()).toHaveAttribute("src", IMAGES[0]);
  });
});
