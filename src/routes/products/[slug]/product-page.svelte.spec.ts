import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import ProductPage from "./+page.svelte";

function product(id: string, name: string, image: string) {
  return {
    id,
    name,
    slug: `${id}-slug`,
    description: "وصف",
    image,
    categoryId: "cat",
    featured: 0,
    createdAt: 0,
    minPrice: 100_00,
    variants: [
      {
        id: `${id}-v1`,
        name: "500 جرام",
        price: 100_00,
        stock: 10,
        image,
        sortOrder: 0,
      },
    ],
  };
}

function pageData(p: ReturnType<typeof product>) {
  return { user: null, categories: [], lang: "ar" as const, product: p, related: [] };
}

describe("ProductPage", () => {
  it("updates the main image when navigating to another product", async () => {
    const first = product("p1", "منتج أول", "https://example.com/first.jpg");
    const second = product("p2", "منتج ثاني", "https://example.com/second.jpg");

    const result = render(ProductPage, { data: pageData(first) });
    await expect.element(page.getByRole("img").first()).toHaveAttribute("src", first.image);

    await result.rerender({ data: pageData(second) });

    await expect.element(page.getByRole("img").first()).toHaveAttribute("src", second.image);
  });
});
