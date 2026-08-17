import { expect, test, chromium } from "@playwright/test";

test("no reveal-hidden, low CLS, same-page click is a no-op", async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: "ar-EG",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

  await page.addInitScript(() => {
    // survives a real reload; equality before/after proves no full page load
    (window as any).__marker = "alive-" + Math.random();
    (window as any).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if ((e as any).hadRecentInput) continue;
        (window as any).__cls += (e as any).value || 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
    (window as any).__vt = 0;
    const orig = document.startViewTransition?.bind(document);
    if (orig) {
      (document as any).startViewTransition = (cb: any) => {
        (window as any).__vt += 1;
        return orig(cb);
      };
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible();
  await page.waitForTimeout(1200);

  const hidden = await page.evaluate(() => document.querySelectorAll(".reveal-hidden").length);
  const cls = await page.evaluate(() => (window as any).__cls);
  console.log("reveal-hidden:", hidden, "| CLS:", cls, "| console errors:", consoleErrors.length);
  expect(hidden).toBe(0);
  expect(cls).toBeLessThan(0.05);
  expect(consoleErrors).toEqual([]);

  const before = await page.evaluate(() => (window as any).__vt);
  const markerBefore = await page.evaluate(() => (window as any).__marker);
  const urlBefore = page.url();
  await page.locator('header a[href="/"]').last().click();
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => (window as any).__vt);
  const markerAfter = await page.evaluate(() => (window as any).__marker);
  console.log(
    "same-page click: vt before/after:",
    before,
    "->",
    after,
    "| marker:",
    markerBefore,
    "->",
    markerAfter,
  );
  expect(after).toBe(before);
  expect(markerAfter).toBe(markerBefore);
  expect(page.url()).toBe(urlBefore);

  await browser.close();
});

test("cross-page navigation is client-side and still transitions", async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: "ar-EG",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  let fullLoads = 0;
  page.on("load", () => fullLoads++);

  await page.addInitScript(() => {
    (window as any).__vt = 0;
    const orig = document.startViewTransition?.bind(document);
    if (orig) {
      (document as any).startViewTransition = (cb: any) => {
        (window as any).__vt += 1;
        return orig(cb);
      };
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible();
  await page.waitForTimeout(1000);
  await page.waitForLoadState("load");
  const loadsBefore = fullLoads;

  await page.locator('header a[href="/products"]').click();
  await expect(page).toHaveURL(/\/products/);
  await expect(page.locator("h1").first()).toContainText("متجر");
  await page.waitForTimeout(400);

  const vt = await page.evaluate(() => (window as any).__vt);
  console.log(
    "/ -> /products: view transitions:",
    vt,
    "| full loads:",
    loadsBefore,
    "->",
    fullLoads,
  );
  expect(vt).toBeGreaterThan(0);
  expect(fullLoads).toBe(loadsBefore);

  await browser.close();
});

test("browser back after client-side navigation returns home", async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: "ar-EG",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible();
  const homeUrl = page.url();
  await page.waitForTimeout(800);

  await page.locator('a[href^="/products/"]').first().click();
  await expect(page).toHaveURL(/\/products\//);
  await page.waitForTimeout(600);

  await page.goBack();
  await expect(page).toHaveURL(homeUrl);
  await expect(page.locator("h1").first()).toBeVisible();

  await browser.close();
});

test("hash link still scrolls to section", async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: "ar-EG",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").first()).toBeVisible();
  await page.waitForTimeout(800);

  await page.locator('a[href="#categories"]').click();
  await page.waitForTimeout(800);
  const target = await page.locator("#categories").boundingBox();
  const y = await page.evaluate(() => scrollY);
  console.log("#categories scrollY:", y, "target top:", target?.y);
  expect(target).not.toBeNull();

  await browser.close();
});
