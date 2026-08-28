import { expect, type Page } from "@playwright/test";
import { test, waitForApp } from "./e2e-utils";

test.use({ locale: "ar-EG" });

/** Drives a full circular stir gesture on the mix zone (3 full turns). */
async function completeStir(page: Page): Promise<void> {
  const zone = page.getByTestId("mix-stir-zone");
  await expect(zone).toBeVisible();
  const box = await zone.boundingBox();
  if (!box) throw new Error("mix stir zone has no bounding box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = Math.min(box.width, box.height) / 2 - 10;

  // Dispatch synthesized pointer events (deterministic vs. mouse synthesis).
  const pointerInit = (x: number, y: number) => ({
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    bubbles: true,
    clientX: x,
    clientY: y,
  });

  await zone.dispatchEvent("pointerdown", pointerInit(cx + r, cy));
  // 3 full turns × 24 evenly spaced positions.
  for (let turn = 0; turn < 3; turn++) {
    for (let i = 1; i <= 24; i++) {
      const a = (i / 24) * 2 * Math.PI;
      await zone.dispatchEvent(
        "pointermove",
        pointerInit(cx + r * Math.cos(a), cy + r * Math.sin(a)),
      );
    }
  }
  await zone.dispatchEvent("pointerup", pointerInit(cx + r, cy));

  await expect(page.getByTestId("mix-done")).toBeVisible();
}

test("customer composes a blend step by step and adds it to the cart", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const scene = page.getByTestId("blends-scene");
  await expect(scene).toBeVisible();

  // Step 1 — choose a base honey + size.
  await page.getByTestId("honey-sidr").click();
  await expect(page.getByTestId("honey-sidr")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("size-half").click();
  await expect(page.getByTestId("size-half")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("size-full").click();
  await expect(page.getByTestId("size-full")).toHaveAttribute("aria-pressed", "true");

  // Next is enabled once a honey is chosen.
  const next = page.getByTestId("blends-next");
  await expect(next).toBeEnabled();
  await next.click();

  // Step 2 — add an ingredient dose via the stepper.
  await expect(scene).toContainText("المكونات");
  await page.getByTestId("dose-add-royalJelly").click();
  await expect(page.getByTestId("dose-count-royalJelly")).toHaveText(/×1/);
  await next.click();

  // Step 3 — mix by stirring, then order.
  await completeStir(page);
  await expect(page.getByTestId("blends-order-panel")).toBeVisible();
  await page.getByTestId("add-to-cart-btn").click();

  const drawer = page.getByTestId("cart-drawer");
  await expect(drawer).toContainText("سدر");
  await expect(drawer).toContainText("غذاء ملكات");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByTestId("blends-shell")).toBeVisible();
});

test("next is gated: ordering stays locked until each step is complete", async ({ page }) => {
  await page.goto("/blends", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const next = page.getByTestId("blends-next");
  const scene = page.getByTestId("blends-scene");

  // Step 1: no honey chosen yet → next is disabled and no order panel exists.
  await expect(next).toBeDisabled();
  await expect(page.getByTestId("blends-order-panel")).toHaveCount(0);

  await page.getByTestId("honey-clover").click();
  await expect(next).toBeEnabled();
  await next.click();

  // Step 2: no dose added yet → next is disabled again.
  await expect(scene).toContainText("المكونات");
  await expect(next).toBeDisabled();
  await page.getByTestId("dose-add-ginseng").click();
  await expect(next).toBeEnabled();
  await next.click();

  // Step 3: mixing not done → no order panel.
  await expect(page.getByTestId("blends-order-panel")).toHaveCount(0);
  await completeStir(page);
  await expect(page.getByTestId("blends-order-panel")).toBeVisible();
});
