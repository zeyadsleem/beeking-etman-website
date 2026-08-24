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

test.describe("/blends 3D path (WebGL)", () => {
  // Canvas hit points calibrated for the default 1280x720 viewport against the
  // per-step camera poses (task-13-report.md). The no-WebGL path is owned by
  // the scene-or-fallback test above; this walk requires the real scene.
  const GOAL_CARD: [number, number] = [520, 444];
  // Jar homes on the shelf band; the calibrated point is tried first.
  const HONEY_JARS: readonly (readonly [number, number])[] = [
    [508, 369],
    [535, 395],
    [590, 395],
    [645, 395],
    [700, 395],
  ];
  // Cup 1 sits on a ~25px target; in normal-motion runs the pre-convergence
  // lerp can shift it a few pixels, so the calibrated point is backed by the
  // remaining cup homes (any cup opens the card).
  const PREP_CUPS: readonly (readonly [number, number])[] = [
    [537, 428],
    [597, 415],
    [505, 450],
    [665, 415],
    [728, 430],
  ];

  test("walks goal → honey → prep → stir → pour → order", async ({ page }) => {
    test.setTimeout(180_000);

    const activeStep = (): Promise<string | null> =>
      page.evaluate(() => {
        const bar = document.querySelector('[data-testid="blends-stepbar"]');
        for (const el of bar?.querySelectorAll("span") ?? []) {
          if ((el.getAttribute("class") ?? "").includes("bg-honey-500")) {
            return el.textContent?.trim() ?? null;
          }
        }
        return null;
      });
    const stepIs = (label: string): Promise<boolean> => activeStep().then((step) => step === label);

    // Taps walk a bounded candidate list (calibrated point first) while the
    // camera lerp settles; the signal polls briefly so a slow post-click
    // render can't flip a toggle twice. Once any cup/jar registers, its card
    // stays open, so the walk converges.
    const tapUntil = async (
      points: readonly (readonly [number, number])[],
      signal: () => Promise<boolean>,
    ): Promise<void> => {
      for (const point of points) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await page.mouse.click(point[0], point[1]);
          if (await signal()) return;
          await page.waitForTimeout(1_200);
        }
      }
      // Under software-GL the card can render long after the registering
      // click; give it one last generous window before failing.
      if (await signal()) return;
      throw new Error(
        `canvas taps at ${points.map((p) => p.join(",")).join("; ")} produced no signal`,
      );
    };
    const appearsWithin = (
      locator: ReturnType<typeof page.getByTestId>,
      ms: number,
    ): Promise<boolean> =>
      locator
        .waitFor({ state: "visible", timeout: ms })
        .then(() => true)
        .catch(() => false);

    await page.goto("/blends", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("blends-scene")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4_000); // HDR load + first camera settle

    // goal → honey
    await tapUntil([GOAL_CARD], () => stepIs("العسل"));
    await page.waitForTimeout(2_500); // camera travel

    // honey: jar tap → inspection card → benefits action advances to prep
    const honeyCard = page.getByTestId("honey-info-card");
    await tapUntil(HONEY_JARS, () => appearsWithin(honeyCard, 2_500));
    await honeyCard.getByRole("button", { name: "شوف الفوائد" }).click({ force: true });
    await expect.poll(activeStep, { timeout: 15_000 }).toBe("المكونات");
    await page.waitForTimeout(2_500); // camera travel

    // prep: cup tap → ingredient card
    const ingredientCard = page.getByTestId("ingredient-info-card");
    await tapUntil(PREP_CUPS, () => appearsWithin(ingredientCard, 2_500));

    // prep → stir via the mix-summary action, then skip to pour
    const startStir = page.getByTestId("start-stir-btn");
    await expect(startStir).toBeVisible();
    await startStir.click({ force: true });
    await expect.poll(activeStep, { timeout: 15_000 }).toBe("التحريك");
    await expect(page.getByTestId("stir-progress-ring")).toBeVisible();
    await page.getByRole("button", { name: "تخطي" }).click({ force: true });

    // pour auto-advances to order; the order panel is the reliable signal
    // (the stepbar label can lag under software-GL frame starvation)
    await expect(page.getByTestId("add-to-cart-btn")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "رجوع" })).toHaveCount(0);
  });
});
