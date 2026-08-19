/// <reference types="node" />
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command:
      "pnpm run db:reset && pnpm run db:seed:d1 && cp .dev.vars.example .dev.vars && pnpm run build && pnpm run d1:migrate && pnpm run d1:seed && pnpm run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  testMatch: "**/*.e2e.{ts,js}",
});
