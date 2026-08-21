/// <reference types="node" />
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command:
      "pnpm run db:reset && pnpm run db:seed:d1 && cp .dev.vars.example .dev.vars && pnpm run build && pnpm run d1:migrate && pnpm run d1:seed && sh -c 'while :; do pnpm run preview; echo \"[webserver] preview exited, restarting\" >&2; sleep 1; done'",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  testMatch: "**/*.e2e.{ts,js}",
  // The wrangler pages dev server (workerd) crashes under concurrent load
  // ("Broken pipe" kj exceptions), so e2e must run serialized. The webServer
  // restart loop recovers the server; retries let in-flight tests rerun
  // against it after a crash.
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  expect: { timeout: 10_000 },
});
