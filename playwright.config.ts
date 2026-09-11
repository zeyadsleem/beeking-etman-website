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
    timeout: 300_000,
  },
  testMatch: "**/*.e2e.{ts,js}",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
});
