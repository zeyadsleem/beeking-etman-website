import { expect, test } from "@playwright/test";

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
