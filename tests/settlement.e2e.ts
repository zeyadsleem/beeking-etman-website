import { expect, type Page } from "@playwright/test";
import { test, waitForApp } from "../src/routes/e2e-utils";
import { ensureAdmin, registerAdmin, uniqueEmail } from "./admin-helpers";

test.use({ locale: "ar-EG" });

const SIDR_PATH = "/honey/sidr/honey-sidr-1kg";
const COD_LABEL = "الدفع عند الاستلام";
const INSTAPAY_LABEL = "تحويل إنستاباي";
// Mirrors PAYMENT_INSTAPAY_ADDRESS in scripts/e2e-setup.mjs.
const INSTAPAY_ACCOUNT = "e2e@instapay";
const CLAIM_REFERENCE = "TRX-E2E-CLAIM-1";
const VERIFY_REFERENCE = "TRX-E2E-VERIFY-1";

async function goToCheckout(page: Page): Promise<void> {
  await page.goto(SIDR_PATH, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const cartResponse = page.waitForResponse(
    (r) => r.url().includes("/api/cart") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await cartResponse;
  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function fillShipping(page: Page, email: string): Promise<void> {
  await page.getByLabel("الاسم بالكامل").fill("أحمد محمد تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("رقم الهاتف").fill("01012345678");
  await page.getByLabel("المدينة").fill("القاهرة");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع التسعين، التجمع الخامس");
}

/** Places a guest order with the given method; returns its number and payable total. */
async function placeOrder(
  page: Page,
  method: "cod" | "instapay",
): Promise<{ orderNumber: string; totalDue: string }> {
  await goToCheckout(page);
  // The radio's accessible name includes the method hint, so match the label.
  await page.getByRole("radio", { name: method === "cod" ? COD_LABEL : INSTAPAY_LABEL }).check();
  await fillShipping(page, uniqueEmail(method === "cod" ? "cod-customer" : "transfer-customer"));

  // Stable hook on the totals component, independent of DOM order.
  const totalDue = await page.getByTestId("cart-total").textContent();
  if (!totalDue) throw new Error("checkout total not rendered");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();
  await expect(page).toHaveURL(/\/checkout\/success\//);

  const orderNumber = await page.getByTestId("order-number").textContent();
  if (!orderNumber) throw new Error("order number not rendered");
  return { orderNumber, totalDue };
}

async function openOrderAsAdmin(page: Page, orderNumber: string): Promise<void> {
  await page.goto("/admin/orders", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const row = page.getByTestId("admin-order-row").filter({ hasText: orderNumber });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/\/admin\/orders\//);
  await waitForApp(page);
}

test("COD order shows the amount due on delivery and reaches the admin unpaid", async ({
  page,
}) => {
  const { orderNumber, totalDue } = await placeOrder(page, "cod");

  // For COD the products total is the amount collected at handover.
  await expect(page.locator("section").filter({ hasText: "المنتجات" }).locator("dd")).toHaveText(
    totalDue,
  );
  // COD is not a transfer: no claim form appears.
  await expect(page.locator('form[action="?/claim"]')).toHaveCount(0);

  const adminEmail = uniqueEmail("cod-admin");
  await registerAdmin(page, adminEmail);
  await ensureAdmin(page, adminEmail);
  await openOrderAsAdmin(page, orderNumber);

  await expect(page.getByTestId("admin-order-detail")).toContainText("جديد");
  const panel = page.getByTestId("settlement-panel");
  await expect(panel).toContainText(COD_LABEL);
  await expect(panel).toContainText("بانتظار الدفع");
});

test("transfer claim is recorded and admin verification marks the order paid", async ({ page }) => {
  const { orderNumber, totalDue } = await placeOrder(page, "instapay");

  // The success page carries the receiving account, the exact amount, and the claim form.
  await expect(page.getByText("حوّل على:")).toBeVisible();
  await expect(page.getByText(INSTAPAY_ACCOUNT)).toBeVisible();
  const claimSection = page.locator("section").filter({ hasText: "تحويل المبلغ" });
  await expect(claimSection.getByText("المبلغ المطلوب:")).toBeVisible();
  await expect(claimSection.getByText(totalDue)).toBeVisible();

  await page.getByLabel(/رقم عملية التحويل/).fill(CLAIM_REFERENCE);
  await page.getByRole("button", { name: "أنا حوّلت المبلغ" }).click();
  await expect(page.getByText("التحويل تحت المراجعة.")).toBeVisible();

  const adminEmail = uniqueEmail("transfer-admin");
  await registerAdmin(page, adminEmail);
  await ensureAdmin(page, adminEmail);
  await openOrderAsAdmin(page, orderNumber);

  const panel = page.getByTestId("settlement-panel");
  await expect(panel).toContainText(INSTAPAY_LABEL);
  await expect(panel).toContainText("بانتظار المراجعة");
  const timeline = panel.locator("ul");
  await expect(timeline.locator("li").filter({ hasText: "مطالبة من العميل" })).toContainText(
    CLAIM_REFERENCE,
  );

  await panel.getByLabel("مرجع التحويل (اختياري)").fill(VERIFY_REFERENCE);
  await page.getByRole("button", { name: "تأكيد استلام الدفع" }).click();

  await expect(page.getByText("تم تسجيل إجراء الدفع")).toBeVisible();
  await expect(panel).toContainText("مدفوع");
  await expect(timeline.locator("li").filter({ hasText: "تأكيد الدفع" })).toContainText(
    VERIFY_REFERENCE,
  );
});
