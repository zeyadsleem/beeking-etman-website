import { expect, type Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { clearRateLimitRows, waitForApp } from "../src/routes/e2e-utils";

export const ADMIN_PASSWORD = "password123";

const runId = Date.now().toString();

export function uniqueEmail(label: string): string {
  return `admin-ops-${runId}-${label}@test.dev`;
}

function setUserRole(email: string, role: string): void {
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
      process.env.E2E_D1_STATE ?? ".wrangler/state/e2e",
      "--command",
      `UPDATE user SET role = '${role}' WHERE email = '${email}'`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(`D1 setUserRole failed: ${result.stderr}`);
  }
}

export async function registerAdmin(page: Page, email: string): Promise<void> {
  clearRateLimitRows("register:");
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByLabel("الاسم").fill("مدير تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL(/\/account$/);
  setUserRole(email, "admin");
}

export async function loginAsAdmin(page: Page, email: string): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

export async function ensureAdmin(page: Page, email: string): Promise<void> {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  if (page.url().includes("/login")) {
    await loginAsAdmin(page, email);
  }
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await expect(page.getByTestId("stat-revenue")).toBeVisible();
}
