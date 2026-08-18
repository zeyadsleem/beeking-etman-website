import { expect, test } from "@playwright/test";

test.use({ locale: "ar-EG" });

test("guest browses, picks a variant, checks out", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("عسل");

  await page.getByRole("link", { name: "المتجر" }).first().click();
  await expect(page).toHaveURL(/\/products/);

  await page.getByLabel("بحث في المتجر").fill("سدر");
  await page.getByLabel("بحث في المتجر").press("Enter");
  await expect(page).toHaveURL(/\/products\?q=/);

  await page.getByRole("link", { name: "عسل سدر مصري" }).first().click();
  await expect(page).toHaveURL(/\/products\/sidr-honey-1kg/);

  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.getByRole("button", { name: "فتح سلة التسوق" }).click();
  await expect(page.getByTestId("cart-drawer")).toBeVisible();
  await expect(page.getByTestId("cart-drawer")).toContainText("عسل سدر مصري");

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
  await expect(page.getByTestId("cart-count")).toBeHidden();
  await expect(page.getByTestId("order-number")).toBeVisible();
  const number = await page.getByTestId("order-number").textContent();
  expect(number).toMatch(/^HNY-\d{6}$/);
});

test("clicking another link during a view transition still navigates", async ({ page }) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });

  await page.getByRole("link", { name: "عسل سدر مصري" }).first().click();
  await page.waitForURL(/\/products\/sidr-honey-1kg/);

  // The previous navigation's view transition is still cross-fading here;
  // this click must not be silently swallowed (see the onNavigate guard).
  await page.getByRole("link", { name: "المتجر" }).first().click();
  await expect(page).toHaveURL(/\/products$/);
});

test("sort dropdown shows translated labels in Arabic", async ({ page }) => {
  await page.goto("/products", { waitUntil: "domcontentloaded" });

  const sortTrigger = page.getByRole("button", { name: "ترتيب المنتجات" });
  await expect(sortTrigger).toContainText("الأحدث");
  await expect(sortTrigger).not.toContainText("newest");
});

test("checkout shows validation errors for bad input", async ({ page }) => {
  await page.goto("/products/sidr-honey-1kg", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page.getByText("رقم هاتف مصري غير صالح")).toBeVisible();
  await expect(page.getByText("بريد إلكتروني غير صالح")).toBeVisible();
});
