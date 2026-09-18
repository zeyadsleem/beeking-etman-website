import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";
import { clearRateLimitRows, test, waitForApp } from "../src/routes/e2e-utils";
import { t, type Lang } from "../src/lib/i18n/messages";

const PRODUCT_PATH = "/honey/sidr/honey-sidr-1kg";
const WIDTHS = [320, 390, 768, 1024, 1280, 1440] as const;
const SEARCH_PRESENT = ["/", "/about"] as const;
const SEARCH_ABSENT = ["/products", "/honey", "/equipment"] as const;
const LONG_NAME = "عميل باسم طويل لاختبار المحاذاة Long Customer Name";

const routeEvidence: string[] = [];

test.afterAll(() => {
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/ui-polish-routes.md",
    [
      "| Lang | URL | Identity | Result |",
      "|------|-----|----------|--------|",
      ...routeEvidence,
    ].join("\n"),
  );
});

async function setLang(page: Page, lang: Lang): Promise<void> {
  const response = await page.request.post(`/api/lang?lang=${lang}`);
  expect(response.ok()).toBe(true);
}

async function visit(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(200);
  expect(new URL(page.url()).pathname, path).toBe(path);
  await waitForApp(page);
  await page.evaluate(() => document.fonts.ready);
}

async function register(page: Page): Promise<string> {
  clearRateLimitRows("register:");
  const email = `polish-${randomUUID()}@test.dev`;
  // The JSON auth API rejects requests without a same-origin Origin header
  // (MISSING_OR_NULL_ORIGIN); page.request sends none, so it is set explicitly.
  const origin = page.url().startsWith("http")
    ? new URL(page.url()).origin
    : `http://localhost:${process.env.E2E_PORT ?? 4173}`;
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { name: LONG_NAME, email, password: randomUUID() },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return email;
}

function promote(email: string): void {
  if (!/^polish-[a-f0-9-]+@test\.dev$/.test(email)) throw new Error("Invalid fixture email");
  const state = process.env.E2E_D1_STATE;
  if (!state) throw new Error("An isolated E2E_D1_STATE is required");
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
      state,
      "--command",
      `UPDATE user SET role = 'admin' WHERE email = '${email}'`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) throw new Error(result.stderr);
}

async function addProduct(page: Page, lang: Lang): Promise<void> {
  await visit(page, PRODUCT_PATH);
  const synced = page.waitForResponse(
    (response) => response.url().includes("/api/cart") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: t(lang, "detail.addToCart"), exact: true }).click();
  expect((await synced).ok()).toBe(true);
  await page.keyboard.press("Escape");
}

/**
 * Geometrisk header/cart regression: every visible header control (including
 * the cart badge and long account labels) must sit inside the viewport, none
 * may overlap another, and the page must not hide overflow (scrollWidth) at
 * the document or layout-wrapper level.
 */
async function headerGeometry(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const header = document.querySelector(".header-grid");
    if (!header)
      return { controls: 0, outside: ["missing-header"], overlaps: [["", ""]], masked: true };
    const controls = Array.from(
      header.querySelectorAll("a, button, input, [data-testid='cart-count']"),
    ).filter((element) => element.getClientRects().length > 0);
    const boxes = controls.map((element) => ({
      element,
      label: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40),
      box: element.getBoundingClientRect(),
    }));
    const outside = boxes
      .filter(({ box }) => box.left < -1 || box.right > document.documentElement.clientWidth + 1)
      .map(({ label }) => label);
    const overlaps: string[][] = [];
    for (let first = 0; first < boxes.length; first++) {
      for (let second = first + 1; second < boxes.length; second++) {
        const a = boxes[first];
        const b = boxes[second];
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        const intersects =
          Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 1 &&
          Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 1;
        if (intersects) overlaps.push([a.label, b.label]);
      }
    }
    const wrapper = document.querySelector("main")?.parentElement ?? null;
    const masked = [document.documentElement, document.body, wrapper]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .some((element) => ["hidden", "clip"].includes(getComputedStyle(element).overflowX));
    return {
      controls: boxes.length,
      outside,
      overlaps,
      masked,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const label = `${page.url()} at ${page.viewportSize()?.width}px`;
  expect.soft(result.controls, label).toBeGreaterThan(0);
  expect.soft(result.outside, `${label} outside viewport`).toEqual([]);
  expect.soft(result.overlaps, `${label} overlapping controls`).toEqual([]);
  expect.soft(result.masked, `${label} masks overflow`).toBe(false);
  expect.soft(result.overflow, `${label} document overflow`).toBeLessThanOrEqual(0);
}

async function expectContained(page: Page, dialogLabel: string, presses: number): Promise<void> {
  const dialog = page.getByRole("dialog", { name: dialogLabel });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => dialog.evaluate((node) => node.contains(document.activeElement)))
    .toBe(true);
  for (let index = 0; index < presses; index++) {
    await page.keyboard.press(index % 2 ? "Shift+Tab" : "Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
      `focus escaped the "${dialogLabel}" dialog`,
    ).toBe(true);
  }
}

