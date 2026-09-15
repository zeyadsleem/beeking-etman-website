import { expect, test } from "@playwright/test";

for (const lang of ["en", "ar"]) {
  test(`${lang} mobile menu opens from the burger side`, async ({ page }) => {
    await page.request.post(`/api/lang?lang=${lang}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const burger = page.getByRole("button", { name: lang === "en" ? "Menu" : "القائمة" });
    const burgerBox = await burger.boundingBox();
    await burger.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(burgerBox).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    if (!burgerBox || !drawerBox) return;
    const onLeftHalf = (box: { x: number; width: number }) => box.x + box.width / 2 < 390 / 2;
    expect(onLeftHalf(drawerBox)).toBe(onLeftHalf(burgerBox));
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });
}

for (const lang of ["en", "ar"]) {
  test(`${lang} cart drawer opens from the cart button side`, async ({ page }) => {
    await page.request.post(`/api/lang?lang=${lang}`);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const cartButton = page.getByRole("button", {
      name: lang === "en" ? "Open cart" : "فتح سلة التسوق",
    });
    const buttonBox = await cartButton.boundingBox();
    await cartButton.click();
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    if (!buttonBox || !drawerBox) return;
    const onLeftHalf = (box: { x: number; width: number }) => box.x + box.width / 2 < 1280 / 2;
    expect(onLeftHalf(drawerBox)).toBe(onLeftHalf(buttonBox));
    expect(drawerBox.width).toBeGreaterThanOrEqual(400);
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test(`${lang} cart drawer is wider on mobile`, async ({ page }) => {
    await page.request.post(`/api/lang?lang=${lang}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: lang === "en" ? "Open cart" : "فتح سلة التسوق" })
      .click();
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    if (!drawerBox) return;
    expect(drawerBox.width).toBeGreaterThanOrEqual(390 * 0.86);
  });
}

for (const [lang, edge] of [
  ["en", "right"],
  ["ar", "left"],
] as const) {
  test(`${lang} edge swipe from the ${edge} opens the mobile menu`, async ({ page }) => {
    await page.request.post(`/api/lang?lang=${lang}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate((fromRight) => {
      const startX = fromRight ? window.innerWidth - 2 : 2;
      const endX = fromRight ? startX - 80 : startX + 80;
      const touchAt = (clientX: number) =>
        new Touch({ identifier: 1, target: document.body, clientX, clientY: 300 });
      window.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [touchAt(startX)],
          changedTouches: [touchAt(startX)],
          bubbles: true,
        }),
      );
      window.dispatchEvent(
        new TouchEvent("touchend", {
          touches: [],
          changedTouches: [touchAt(endX)],
          bubbles: true,
        }),
      );
    }, edge === "right");
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}

for (const lang of ["en", "ar"]) {
  test(`${lang} storefront supports mobile search and keyboard navigation`, async ({ page }) => {
    await page.request.post(`/api/lang?lang=${lang}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.screenshot({ path: `/tmp/opencode/storefront-${lang}-mobile.png`, fullPage: true });
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", {
      name: lang === "en" ? "Skip to content" : "انتقل إلى المحتوى",
    });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await page.getByRole("button", { name: lang === "en" ? "Menu" : "القائمة" }).click();
    await expect(page.getByRole("combobox").filter({ visible: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: `/tmp/opencode/storefront-${lang}-desktop.png`, fullPage: true });
    await expect(page.locator('nav a[aria-current="page"]').filter({ visible: true })).toHaveCount(
      1,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
