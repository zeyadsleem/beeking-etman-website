import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import Hero from "./Hero.svelte";

const products = [
  {
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
    ],
  },
  {
    id: "p2",
    name: "عسل السدر الجبلي",
    slug: "sidr-mountain",
    description: "د",
    image: "https://example.com/m.jpg",
    images: ["https://example.com/m.jpg"],
    categoryId: "cat",
    featured: 0,
    createdAt: 0,
    minPrice: 250_00,
    variants: [
      {
        id: "v2",
        name: "250 جرام",
        price: 250_00,
        stock: 10,
        image: "https://example.com/m.jpg",
        sortOrder: 0,
      },
    ],
  },
];

describe("Hero", () => {
  it("renders the Arabic wax seal image for the Arabic locale", async () => {
    render(Hero, { lang: "ar", featured: products, productCount: 2 });

    await expect.element(page.getByTestId("hero-brand")).toBeInTheDocument();
    await expect
      .element(page.getByTestId("hero-brand-img"))
      .toHaveAttribute("src", "/images/etman-wax-ar.png");
    await expect
      .element(page.getByTestId("hero-brand-mobile"))
      .toHaveAttribute("src", "/images/etman-wax-ar.png");
  });

  it("renders the English wax seal image for the English locale", async () => {
    render(Hero, { lang: "en", featured: products, productCount: 2 });

    await expect
      .element(page.getByTestId("hero-brand-img"))
      .toHaveAttribute("src", "/images/etman-wax-en.png");
    await expect
      .element(page.getByTestId("hero-brand-mobile"))
      .toHaveAttribute("src", "/images/etman-wax-en.png");
  });
});
