import { expect } from "@playwright/test";
import { test, waitForApp } from "../src/routes/e2e-utils";

test.use({ locale: "ar-EG" });

/**
 * Adds the seeded sidr product to the cart and navigates to checkout.
 * Waits for the cart cookie POST to complete before navigating.
 */
async function goToCheckout(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/products/sidr-honey-1kg", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.waitForResponse(
    (r) => r.url().includes("/api/cart") && r.request().method() === "POST",
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

test("checkout shows validation errors when submitting empty form", async ({ page }) => {
  await goToCheckout(page);

  // Submit without filling any fields.
  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  // Phone and email validation errors should appear.
  await expect(page.getByText("رقم هاتف مصري غير صالح")).toBeVisible();
  await expect(page.getByText("بريد إلكتروني غير صالح")).toBeVisible();
});

test("checkout rejects invalid phone number format", async ({ page }) => {
  await goToCheckout(page);

  await page.getByLabel("الاسم بالكامل").fill("أحمد تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill("test@example.com");
  await page.getByLabel("رقم الهاتف").fill("123");
  await page.getByLabel("المدينة").fill("القاهرة");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع تجريبي");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  // Invalid phone should show a validation error.
  await expect(page.getByText("رقم هاتف مصري غير صالح")).toBeVisible();
});

test("checkout rejects invalid email format", async ({ page }) => {
  await goToCheckout(page);

  await page.getByLabel("الاسم بالكامل").fill("أحمد تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill("not-an-email");
  await page.getByLabel("رقم الهاتف").fill("01012345678");
  await page.getByLabel("المدينة").fill("القاهرة");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع تجريبي");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  // Invalid email should show a validation error.
  await expect(page.getByText("بريد إلكتروني غير صالح")).toBeVisible();
});

test("checkout happy path with valid data leads to success page", async ({ page }) => {
  await goToCheckout(page);

  await page.getByLabel("الاسم بالكامل").fill("أحمد محمد تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill("checkout-test@example.com");
  await page.getByLabel("رقم الهاتف").fill("01012345678");
  await page.getByLabel("المدينة").fill("القاهرة");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع التسعين، التجمع الخامس");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page).toHaveURL(/\/checkout\/success\//);
  await expect(page.getByTestId("order-number")).toBeVisible();
  const number = await page.getByTestId("order-number").textContent();
  expect(number).toMatch(/^HNY-\d{6}$/);
});

test("checkout page shows cart summary with product name", async ({ page }) => {
  await goToCheckout(page);

  // The checkout sidebar should show the product name.
  await expect(page.getByText("عسل سدر مصري")).toBeVisible();
});

test("checkout page has noindex meta tag", async ({ page }) => {
  await goToCheckout(page);

  // Checkout should not be indexed by search engines.
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveCount(1);
  await expect(robots).toHaveAttribute("content", "noindex, nofollow");
});
