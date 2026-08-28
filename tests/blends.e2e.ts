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
