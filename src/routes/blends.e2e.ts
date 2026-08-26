import { expect } from "@playwright/test";
import { test, waitForApp } from "./e2e-utils";

test.use({ locale: "ar-EG" });

test("customer composes a blend in the phaser game and adds it to the cart", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Phaser boots asynchronously; the canvas replaces the spinner once ready.
  const scene = page.getByTestId("blends-scene");
  await expect(scene.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("blends-boot-spinner")).toBeHidden();

  // The action bar is sr-only DOM mirroring every canvas interaction.
  await page.getByTestId("action-goal-vitality").click();

  await page.getByTestId("action-jar-half").click();
  await expect(page.getByTestId("action-jar-half")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("action-jar-full").click();
  await expect(page.getByTestId("action-jar-full")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("action-honey-clover").click();

  const addGinseng = page.getByTestId("action-dose-add-ginseng");
  await expect(addGinseng).toBeEnabled();
  await addGinseng.click();
  await expect(page.getByTestId("action-dose-remove-ginseng")).toBeEnabled();
  await page.getByTestId("action-stir-start").click();

  await expect(page.getByTestId("stir-progress-ring")).toBeVisible();
  await page.getByTestId("action-stir-finish").click();

  await expect(page.getByTestId("blends-pour-hint")).toBeVisible();
  await page.getByTestId("action-pour").click();

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
