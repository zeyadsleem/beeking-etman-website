import { expect, test } from "@playwright/test";
import { waitForApp } from "./e2e-utils";

test.use({ locale: "ar-EG" });

test.describe("/blends", () => {
  test("loads either the 3D scene or the classic fallback", async ({ page }) => {
    await page.goto("/blends", { waitUntil: "domcontentloaded" });
    const scene = page.getByTestId("blends-scene");
    const fallback = page.getByTestId("blends-fallback");
    await expect(scene.or(fallback)).toBeVisible({ timeout: 15_000 });
  });

  test("force2d shows the classic wizard and notice", async ({ page }) => {
    await page.goto("/blends?force2d=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("blends-fallback")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("webgl-fallback-message")).toBeVisible();
  });

  test("classic fallback can complete an order flow", async ({ page }) => {
    await page.goto("/blends?force2d=1", { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await expect(page.getByTestId("blends-shell")).toBeVisible();

    // goal
    await page.getByRole("button", { name: /قوة وحيوية/ }).click({ force: true });

    // base honey
    await expect(page.getByRole("heading", { name: "اختار عسلك" })).toBeVisible();
    await page
      .getByRole("button", { name: /برسيم/ })
      .first()
      .click();

    // mix: raise a dose, then view the finished blend
    const addDose = page.getByRole("button", { name: "إضافة" }).first();
    await expect(addDose).toBeEnabled();
    await addDose.click();
    await page.getByRole("button", { name: "شوف خلطتك" }).click();

    await expect(page.getByRole("button", { name: "اطلب دي" })).toBeEnabled();
  });
});
