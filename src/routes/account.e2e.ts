import { expect, type Page } from "@playwright/test";
import { clearRateLimitRows, test, waitForApp } from "./e2e-utils";

test.use({ locale: "ar-EG" });

// One id per worker/file load: retried tests run in a fresh worker, so a retry
// never reuses an email that already exists in the shared per-run database.
const runId = Date.now().toString();
const password = "password123";

function uniqueEmail(label: string): string {
  return `acct-${runId}-${label}@test.dev`;
}

async function registerAndLogin(page: Page, email: string): Promise<void> {
  // Retried tests re-register, so each registration starts from a fresh
  // rate-limit budget instead of inheriting earlier attempts' spend.
  clearRateLimitRows("register:");
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByLabel("الاسم").fill("سارة محمد");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

/** Fills the shipping form on /checkout and submits it. */
type ShippingFiller = (page: Page) => Promise<void>;

/**
 * Buys the seeded sidr product through the real UI (product page → cart →
 * checkout) and returns the order id parsed from the success URL.
 */
async function buySeededProduct(page: Page, fillShipping: ShippingFiller): Promise<string> {
  // The seeded sidr product is addressed directly: its card is not guaranteed
  // to be on the first unfiltered /honey page (catalog order/pagination).
  await page.goto("/honey/sidr/honey-sidr-1kg", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  // The cart cookie is set by an async POST /api/cart; wait for it so the hard
  // navigation below cannot cancel the sync mid-flight (same guard as store.e2e.ts).
  await page.waitForResponse(
    (r) => r.url().includes("/api/cart") && r.request().method() === "POST",
  );
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "إتمام الشراء" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  await fillShipping(page);

  await expect(page).toHaveURL(/\/checkout\/success\//);
  const orderId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
  if (!orderId) throw new Error(`No order id in success URL: ${page.url()}`);
  return orderId;
}

test.describe("customer account", () => {
  test("preview remains available after interrupted page loads", async ({
    browser,
    baseURL,
    request,
  }) => {
    for (let index = 0; index < 30; index++) {
      const interruptedPage = await browser.newPage({ baseURL });
      await interruptedPage.goto("/", { waitUntil: "commit" });
      await interruptedPage.close();
      const response = await request.get("/");
      expect(response.status()).toBe(200);
      await response.dispose();
    }
  });

  test("redirects logged-out visitors to login", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("full journey: profile → addresses → checkout prefill → order history", async ({ page }) => {
    const email = uniqueEmail("journey");
    await registerAndLogin(page, email);

    // Profile: rename via the account hub action.
    await waitForApp(page);
    await page.getByLabel("الاسم").fill("سارة محمد إبراهيم");
    await page.getByRole("button", { name: "حفظ الاسم" }).click();
    await expect(page.getByText("تم تحديث الاسم")).toBeVisible();

    // Addresses: create the first saved address via the dialog; it becomes default.
    await page.goto("/account/addresses", { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.getByRole("button", { name: "إضافة عنوان" }).click();
    await expect(page.getByTestId("address-dialog")).toBeVisible();
    await page.getByLabel("اسم العنوان").fill("البيت");
    await page.getByLabel("اسم المستلم").fill("سارة محمد");
    await page.getByLabel("رقم الهاتف").fill("01012345678");
    await page.getByLabel("المدينة").fill("القاهرة");
    await page.getByLabel("العنوان التفصيلي").fill("12 شارع النيل، المهندسين");
    await page.getByRole("button", { name: /^حفظ$/ }).click();

    // Update: the dialog reopens pre-filled; rename and expect the card to follow.
    const homeCard = page.getByTestId("address-card").filter({ hasText: "البيت" });
    await expect(homeCard).toBeVisible();
    await homeCard.getByRole("button", { name: "تعديل العنوان" }).click();
    await expect(page.getByTestId("address-dialog")).toBeVisible();
    await expect(page.getByLabel("اسم العنوان")).toHaveValue("البيت");
    await page.getByLabel("اسم العنوان").fill("بيت العائلة");
    await page.getByRole("button", { name: /^حفظ$/ }).click();
    const familyCard = page.getByTestId("address-card").filter({ hasText: "بيت العائلة" });
    await expect(page.getByTestId("address-card")).toHaveCount(1);
    await expect(familyCard).toContainText("بيت العائلة");
    await expect(familyCard.getByText("افتراضي", { exact: true })).toBeVisible();

    // Create a second address; it must NOT steal the default badge.
    await page.getByRole("button", { name: "إضافة عنوان" }).click();
    await expect(page.getByTestId("address-dialog")).toBeVisible();
    await expect(page.getByLabel("اسم العنوان")).toHaveValue("");
    await page.getByLabel("اسم العنوان").fill("المكتب");
    await page.getByLabel("اسم المستلم").fill("سارة محمد");
    await page.getByLabel("رقم الهاتف").fill("01112345678");
    await page.getByLabel("المدينة").fill("الجيزة");
    await page.getByLabel("العنوان التفصيلي").fill("5 شارع البحر، الدقي");
    await page.getByRole("button", { name: /^حفظ$/ }).click();
    const officeCard = page.getByTestId("address-card").filter({ hasText: "المكتب" });
    await expect(page.getByTestId("address-card")).toHaveCount(2);
    await expect(officeCard).toBeVisible();
    await expect(officeCard.getByText("افتراضي", { exact: true })).toHaveCount(0);

    // Delete the default address: the card disappears and the default badge
    // is promoted onto the remaining (most recent) address.
    await familyCard.getByRole("button", { name: "حذف" }).click();
    await expect(page.getByTestId("delete-confirm-dialog")).toBeVisible();
    await page.getByTestId("delete-confirm-dialog").getByRole("button", { name: "حذف" }).click();
    await expect(page.getByTestId("address-card")).toHaveCount(1);
    await expect(officeCard).toBeVisible();
    await expect(officeCard.getByText("افتراضي", { exact: true })).toBeVisible();

    // Checkout: saved-address picker prefills shipping fields from the
    // promoted default.
    await buySeededProduct(page, async (checkout) => {
      const savedRadio = checkout.getByRole("radio", { name: /المكتب/ });
      const newRadio = checkout.getByRole("radio", { name: "عنوان جديد" });
      await expect(checkout.getByText("العناوين المحفوظة")).toBeVisible();
      await expect(savedRadio).toBeChecked();
      await expect(newRadio).not.toBeChecked();
      await expect(checkout.getByLabel("الاسم بالكامل")).toHaveValue("سارة محمد");
      await expect(checkout.getByLabel("رقم الهاتف")).toHaveValue("01112345678");
      await expect(checkout.getByLabel("المدينة")).toHaveValue("الجيزة");
      await expect(checkout.getByLabel("العنوان بالتفصيل")).toHaveValue("5 شارع البحر، الدقي");

      // The save-address checkbox only shows while “new address” is selected.
      const saveCheckbox = checkout.getByLabel("احفظ هذا العنوان في حسابي");
      await expect(saveCheckbox).toBeHidden();
      await newRadio.check();
      await expect(saveCheckbox).toBeVisible();
      await savedRadio.check();
      await expect(saveCheckbox).toBeHidden();

      await checkout.getByLabel("البريد الإلكتروني").fill(email);
      await checkout.getByRole("button", { name: "تأكيد الطلب" }).click();
    });

    // Order history: list links into the detail page.
    await page.goto("/account/orders", { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const firstOrder = page.getByTestId("order-link").first();
    await expect(firstOrder).toContainText(/HNY-/);
    await firstOrder.click();
    await expect(page).toHaveURL(/\/account\/orders\//);
    await expect(page.getByText("سارة محمد").first()).toBeVisible();
  });

  test("password change requires correct current password", async ({ page }) => {
    await registerAndLogin(page, uniqueEmail("password"));
    await page.goto("/account/security", { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.getByLabel(/الحالية/).fill("wrongpass");
    await page.getByLabel(/الجديدة/).fill("newpassword456");
    await page.getByRole("button", { name: "تغيير كلمة المرور" }).click();
    await expect(page.getByText("غير صحيحة")).toBeVisible();
  });

  test("cross-user IDOR: another user's order detail returns 404", async ({ page }) => {
    const emailA = uniqueEmail("idor-a");
    await registerAndLogin(page, emailA);
    // User A checks out without a saved address (manual shipping form).
    const orderA = await buySeededProduct(page, async (checkout) => {
      await checkout.getByLabel("الاسم بالكامل").fill("أحمد علي");
      await checkout.getByLabel("البريد الإلكتروني").fill(emailA);
      await checkout.getByLabel("رقم الهاتف").fill("01112345678");
      await checkout.getByLabel("المدينة").fill("الجيزة");
      await checkout.getByLabel("العنوان بالتفصيل").fill("5 شارع الهرم، الهرم");
      await checkout.getByRole("button", { name: "تأكيد الطلب" }).click();
    });

    await page.goto("/account", { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);

    // User B requests A's order id directly — ownership comes from the session,
    // so the id must be indistinguishable from a missing order (404).
    await registerAndLogin(page, uniqueEmail("idor-b"));
    const response = await page.goto(`/account/orders/${orderA}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("الطلب غير موجود")).toBeVisible();
  });
});
