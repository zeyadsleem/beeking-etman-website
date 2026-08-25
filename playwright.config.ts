/// <reference types="node" />
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command:
      // A crashed run can leave a detached workerd squatting the e2e port;
      // reusing it would skip the reset chain and test a stale build. Free
      // the port first so every invocation runs the full reset chain.
      //
      // The miniflare D1 lives in an isolated, wiped-every-run directory
      // (--persist-to) instead of the default .wrangler/state/v3: sharing
      // that SQLite WAL between this server and a concurrently running dev
      // server crashes workerd on the first D1 write ("Network connection
      // lost"). A fresh database also makes rate-limit budgets start at
      // zero, so no store_rate_limit wipe step is needed.
      `fuser -k ${process.env.E2E_PORT ?? 4173}/tcp >/dev/null 2>&1 || true; sleep 1 && export E2E_D1_STATE="$PWD/.wrangler/state/e2e" && rm -rf "$E2E_D1_STATE" && mkdir -p "$E2E_D1_STATE" && pnpm run db:reset && pnpm run db:seed:d1 && cp .dev.vars.example .dev.vars && pnpm run build && pnpm exec wrangler d1 migrations apply beeking --local --persist-to "$E2E_D1_STATE" && pnpm exec wrangler d1 execute beeking --local --file=d1-seed.sql --persist-to "$E2E_D1_STATE" >/dev/null && sh -c 'while :; do pnpm exec wrangler pages dev .svelte-kit/cloudflare --port ${process.env.E2E_PORT ?? 4173} --persist-to "$E2E_D1_STATE"; echo "[webserver] preview exited, restarting" >&2; sleep 1; done'`,
    port: Number(process.env.E2E_PORT ?? 4173),
    reuseExistingServer: !process.env.CI,
    // Cold chain (reset + seed export + build + isolated-database setup) can
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
