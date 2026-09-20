import { expect } from "@playwright/test";
import { test, waitForApp } from "../src/routes/e2e-utils";

test.use({ locale: "ar-EG" });

// The catalog supersedes the legacy `six-blend-1kg-plastic` slug with
// `blend-hexagonal-1kg-plastic` (scripts/seed.ts `supersededSlugs`). This is
// the live six-blend product and it stays under its existing `supplements`
// category — no product data moves in this ticket.
const BLEND_PATH = "/honey/supplements/blend-hexagonal-1kg-plastic";
const BLEND_NAME = "عسل خلطه برطمان سدادسي بلاستيك";
const SITE_ORIGIN = "https://beeking-etman-website.pages.dev";

test("/blends 301s to /honey/blends and preserves the query string", async ({ page }) => {
  const redirect = await page.request.get("/blends?utm_source=e2e", { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(redirect.headers()["location"]).toBe("/honey/blends?utm_source=e2e");

  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/honey\/blends$/);
});

test("the blends category page renders without error", async ({ page }) => {
  const response = await page.goto("/honey/blends", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await waitForApp(page);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("خلطات جاهزة");

  // BLEND-3: update once products/photos land — the category is empty today;
  // once blends are assigned here the page must render product cards instead.
  const emptyState = page.getByText("لا توجد منتجات مطابقة لبحثك.");
  const productCards = page.locator('#main-content a[href^="/honey/blends/"]');
  await expect(emptyState.or(productCards.first())).toBeVisible();
});

test("the blends category appears in the honey listing and the sitemap", async ({ page }) => {
  await page.goto("/honey", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await expect(page.getByRole("radio", { name: "خلطات جاهزة" })).toBeVisible();

  const sitemap = await page.request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain(`<loc>${SITE_ORIGIN}/honey/blends</loc>`);
});

test("the ready-made blend product renders variant, price, and media", async ({ page }) => {
  const response = await page.goto(BLEND_PATH, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await waitForApp(page);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(BLEND_NAME);
  await expect(page.locator("span.text-3xl").getByText(/١٠٠/)).toBeVisible();

  const details = page.locator("dl");
  await expect(details).toContainText("الاختيار الحالي");
  await expect(details).toContainText(BLEND_NAME);

  // Scoped to the product's own gallery container so a related card's
  // placeholder cannot satisfy the assertion.
  // BLEND-3: update once products/photos land — the gallery replaces the
  // placeholder, and both states keep this green.
  const media = page.getByTestId("product-media");
  await expect(media.locator("figure, [data-category]").first()).toBeVisible();
});

test("the blend product adds to the cart and checks out as a variant line", async ({ page }) => {
  await page.goto(BLEND_PATH, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const cartResponse = page.waitForResponse(
    (r) => r.url().includes("/api/cart") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await cartResponse;

  await page.goto("/checkout", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await expect(page.getByText(BLEND_NAME).first()).toBeVisible();

  await page.getByLabel("الاسم بالكامل").fill("أحمد محمد تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill("blend-checkout@example.com");
  await page.getByLabel("رقم الهاتف").fill("01012345678");
  await page.getByLabel("المدينة").fill("القاهرة");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع التسعين، التجمع الخامس");
  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page).toHaveURL(/\/checkout\/success\//);
  await expect(page.getByTestId("order-number")).toBeVisible();
  await expect(page.getByText(BLEND_NAME).first()).toBeVisible();
});

test("search finds the blend product by name", async ({ page }) => {
  await page.goto("/honey", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await page.getByLabel("بحث في المتجر").fill("عسل خلطه");
  await page.getByLabel("بحث في المتجر").press("Enter");

  await expect(page).toHaveURL(/\/honey\?q=/);
  await expect(page.getByRole("link", { name: BLEND_NAME }).first()).toBeVisible();
});
