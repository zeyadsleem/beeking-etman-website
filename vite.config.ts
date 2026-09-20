import tailwindcss from "@tailwindcss/vite";
import { defineConfig, lazyPlugins } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  plugins: lazyPlugins(() => [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      adapter: adapter(),
      typescript: {
        config: (config) => {
          config.include.push("../drizzle.config.ts");
        },
      },
    }),
  ]),
  test: {
    expect: { requireAssertions: true },
    // Coverage is a global Vitest option (per-project coverage is unsupported),
    // scoped to the settlement modules the M1 launch gate depends on. The
    // browser project contributes no settlement files, so the floor only
    // measures the server project's suites. Floors sit just below the
    // 2026-09-20 measurement; see docs/production-runbook.md "Coverage floor".
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib/server/settlement/**/*.ts", "src/lib/server/admin/settlement.ts"],
      exclude: ["**/*.spec.ts", "**/*.test.ts"],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
        "src/lib/server/settlement/lifecycle.ts": {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
        "src/lib/server/settlement/expiry.ts": {
          statements: 90,
          branches: 88,
          functions: 95,
          lines: 90,
        },
        "src/lib/server/settlement/claims.ts": {
          statements: 80,
          branches: 75,
          functions: 95,
          lines: 80,
        },
        "src/lib/server/settlement/config.ts": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "src/lib/server/settlement/whatsapp.ts": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "src/lib/server/admin/settlement.ts": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
    projects: [
      {
        extends: "./vite.config.ts",
        test: {
          name: "client",
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium", headless: true }],
          },
          include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          exclude: ["src/lib/server/**"],
        },
      },

      {
        extends: "./vite.config.ts",
        test: {
          name: "server",
          environment: "node",
          include: ["src/**/*.{test,spec}.{js,ts}"],
          exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          testTimeout: 15_000,
          // The suite runs many SQLite-backed specs in parallel. A full run
          // produced hook timeouts under load while every file passed in
          // isolation (review finding F1). Give DB-heavy hooks headroom and
          // cap the worker count so contention stays bounded. Vitest 4 needs
          // a unique groupOrder when projects differ in maxWorkers.
          hookTimeout: 60_000,
          maxWorkers: 4,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
