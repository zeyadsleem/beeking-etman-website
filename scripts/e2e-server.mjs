#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const runId = process.env.E2E_RUN_ID;
const port = Number(process.env.E2E_PORT ?? 4173);
if (!runId || !/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error("Invalid E2E_RUN_ID");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid E2E_PORT");

let child;
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    child?.kill(signal);
  });
}

function run(script, args = [], cwd = process.cwd()) {
  return new Promise((res, reject) => {
    child = spawn(process.execPath, [script, ...args], {
      cwd,
      // Never inherit Playwright's stdin: this is a non-interactive server.
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    child.once("error", reject);
    child.once("exit", (code) => res(code ?? 1));
  });
}

const setupCode = await run(resolve("scripts/e2e-setup.mjs"));
if (setupCode !== 0 || stopping) process.exit(setupCode);

const wrangler = resolve(dirname(require.resolve("wrangler/package.json")), "bin/wrangler.js");
const runtimeDir = resolve(tmpdir(), "beeking-e2e", runId);
const args = [
  "pages",
  "dev",
  resolve(".svelte-kit/cloudflare"),
  "--ip",
  "127.0.0.1",
  "--port",
  String(port),
  "--persist-to",
  resolve(".wrangler/state/e2e", runId),
  "--show-interactive-dev-session=false",
];
const code = await run(wrangler, args, runtimeDir);
process.exit(code);
