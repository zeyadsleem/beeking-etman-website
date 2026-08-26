import { expect, type Page } from "@playwright/test";
import { test, waitForApp } from "./e2e-utils";

test.use({ locale: "ar-EG" });

/**
 * Activates an action-bar control the way assistive technology does. The
 * action bar is sr-only DOM mirroring every canvas interaction, so synthetic
 * pointer clicks would be hit-tested against whatever overlays it (the sticky
 * header) instead of reaching the button.
 */
function pressAction(page: Page, testId: string): void {
  void page.getByTestId(testId).dispatchEvent("click");
}

test("customer composes a blend in the phaser game and adds it to the cart", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Phaser boots asynchronously; the canvas replaces the spinner once ready.
  const scene = page.getByTestId("blends-scene");
  await expect(scene.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("blends-boot-spinner")).toBeHidden();

  pressAction(page, "action-goal-vitality");

  pressAction(page, "action-jar-half");
  await expect(page.getByTestId("action-jar-half")).toHaveAttribute("aria-pressed", "true");
  pressAction(page, "action-jar-full");
  await expect(page.getByTestId("action-jar-full")).toHaveAttribute("aria-pressed", "true");
  pressAction(page, "action-honey-clover");

  const addGinseng = page.getByTestId("action-dose-add-ginseng");
  await expect(addGinseng).toBeEnabled();
  pressAction(page, "action-dose-add-ginseng");
  await expect(page.getByTestId("action-dose-remove-ginseng")).toBeEnabled();
  pressAction(page, "action-stir-start");

  await expect(page.getByTestId("stir-progress-ring")).toBeVisible();
  pressAction(page, "action-stir-finish");

  await expect(page.getByTestId("blends-pour-hint")).toBeVisible();
  pressAction(page, "action-pour");

  await expect(page.getByRole("heading", { name: "خلطتك جاهزة!" })).toBeVisible();

  await page.getByTestId("add-to-cart-btn").click();
  const drawer = page.getByTestId("cart-drawer");
  await expect(drawer).toContainText("برسيم");
  await expect(drawer).toContainText("غذاء ملكات");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Your blend is ready!" })).toBeVisible();
});

test("boots the phaser scene without the fallback error surface", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await expect(page.getByTestId("blends-scene").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("blends-boot-error")).toHaveCount(0);
});
