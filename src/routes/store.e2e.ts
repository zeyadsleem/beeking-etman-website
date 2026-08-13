import { expect, test } from "@playwright/test";

test("guest browses, adds to cart, and completes checkout", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("عسل");

  await page.getByRole("link", { name: "المتجر" }).first().click();
  await expect(page).toHaveURL(/\/products/);

  const card = page.getByRole("link", { name: "عسل سدر طبيعي" }).first();
  await card.click();
  await expect(page).toHaveURL(/\/products\/sidr-natural/);

  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.getByRole("button", { name: "فتح سلة التسوق" }).click();
  await expect(page.getByTestId("cart-drawer")).toBeVisible();
  await expect(page.getByTestId("cart-drawer")).toContainText("عسل سدر طبيعي");

  await page.getByRole("link", { name: "إتمام الشراء" }).click();
  await page.getByLabel("الاسم بالكامل").fill("أحمد محمد");
  await page.getByLabel("البريد الإلكتروني").fill("e2e@example.com");
  await page.getByLabel("رقم الهاتف").fill("01012345678");
  await page.getByLabel("المدينة").fill("القاهرة");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع التسعين، التجمع الخامس");
  await page.getByLabel("رقم البطاقة").fill("4242424242424242");
  await page.getByLabel("تاريخ الانتهاء (MM/YY)").fill("08/28");
  await page.getByLabel("رمز الأمان (CVV)").fill("123");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page).toHaveURL(/\/checkout\/success\//);
  await expect(page.getByTestId("order-number")).toBeVisible();
  const number = await page.getByTestId("order-number").textContent();
  expect(number).toMatch(/^HNY-\d{6}$/);
});

test("checkout shows validation errors for bad input", async ({ page }) => {
  await page.goto("/products/sidr-natural");
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.goto("/checkout");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page.getByText("رقم هاتف مصري غير صالح")).toBeVisible();
  await expect(page.getByText("بريد إلكتروني غير صالح")).toBeVisible();
});
