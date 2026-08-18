import { expect, test } from "@playwright/test";

test.use({ locale: "ar-EG" });

test("customer composes a blend and adds it to the cart", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1 })).toContainText("اصنع خلطتك");

  await page.getByRole("button", { name: /قوة وحيوية/ }).click({ force: true });

  await expect(page.getByRole("heading", { name: "اختار عسلك" })).toBeVisible();
  await page
    .getByRole("button", { name: /برسيم/ })
    .first()
    .click();

  await expect(page.getByRole("heading", { name: "كوّن خلطتك" })).toBeVisible();
  await expect(page.getByText("غذاء ملكات × 2")).toBeVisible();
  await expect(page.getByText("البرطمان · كيلو")).toBeVisible();

  const addRoyalJelly = page.getByRole("button", { name: "إضافة" }).first();
  await addRoyalJelly.click();
  await expect(page.getByText("غذاء ملكات × 3")).toBeVisible();

  await page.getByRole("button", { name: "شوف خلطتك" }).click();

  await expect(page.getByRole("heading", { name: "خلطتك جاهزة!" })).toBeVisible();
  await expect(page.getByText("التركيب")).toBeVisible();

  await page.getByRole("button", { name: "اطلب دي" }).click();

  await expect(page.getByTestId("cart-drawer")).toBeVisible();
  await expect(page.getByTestId("cart-drawer")).toContainText("برسيم");
  await expect(page.getByTestId("cart-drawer")).toContainText("غذاء ملكات");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Craft your own blend");
  await expect(page.getByRole("heading", { name: "Your blend is ready!" })).toBeVisible();
});
