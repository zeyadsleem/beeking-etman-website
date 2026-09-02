import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import Hero from "./Hero.svelte";

describe("Hero", () => {
  it("renders the Arabic wax seal image for the Arabic locale", async () => {
    render(Hero, { lang: "ar", productCount: 2 });

    await expect.element(page.getByTestId("hero-brand")).toBeInTheDocument();
    await expect
      .element(page.getByTestId("hero-brand-img"))
      .toHaveAttribute("src", "/images/etman-wax-ar.png");
    await expect
      .element(page.getByTestId("hero-brand-img-inline"))
      .toHaveAttribute("src", "/images/etman-wax-ar.png");
  });

  it("renders the English wax seal image for the English locale", async () => {
    render(Hero, { lang: "en", productCount: 2 });

    await expect
      .element(page.getByTestId("hero-brand-img"))
      .toHaveAttribute("src", "/images/etman-wax-en.png");
    await expect
      .element(page.getByTestId("hero-brand-img-inline"))
      .toHaveAttribute("src", "/images/etman-wax-en.png");
  });
});
