import { expect } from "@playwright/test";
import { test, waitForApp } from "../src/routes/e2e-utils";

test.use({ locale: "ar-EG" });

test("blend page loads and shows the shell container", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // The blends shell container should be present.
  await expect(page.getByTestId("blends-shell")).toBeVisible();

  // The page heading should be visible (in Arabic by default).
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("blend page shows loading spinner while Phaser boots", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // The boot spinner or the canvas should be present — the spinner shows
  // while Phaser loads, then the canvas replaces it.
  const spinner = page.getByTestId("blends-boot-spinner");
  const canvas = page.getByTestId("blends-scene").locator("canvas");

  // At least one of these should be visible (spinner during load, canvas after).
  const spinnerVisible = await spinner.isVisible().catch(() => false);
  const canvasVisible = await canvas.isVisible().catch(() => false);
  expect(spinnerVisible || canvasVisible).toBe(true);
});

test("blend page no error surface after successful boot", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // After Phaser boots, the error surface should not be present.
  await expect(page.getByTestId("blends-scene").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("blends-boot-error")).toHaveCount(0);
});

test("nav link to blends page works from store", async ({ page }) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Navigate to blends via the header nav link.
  await page.getByRole("link", { name: "الخلطات" }).first().click();
  await expect(page).toHaveURL(/\/blends$/);

  // The blends shell should load.
  await expect(page.getByTestId("blends-shell")).toBeVisible();
});

test("blend page works in English locale", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Switch to English.
  await page.getByRole("button", { name: "English" }).click();

  // The page should still show the blends shell.
  await expect(page.getByTestId("blends-shell")).toBeVisible();
});
