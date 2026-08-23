/// <reference types="node" />
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command:
      // A crashed run can leave a detached workerd squatting :4173; reusing it
      // would skip the reset chain and test a stale build. Free the port first
      // so every invocation runs db:reset + seeds + d1:clear-limits.
      "fuser -k 4173/tcp >/dev/null 2>&1 || true; sleep 1 && pnpm run db:reset && pnpm run db:seed:d1 && cp .dev.vars.example .dev.vars && pnpm run build && pnpm run d1:migrate && pnpm run d1:seed && pnpm run d1:clear-limits && sh -c 'while :; do pnpm run preview; echo \"[webserver] preview exited, restarting\" >&2; sleep 1; done'",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    // d1:clear-limits wipes store_rate_limit (register/login/address buckets)
    // because local D1 outlives runs: without it, the register limit of
    // 5/hour/IP makes the suite fail on any second run within the hour.
    // Cold chain (reset + seed export + build ×2 + migrations + seeds) can
    // take several minutes before preview answers on the port.
    timeout: 600_000,
  },
  testMatch: "**/*.e2e.{ts,js}",
  // The wrangler pages dev server (workerd) crashes under concurrent load
  // ("Broken pipe" kj exceptions), so e2e must run serialized. The webServer
  // restart loop recovers the server; retries let in-flight tests rerun
  // against it after a crash.
  workers: 1,
  // 2 retries locally too: a crash can land mid-test twice in a long run, and
  // each restart window is ~15-30s (see gotoWithRestartRetry in e2e-utils).
  retries: 2,
  // One crash-restart cycle must fit inside a single attempt: a crash can
  // poison in-flight interactions until the server (and a reload) return.
  timeout: 90_000,
  expect: { timeout: 10_000 },
});
