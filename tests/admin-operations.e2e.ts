import { expect, type Page } from "@playwright/test";
import { clearRateLimitRows, test, waitForApp } from "../src/routes/e2e-utils";
import { spawnSync } from "node:child_process";

test.use({ locale: "ar-EG" });

const adminPassword = "password123";
const runId = Date.now().toString();

function uniqueEmail(label: string): string {
  return `admin-ops-${runId}-${label}@test.dev`;
}

function setUserRole(email: string, role: string): void {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "beeking",
      "--local",
      "--persist-to",
      process.env.E2E_D1_STATE ?? ".wrangler/state/e2e",
      "--command",
      `UPDATE user SET role = '${role}' WHERE email = '${email}'`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(`D1 setUserRole failed: ${result.stderr}`);
  }
}

async function registerAdmin(page: Page, email: string): Promise<void> {
  clearRateLimitRows("register:");
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByLabel("الاسم").fill("مدير تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(adminPassword);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL(/\/account$/);
  setUserRole(email, "admin");
}

async function loginAsAdmin(page: Page, email: string): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(adminPassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function placeGuestOrder(page: Page): Promise<string> {
  await page.goto("/honey/sidr/honey-sidr-1kg", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.waitForResponse(
    (r) => r.url().includes("/api/cart") && r.request().method() === "POST",
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await page.getByLabel("الاسم بالكامل").fill("أحمد محمد تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill(uniqueEmail("customer"));
  await page.getByLabel("رقم الهاتف").fill("01012345678");
  await page.getByLabel("المدينة").fill("القاهرة");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع التسعين، التجمع الخامس");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();
  await expect(page).toHaveURL(/\/checkout\/success\//);

  const orderNumber = await page.getByTestId("order-number").textContent();
  if (!orderNumber) throw new Error("order number not rendered");
  return orderNumber;
}

async function ensureAdmin(page: Page, email: string): Promise<void> {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  if (page.url().includes("/login")) {
    await loginAsAdmin(page, email);
  }
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await expect(page.getByTestId("stat-revenue")).toBeVisible();
}

test("admin views orders list, opens an order, and marks it shipped", async ({ page }) => {
  const adminEmail = uniqueEmail("orders-admin");
  const orderNumber = await placeGuestOrder(page);

  await registerAdmin(page, adminEmail);
  await ensureAdmin(page, adminEmail);

  await page.goto("/admin/orders", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("إدارة الطلبات");
  await expect(page.getByTestId("admin-order-row").first()).toBeVisible();

  const targetRow = page.getByTestId("admin-order-row").filter({ hasText: orderNumber });
  await expect(targetRow).toBeVisible();
  await targetRow.click();
  await expect(page).toHaveURL(/\/admin\/orders\//);
  await waitForApp(page);

  const detail = page.getByTestId("admin-order-detail");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(orderNumber);

  await page.getByRole("button", { name: "تعليم كمشحون" }).click();
  await expect(page.getByText("تم تحديث حالة الطلب")).toBeVisible();
  await expect(page.getByText("تم الشحن").first()).toBeVisible();
});

test("admin creates a product and it appears in the product list", async ({ page }) => {
  const adminEmail = uniqueEmail("products-admin");
  await registerAdmin(page, adminEmail);
  await ensureAdmin(page, adminEmail);

  await page.goto("/admin/products/new", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const productName = `عسل تجريبي ${runId}`;
  await page.getByLabel("اسم المنتج").fill(productName);
  await page.getByLabel("الاسم بالإنجليزية").fill(`Test Honey ${runId}`);
  await page.getByLabel("الوصف", { exact: true }).fill("وصف تجريبي للمنتج");
  await page.getByLabel("القسم").selectOption("honey");
  await page.getByLabel("الصنف").selectOption({ label: "عسل سدر" });
  await page.getByLabel("أو الصق رابط صورة").fill("https://example.com/honey.png");

  await page.getByRole("button", { name: "إنشاء المنتج" }).click();

  await expect(page).toHaveURL(/\/admin\/products\/[a-z0-9-]+/);
  await waitForApp(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(productName);

  const variantForm = page.locator('form[action="?/variantSave"]').last();
  await variantForm.locator('input[name="name"]').fill("500 جرام");
  await variantForm.locator('input[name="price"]').fill("250");
  await variantForm.locator('input[name="stock"]').fill("10");
  await variantForm.getByRole("button", { name: "حفظ" }).click();
  const variantRow = page.getByTestId("variant-row");
  await expect(variantRow.locator('input[name="name"]')).toHaveValue("500 جرام");
  await expect(variantRow.locator('input[name="price"]')).toHaveValue("250");
  await expect(variantRow.locator('input[name="stock"]')).toHaveValue("10");

  await page.goto("/admin/products", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const row = page.getByTestId("admin-product-row").filter({ hasText: productName });
  await expect(row).toBeVisible();
  await expect(row).toContainText("عسل سدر");
});

test("admin views the customers list", async ({ page }) => {
  const customerEmail = uniqueEmail("crm-customer");
  const adminEmail = uniqueEmail("customers-admin");

  await page.goto("/honey/sidr/honey-sidr-1kg", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.waitForResponse(
    (r) => r.url().includes("/api/cart") && r.request().method() === "POST",
  );
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await page.getByLabel("الاسم بالكامل").fill("عميل تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill(customerEmail);
  await page.getByLabel("رقم الهاتف").fill("01098765432");
  await page.getByLabel("المدينة").fill("الإسكندرية");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع الجمرك");
  await page.getByRole("button", { name: "تأكيد الطلب" }).click();
  await expect(page).toHaveURL(/\/checkout\/success\//);

  await registerAdmin(page, adminEmail);
  await ensureAdmin(page, adminEmail);

  await page.goto("/admin/customers", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await expect(page.getByTestId("admin-customers-table")).toBeVisible();
  const row = page.getByTestId("admin-customer-row").filter({ hasText: customerEmail });
  await expect(row).toBeVisible();
  await expect(row).toContainText("الإسكندرية");
});
