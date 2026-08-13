/// <reference types="node" />
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "pnpm run db:reset && pnpm run build && pnpm run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  testMatch: "**/*.e2e.{ts,js}",
});
