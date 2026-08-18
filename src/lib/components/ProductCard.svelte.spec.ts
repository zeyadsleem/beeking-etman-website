import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import ProductCard from "./ProductCard.svelte";

describe("ProductCard", () => {
  it("renders product name and formatted price", async () => {
    render(ProductCard, {
      product: {
        id: "p1",
        name: "عسل سدر مصري",
        slug: "sidr-egyptian",
        description: "د",
        image: "https://example.com/h.jpg",
        images: ["https://example.com/h.jpg"],
        categoryId: "cat",
        featured: 1,
        createdAt: 0,
        minPrice: 380_00,
        variants: [
          {
            id: "v1",
            name: "500 جرام",
            price: 380_00,
            stock: 10,
            image: "https://example.com/h.jpg",
            sortOrder: 0,
          },
          {
            id: "v2",
            name: "1 ك",
            price: 700_00,
            stock: 10,
            image: "https://example.com/h.jpg",
            sortOrder: 1,
          },
        ],
      },
    });
    await expect.element(page.getByText("عسل سدر مصري")).toBeInTheDocument();
    await expect.element(page.getByText("يبدأ من")).toBeInTheDocument();
    await expect.element(page.getByText(/ج\.م\./).first()).toBeInTheDocument();
  });

  it("shows out-of-stock state and disabled button", async () => {
    render(ProductCard, {
      product: {
        id: "p2",
        name: "عسل السدر الجبلي",
        slug: "sidr-mountain",
        description: "د",
        image: "https://example.com/m.jpg",
        images: ["https://example.com/m.jpg"],
        categoryId: "cat",
        featured: 0,
        createdAt: 0,
        minPrice: 0,
        variants: [
          {
            id: "v3",
            name: "500 جرام",
            price: 0,
            stock: 0,
            image: "https://example.com/m.jpg",
            sortOrder: 0,
          },
        ],
      },
    });
    await expect.element(page.getByText("نفدت الكمية")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "غير متوفر" })).toBeDisabled();
  });
});
