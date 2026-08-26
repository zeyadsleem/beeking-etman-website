import { spawnSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";
import { clearRateLimitRows, test, waitForApp } from "../src/routes/e2e-utils";

test.use({ locale: "ar-EG" });

const password = "password123";
const runId = Date.now().toString();

function uniqueEmail(label: string): string {
  return `guard-${runId}-${label}@test.dev`;
}

/**
 * Promotes a registered user to the given role by updating the `user` table
 * directly in the E2E D1 database — mirrors the clearRateLimitRows pattern.
 */
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

async function registerUser(page: Page, email: string): Promise<void> {
  clearRateLimitRows("register:");
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.getByLabel("الاسم").fill("مستخدم تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

// ─── Unauthenticated guard ───────────────────────────────────────────────────

test("non-admin is redirected from /admin to /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

// ─── Authenticated non-admin guard ───────────────────────────────────────────

test("authenticated non-admin is redirected from /admin to /login", async ({ page }) => {
  const email = uniqueEmail("user");
  await registerUser(page, email);

  // User is logged in (session cookie set) but has no admin role — the layout
  // guard bounces to /login, which in turn redirects an already-authenticated
  // user to /account. The key assertion: they never land on /admin.
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/admin/);
  await expect(page).toHaveURL(/\/account/);
});

// ─── Dashboard KPI render ────────────────────────────────────────────────────

test("admin sees the stats dashboard with KPI elements", async ({ page }) => {
  const email = uniqueEmail("admin");
  await registerUser(page, email);

  // Promote to admin via direct D1 write — the session cookie is still valid
  // and the next server load reads the updated role from the database.
  setUserRole(email, "admin");

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // Verify the stats dashboard renders the expected KPI sections.
  await expect(page.getByTestId("stat-revenue")).toBeVisible();
  await expect(page.getByTestId("stat-orders")).toBeVisible();
  await expect(page.getByTestId("stat-customers")).toBeVisible();
  await expect(page.getByTestId("status-breakdown")).toBeVisible();
});
