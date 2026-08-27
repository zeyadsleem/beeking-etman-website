import { expect } from "@playwright/test";
import { test, waitForApp } from "../src/routes/e2e-utils";

test.use({ locale: "ar-EG" });

test("navigating to /products?dept=honey shows honey products", async ({ page }) => {
  await page.goto("/products?dept=honey", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Honey department is the default; at least one product card should render.
  const productCards = page.locator('a[href^="/products/"]');
  await expect(productCards.first()).toBeVisible();
  const count = await productCards.count();
  expect(count).toBeGreaterThan(0);
});

test("navigating to /products?dept=equipment shows empty state or equipment products", async ({
  page,
}) => {
  await page.goto("/products?dept=equipment", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Equipment department has no seeded products; the page should still load
  // without errors and either show products or the empty-state placeholder.
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();

  const productCards = page.locator('a[href^="/products/"]');
  const productCount = await productCards.count();

  // Either equipment products exist or an empty-state message is shown.
  if (productCount === 0) {
    await expect(page.getByText("لا توجد منتجات")).toBeVisible();
  }
});

test("clicking department tab updates URL to the selected department", async ({ page }) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Default department is honey (no dept param).
  const equipmentTab = page.getByRole("radio", { name: "أدوات النحالين" });
  await expect(equipmentTab).toBeVisible();
  await equipmentTab.click();

  // URL should now include dept=equipment.
  await expect(page).toHaveURL(/dept=equipment/);

  // Switching back to honey should remove the dept param (honey is default).
  const honeyTab = page.getByRole("radio", { name: "عسل ومنتجات الخلية" });
  await expect(honeyTab).toBeVisible();
  await honeyTab.click();

  // URL should no longer have dept= (honey is the default).
  await expect(page).not.toHaveURL(/dept=/);
});

test("switching department resets category filter", async ({ page }) => {
  await page.goto("/products?dept=honey&category=sidr", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Verify the sidr category is selected.
  await expect(page).toHaveURL(/category=sidr/);

  // Switch to equipment — category param should be cleared.
  const equipmentTab = page.getByRole("radio", { name: "أدوات النحالين" });
  await expect(equipmentTab).toBeVisible();
  await equipmentTab.click();

  await expect(page).toHaveURL(/dept=equipment/);
  await expect(page).not.toHaveURL(/category=sidr/);
});
