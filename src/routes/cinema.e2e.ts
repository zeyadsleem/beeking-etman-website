import { expect, test } from "@playwright/test";

test.use({
  locale: "ar-EG",
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

// The studio renders through a software GL rasteriser in CI, where a single
// frame costs seconds and a full-page screenshot reads the framebuffer back.
test.describe.configure({ timeout: 420_000 });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`cinematic product, reversible scroll and pause at ${viewport.width}px`, async ({
    page,
  }) => {
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
    // The stage is pinned, but its controls keep a static layout box at the top
    // of a 3.6-screen section, so Playwright's scroll-into-view would drag the
    // document off the journey. Drive those controls by event instead; the skip
    // link below is a normal in-flow control and keeps a real click.
    const stageControl = (name: string) =>
      page.getByRole("button", { name, exact: true }).dispatchEvent("click");
    // The viewpoint buttons scroll the native document; a smooth scroll is in
    // flight when the click resolves, so wait for the position to settle before
    // reading the chapter the camera has arrived at.
    const settle = async (expected: number) => {
      await expect.poll(scrollY, { timeout: 30_000 }).toBe(expected);
    };

    await page.setViewportSize(viewport);
    await page.goto("/");
    if (viewport.width <= 650) {
      // Narrow screens use the product poster directly to avoid software WebGL
      // startup and keep the shopping links available without a pinned journey.
      await expect(page.locator(".cinema")).toHaveClass(/unavailable/);
      await expect(page.locator(".studio-poster")).toBeVisible();
      await expect(page.locator(".camera-chapters")).toBeHidden();
      await expect(page.locator(".shop-honey")).toBeVisible();
      await page.getByRole("link", { name: "انتقل للمتجر", exact: true }).click();
      await expect(page.locator("#categories")).toBeInViewport();
      return;
    }
    await expect(page.locator(".studio-poster")).toHaveClass(/loaded/, { timeout: 60000 });
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator(".chapter-copy.active")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `.impeccable/review/cinema-${viewport.width}.png` });

    // The stage pins under the header, so the viewpoint scroll runs from the
    // section's own top across its own height.
    const journey = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".cinema")!;
      const header = Number.parseFloat(getComputedStyle(root).getPropertyValue("--hero-header"));
      const start = root.getBoundingClientRect().top + window.scrollY - header;
      const range = Math.max(0, root.offsetHeight - window.innerHeight + header);
      return { start: Math.round(start), range: Math.round(range) };
    });

    await stageControl("الزاوية 2");
    await settle(journey.start + Math.round(journey.range * 0.3));
    await expect(page.locator(".chapter-copy.active h2")).toHaveText("نظرة أقرب.");
    await expect(page.locator(".chapter-copy.active")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `.impeccable/review/cinema-side-${viewport.width}.png` });

    // Paused: the camera holds its viewpoint, and picking another one moves the
    // document without moving the scene.
    await stageControl("إيقاف الحركة");
    await stageControl("الزاوية 3");
    await settle(journey.start + Math.round(journey.range * 0.55));
    await expect(page.locator(".chapter-copy.active h2")).toHaveText("نظرة أقرب.");

    // Resumed: the playhead catches up to the position the user chose.
    await stageControl("تشغيل الحركة");
    await expect(page.locator(".chapter-copy.active h2")).toHaveText("لكل عسل، طابعه.");
    await expect(page.locator(".chapter-copy.active")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `.impeccable/review/cinema-detail-${viewport.width}.png` });

    // Reversible: the first viewpoint plays the journey backwards.
    await stageControl("الزاوية 1");
    await settle(journey.start);
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
