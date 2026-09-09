/// <reference types="node" />
import { defineConfig } from "@playwright/test";
import path from "node:path";

// Single source of truth for the isolated miniflare D1 directory: the
// webServer chain and test-process helpers (clearRateLimitRows, setUserRole)
// must target the same database.
const E2E_PORT = Number(process.env.E2E_PORT ?? 4173);
const E2E_RUN_ID = process.env.E2E_RUN_ID ?? `${process.pid}-${Date.now()}`;
const E2E_STATE = path.resolve(".wrangler/state/e2e", E2E_RUN_ID);
const E2E_VARS = path.resolve(".e2e.vars");
process.env.E2E_RUN_ID = E2E_RUN_ID;
process.env.E2E_D1_STATE = E2E_STATE;
process.env.E2E_PORT ??= String(E2E_PORT);

export default defineConfig({
  webServer: {
    // scripts/e2e-setup.mjs owns the isolated setup:
    //   - never overwrites .dev.vars / .env (uses --env-file .e2e.vars)
    //   - never touches local.db / d1-seed.sql (uses .e2e/<run>.db / .e2e/<run>-seed.sql)
    //   - never kills another process on the E2E_PORT (refuses with a clear
    //     error if the port is already in use)
    //   - never adds sleeps to mask failures
    // Playwright's port-readiness probe handles the actual wait, no sleeps needed.
    command:
      `node scripts/e2e-setup.mjs && ` +
      `sh -c 'max=5; n=0; while [ $n -lt $max ]; do ` +
      `pnpm exec wrangler pages dev .svelte-kit/cloudflare ` +
      `--port ${E2E_PORT} ` +
      `--persist-to "${E2E_STATE}" ` +
      `--env-file "${E2E_VARS}"; ` +
      `code=$?; n=$((n+1)); ` +
      `[ $code -eq 0 ] && exit 0; ` +
      `printf "[webserver] preview exited with %d, restart %d/%d\\n" "$code" "$n" "$max" >&2; ` +
      `done; exit $code'`,
    port: E2E_PORT,
    reuseExistingServer: false,
    // Cold chain (setup script: migrate + seed + build + D1 apply) can take
    // several minutes before preview answers on the port.
    timeout: 600_000,
  },
  testMatch: "**/*.e2e.{ts,js}",
  // The wrangler pages dev server (workerd) crashes under concurrent load
  // ("Broken pipe" kj exceptions), so e2e must run serialized. The webServer
  // restart loop recovers the server; retries let in-flight tests rerun
  // against it after a crash.
  workers: 1,
  // 2 retries locally too: a crash can land mid-test twice in a long run, and
  // each restart window is bounded by the workerd process coming back.
  retries: 2,
  // One crash-restart cycle (documented upstream workerd crash +
  // ~15-30s recovery, see src/routes/e2e-utils.ts) must fit inside a single
  // attempt even in the longest journey test; a crash can poison in-flight
  // interactions until the server (and a reload) return.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
});
