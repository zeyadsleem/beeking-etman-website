import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import ProductCard from "./ProductCard.svelte";

describe("ProductCard", () => {
  it("renders product name and formatted price", async () => {
    render(ProductCard, {
      product: {
        id: "p1",
        name: "عسل سدر طبيعي",
        slug: "sidr-natural",
        price: 380_00,
        stock: 10,
        image: "https://example.com/h.jpg",
      },
    });
    await expect.element(page.getByText("عسل سدر طبيعي")).toBeInTheDocument();
    await expect.element(page.getByText(/ج\.م\./)).toBeInTheDocument();
  });

  it("shows out-of-stock state and disabled button", async () => {
    render(ProductCard, {
      product: {
        id: "p2",
        name: "عسل مانوكا",
        slug: "manuka",
        price: 950_00,
        stock: 0,
        image: "https://example.com/m.jpg",
      },
    });
    await expect.element(page.getByText("نفدت الكمية")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "غير متوفر" })).toBeDisabled();
  });
});
