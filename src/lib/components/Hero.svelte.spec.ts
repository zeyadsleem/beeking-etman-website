import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import Hero from "./Hero.svelte";

describe("cinematic storefront entry", () => {
  it("keeps Arabic shopping and pause controls available while the scene loads", async () => {
    render(Hero, { lang: "ar", productCount: 2 });
    await expect
      .element(page.getByRole("link", { name: "متجر العسل", exact: true }))
      .toHaveAttribute("href", "/honey");
    await expect.element(page.getByRole("button", { name: "إيقاف الحركة" })).toBeInTheDocument();
  });
  it("keeps English shopping and pause controls available while the scene loads", async () => {
    render(Hero, { lang: "en", productCount: 2 });
    await expect
      .element(page.getByRole("link", { name: "Honey Store", exact: true }))
      .toHaveAttribute("href", "/honey");
    await expect.element(page.getByRole("button", { name: "Pause animation" })).toBeInTheDocument();
  });
});
