/// <reference types="node" />
import { defineConfig } from "@playwright/test";
import path from "node:path";

// Single source of truth for the isolated miniflare D1 directory: the
// webServer chain and test-process helpers (clearRateLimitRows, setUserRole)
// must target the same database.
const E2E_PORT = Number(process.env.E2E_PORT ?? 4173);
const E2E_RUN_ID = process.env.E2E_RUN_ID ?? `${process.pid}-${Date.now()}`;
const E2E_STATE = path.resolve(".wrangler/state/e2e", E2E_RUN_ID);
process.env.E2E_RUN_ID = E2E_RUN_ID;
process.env.E2E_D1_STATE = E2E_STATE;
process.env.E2E_PORT ??= String(E2E_PORT);

export default defineConfig({
  use: { baseURL: `http://localhost:${E2E_PORT}` },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://127.0.0.1:${E2E_PORT}/api/health`,
    stdout: "pipe",
    stderr: "pipe",
    reuseExistingServer: false,
    // Cold chain (setup script: migrate + seed + build + D1 apply) can
    // take several minutes in CI before preview answers on the port.  The
    // extra headroom covers the full build + cold workerd download.
    timeout: 900_000,
  },
  testMatch: "**/*.e2e.{ts,js}",
  // The wrangler pages dev server (workerd) crashes under concurrent load
  // ("Broken pipe" kj exceptions), so e2e must run serialized. The webServer
  // restart loop recovers the server; retries let in-flight tests rerun
  // against it after a crash.
  workers: 1,
  // 2 retries locally too: a crash can land mid-test twice in a long run, and
  // each restart window is bounded by the workerd process coming back.
  retries: process.env.CI ? 1 : 2,
  // One crash-restart cycle (documented upstream workerd crash +
  // ~15-30s recovery, see src/routes/e2e-utils.ts) must fit inside a single
  // attempt even in the longest journey test; a crash can poison in-flight
  // interactions until the server (and a reload) return.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
});
