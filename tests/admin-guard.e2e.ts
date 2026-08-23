import { expect, test } from "@playwright/test";

test("non-admin is redirected from /admin to /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
