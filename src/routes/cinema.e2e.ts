import { expect, test } from "@playwright/test";

test.use({
  locale: "ar-EG",
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`cinematic product, reversible scroll and pause at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".studio-poster")).toHaveClass(/loaded/, { timeout: 60000 });
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator(".chapter-copy.active")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `.impeccable/review/cinema-${viewport.width}.png` });
    await page.getByRole("button", { name: "الزاوية 2", exact: true }).click();
    await expect(page.locator(".chapter-copy.active h2")).toHaveText("نظرة أقرب.");
    await expect(page.locator(".chapter-copy.active")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `.impeccable/review/cinema-side-${viewport.width}.png` });
    await page.getByRole("button", { name: "إيقاف الحركة", exact: true }).click();
    await page.getByRole("button", { name: "الزاوية 3", exact: true }).click();
    await expect(page.locator(".chapter-copy.active h2")).toHaveText("نظرة أقرب.");
    await page.getByRole("button", { name: "تشغيل الحركة", exact: true }).click();
    await expect(page.locator(".chapter-copy.active h2")).toHaveText("لكل عسل، طابعه.");
    await expect(page.locator(".chapter-copy.active")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `.impeccable/review/cinema-detail-${viewport.width}.png` });
    await page.getByRole("button", { name: "الزاوية 1", exact: true }).click();
    await expect(page.locator(".chapter-copy.active h2")).toHaveText("من قلب الخلية.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("link", { name: "انتقل للمتجر", exact: true }).click();
    await expect(page.locator("#categories")).toBeInViewport();
  });
}

test("reduced motion has no long pinned journey", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".camera-chapters")).toBeHidden();
  const height = await page.locator(".cinema").evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(800);
  await expect(page.locator(".shop-honey")).toHaveAttribute("href", "/honey");
});

test("scene load failure preserves shopping and collapses the journey", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind.includes("webgl")) return null;
      return original.call(this, kind, ...args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".cinema")).toHaveClass(/unavailable/);
  await expect(page.locator(".studio-poster")).toBeVisible();
  await expect(page.locator(".camera-chapters")).toBeHidden();
  await expect(page.locator(".shop-honey")).toBeVisible();
});
