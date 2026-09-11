#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const PORT = Number(process.env.E2E_PORT ?? 4173);
const RUN_ID = process.env.E2E_RUN_ID ?? `e2e-${process.pid}-${Date.now()}`;
if (!/^[a-zA-Z0-9_-]+$/.test(RUN_ID)) throw new Error("Invalid E2E_RUN_ID");
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) throw new Error("Invalid E2E_PORT");
const E2E_DIR = resolve(root, ".e2e");
const E2E_DB = resolve(E2E_DIR, `${RUN_ID}.db`);
const E2E_SEED = resolve(E2E_DIR, `${RUN_ID}-seed.sql`);
const E2E_RUNTIME = resolve(tmpdir(), "beeking-e2e", RUN_ID);
const E2E_VARS = resolve(E2E_RUNTIME, ".dev.vars");
const E2E_STATE = resolve(root, ".wrangler", "state", "e2e", RUN_ID);

function log(msg) {
  process.stderr.write(`[e2e-setup] ${msg}\n`);
}

function fail(msg, detail) {
  log(`FAIL: ${msg}`);
  if (detail) process.stderr.write(`${detail}\n`);
  process.exit(1);
}

function run(label, cmd, args, env = {}) {
  log(`${label}: ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    fail(`${label} exited with status ${result.status}`);
  }
}

function rm(target) {
  const result = spawnSync("rm", ["-rf", target], {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (result.status !== 0) fail(`rm -rf ${target} failed`);
}

// 1. Port must be free. We never kill the listener: a developer's running
//    `wrangler pages dev` or `vp dev` is not ours to terminate.
async function assertPortFree(port) {
  await new Promise((res) => {
    const tester = createServer()
      .once("error", (err) =>
        fail(
          `port ${port} is already in use (${err.code ?? err.message}); ` +
            `refusing to kill another process. Stop the owner of that port and retry.`,
        ),
      )
      .once("listening", () => tester.close(() => res()));
    tester.listen(port, "127.0.0.1");
  });
}

await assertPortFree(PORT);

// 2. Prepare isolated directories. .e2e/ and .wrangler/state/e2e/ are both
//    gitignored; nothing in here can leak into the developer's working tree.
mkdirSync(E2E_DIR, { recursive: true });
mkdirSync(dirname(E2E_STATE), { recursive: true });
if (existsSync(E2E_STATE)) rm(E2E_STATE);
mkdirSync(E2E_STATE, { recursive: true });

run("drizzle-kit migrate", "pnpm", ["exec", "drizzle-kit", "migrate"], {
  DATABASE_URL: `file:${E2E_DB}`,
});

// 4. Seed the throwaway libsql DB.
run("db:seed", "pnpm", ["run", "db:seed"], { DATABASE_URL: `file:${E2E_DB}` });

// 5. Export the throwaway DB to a throwaway SQL file. scripts/export-d1-seed.ts
//    accepts the output path as argv[2], so we never write d1-seed.sql.
run("export-d1-seed", "pnpm", ["exec", "tsx", "scripts/export-d1-seed.ts", E2E_SEED], {
  DATABASE_URL: `file:${E2E_DB}`,
});

// 6. Build the app once for the webServer to serve.
if (process.env.E2E_USE_BUILD !== "1") run("build", "pnpm", ["run", "build"]);

// 7. Apply D1 migrations into the isolated miniflare state dir.
run("wrangler d1 migrations apply", "pnpm", [
  "exec",
  "wrangler",
  "d1",
  "migrations",
  "apply",
  "beeking",
  "--local",
  "--persist-to",
  E2E_STATE,
]);

// 8. Apply the throwaway seed SQL into the isolated miniflare state dir.
run("wrangler d1 execute", "pnpm", [
  "exec",
  "wrangler",
  "d1",
  "execute",
  "beeking",
  "--local",
  "--file",
  E2E_SEED,
  "--persist-to",
  E2E_STATE,
]);

mkdirSync(E2E_RUNTIME, { recursive: true });
copyFileSync(resolve(root, "wrangler.jsonc"), resolve(E2E_RUNTIME, "wrangler.jsonc"));
writeFileSync(
  E2E_VARS,
  [
    `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`,
    `ORDER_ACCESS_SECRET=${randomBytes(32).toString("hex")}`,
    `ORIGIN=http://localhost:${PORT}`,
    "ADMIN_EMAIL=e2e@example.com",
    "",
  ].join("\n"),
  { mode: 0o600 },
);

log(
  `ready port=${PORT} run=${RUN_ID} ` +
    `state=${E2E_STATE} db=${E2E_DB} seed=${E2E_SEED} vars=${E2E_VARS}`,
);