const EVIDENCE_PATHS = new Set(["/", "/about", "/products", PRODUCT_PATH, "/cart", "/checkout"]);

async function settlePage(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (const image of Array.from(document.images)) {
      if (image.complete) continue;
      await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }
  });
}

async function captureEvidence(page: Page, lang: Lang, path: string): Promise<void> {
  if (process.env.UI_EVIDENCE !== "1" || !EVIDENCE_PATHS.has(path)) return;
  const dir = `test-results/ui-polish-evidence/${lang}/${path.replaceAll(/[^a-zA-Z0-9]+/g, "-") || "home"}`;
  mkdirSync(dir, { recursive: true });
  for (const width of [390, 1440] as const) {
    await page.setViewportSize({ width, height: 900 });
    await settlePage(page);
    await page.screenshot({ path: `${dir}/${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function checkRoute(
  page: Page,
  lang: Lang,
  path: string,
  identity: string,
  locator: () => Locator,
): Promise<void> {
  try {
    await visit(page, path);
    await expect(locator(), `${path} identity (${identity})`).toBeVisible({ timeout: 15_000 });
    for (const width of [390, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      expect
        .soft(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
          `${path} at ${width}px overflows horizontally`,
        )
        .toBeLessThanOrEqual(0);
    }
    await captureEvidence(page, lang, path);
    routeEvidence.push(`| ${lang} | \`${path}\` | ${identity} | PASS |`);
  } catch (error) {
    routeEvidence.push(`| ${lang} | \`${path}\` | ${identity} | FAIL |`);
    throw error;
  }
}

const heading = (page: Page, name?: string) =>
  name
    ? page.getByRole("heading", { level: 1, name })
    : page.getByRole("heading", { level: 1 }).first();

for (const lang of ["ar", "en"] as const) {
  test(`${lang} 29 templates keep their identity and stay within the viewport`, async ({
    page,
  }) => {
    test.setTimeout(900_000);
    await setLang(page, lang);

    await checkRoute(page, lang, "/", "h1 hero", () => heading(page));
    await checkRoute(page, lang, "/about", "h1 about hero", () => heading(page));
    await checkRoute(page, lang, "/products", `h1 ${t(lang, "products.title")}`, () =>
      heading(page, t(lang, "products.title")),
    );
    await checkRoute(page, lang, "/honey", "h1 department hero", () => heading(page));
    await checkRoute(page, lang, "/honey/sidr", "h1 category hero", () => heading(page));
    await checkRoute(page, lang, PRODUCT_PATH, "h1 product name", () => heading(page));
    await checkRoute(page, lang, "/blends", "testid blends-scene + h1", () =>
      page.getByTestId("blends-scene"),
    );
    await checkRoute(page, lang, "/cart", `h1 ${t(lang, "cart.title")} (empty)`, () =>
      heading(page, t(lang, "cart.title")),
    );
    await checkRoute(page, lang, "/login", `h1 ${t(lang, "login.heading")}`, () =>
      heading(page, t(lang, "login.heading")),
    );
    await checkRoute(page, lang, "/register", `h1 ${t(lang, "register.heading")}`, () =>
      heading(page, t(lang, "register.heading")),
    );

    const email = await register(page);
    await addProduct(page, lang);
    await checkRoute(page, lang, "/cart", `h1 ${t(lang, "cart.title")} (populated)`, () =>
      heading(page, t(lang, "cart.title")),
    );
    await checkRoute(page, lang, "/checkout", `h1 ${t(lang, "checkout.shippingTitle")}`, () =>
      heading(page, t(lang, "checkout.shippingTitle")),
    );
    for (const [name, value] of Object.entries({
      name: "UI verification customer",
      email,
      phone: "01012345678",
      city: "Cairo",
      address: "123 verification street",
    })) {
      await page.locator(`input[name="${name}"]`).fill(value);
    }
    await page.getByRole("button", { name: t(lang, "checkout.submit"), exact: true }).click();
    await expect(page).toHaveURL(/\/checkout\/success\//);
    const orderId = new URL(page.url()).pathname.split("/").at(-1);
    if (!orderId) throw new Error("Checkout did not produce an order ID");
    await checkRoute(
      page,
      lang,
      `/checkout/success/${orderId}`,
      `h1 ${t(lang, "success.heading")}`,
      () => heading(page, t(lang, "success.heading")),
    );

    for (const path of ["/account", "/account/addresses", "/account/security", "/account/orders"]) {
      await checkRoute(page, lang, path, "h1 account section", () => heading(page));
    }
    await checkRoute(page, lang, `/account/orders/${orderId}`, "h1 order number", () =>
      heading(page),
    );

    promote(email);
    for (const path of [
      "/admin",
      "/admin/customers",
      "/admin/users",
      "/admin/orders",
      `/admin/orders/${orderId}`,
      "/admin/products",
      "/admin/products/new",
    ]) {
      await checkRoute(page, lang, path, "h1 admin section", () => heading(page));
    }
    await visit(page, "/admin/products");
    const editPath = await page
      .locator('a[href^="/admin/products/"]')
      .filter({ hasText: t(lang, "admin.products.edit") })
      .first()
      .getAttribute("href");
    if (!editPath) throw new Error("No seeded product edit link");
    await checkRoute(page, lang, editPath, "h1 product name (edit)", () => heading(page));
    for (const path of [
      "/admin/inventory/alerts",
      "/admin/inventory/reports",
      "/admin/inventory/transfers",
      "/admin/inventory/warehouses",
    ]) {
      await checkRoute(page, lang, path, "h1 inventory section", () => heading(page));
    }
  });

  test(`${lang} header and cart geometry survive every breakpoint, role and search state`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await setLang(page, lang);
    await addProduct(page, lang);
    let email = "";
    for (const role of ["guest", "customer", "admin"] as const) {
      if (role === "customer") email = await register(page);
      if (role === "admin") promote(email);
      let badgeChecked = false;
      for (const path of [...SEARCH_PRESENT, ...SEARCH_ABSENT]) {
        await visit(page, path);
        if (!badgeChecked) {
          await expect(page.getByTestId("cart-count")).toBeVisible();
          badgeChecked = true;
        }
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await headerGeometry(page);
          await expect(
            page.getByRole("button", { name: t(lang, "cart.open"), exact: true }),
          ).toBeInViewport();
          const search = page.locator(".header-search");
          const searchExpected = (SEARCH_PRESENT as readonly string[]).includes(path);
          if (width >= 1024 && searchExpected) {
            await expect(search, `${path} search at ${width}px`).toBeVisible();
          } else {
            await expect(search, `${path} search at ${width}px`).toBeHidden();
          }
        }
      }
    }
  });

  test(`${lang} dialogs trap focus, dismiss with Escape and restore focus`, async ({ page }) => {
    test.setTimeout(300_000);
    await setLang(page, lang);

    await page.setViewportSize({ width: 390, height: 844 });
    await visit(page, "/");
    const menuTrigger = page.getByRole("button", { name: t(lang, "nav.menu"), exact: true });
    await menuTrigger.click();
    await expectContained(page, t(lang, "nav.main"), 12);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: t(lang, "nav.main") })).toBeHidden();
    await expect(menuTrigger).toBeFocused();

    const cartTrigger = page.getByRole("button", { name: t(lang, "cart.open"), exact: true });
    await cartTrigger.click();
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    await expect
      .poll(() => drawer.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(cartTrigger).toBeFocused();

    promote(await register(page));
    await visit(page, "/admin/products");
    const adminTrigger = page.getByRole("button", {
      name: t(lang, "admin.shell.menu"),
      exact: true,
    });
    await adminTrigger.click();
    const adminDialog = page.getByRole("dialog", { name: t(lang, "admin.shell.menu") });
    await expect(adminDialog).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    await expectContained(page, t(lang, "admin.shell.menu"), 12);
    await page.keyboard.press("Escape");
    await expect(adminDialog).toBeHidden();
    await expect(adminTrigger).toBeFocused();

    await adminTrigger.click();
    await expect(adminDialog).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(adminDialog).toBeHidden();
    await expect(page.getByRole("main")).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    const tableRegion = page.getByRole("region", { name: t(lang, "admin.products.title") });
    await expect(tableRegion).toHaveAttribute("tabindex", "0");
    await tableRegion.focus();
    await page.keyboard.press(lang === "ar" ? "ArrowLeft" : "ArrowRight");
    await expect
      .poll(() => tableRegion.evaluate((node) => Math.abs(node.scrollLeft)))
      .toBeGreaterThan(0);
  });

  test(`${lang} cart quantity and remove keep working`, async ({ page }) => {
    test.setTimeout(180_000);
    await setLang(page, lang);
    await addProduct(page, lang);
    await visit(page, "/cart");
    await expect(page.getByTestId("quantity").first()).toHaveText("1");
    await page
      .getByRole("button", { name: t(lang, "qty.increase"), exact: true })
      .first()
      .click();
    await expect(page.getByTestId("quantity").first()).toHaveText("2");
    await page
      .getByRole("button", { name: t(lang, "cart.remove"), exact: true })
      .first()
      .click();
    await expect(page.getByText(t(lang, "cart.emptyPage"))).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });
}

test("language switch flips direction between Arabic RTL and English LTR", async ({ page }) => {
  test.setTimeout(180_000);
  await setLang(page, "ar");
  await visit(page, "/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.getByRole("button", { name: t("ar", "lang.switchTo"), exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: t("en", "nav.menu"), exact: true }).click();
  const menu = page.getByRole("dialog", { name: t("en", "nav.main") });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: t("en", "lang.switchTo"), exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});
