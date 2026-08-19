import "$lib/server/env";
import { building } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql, type LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { env } from "$env/dynamic/private";
import * as schema from "./schema";

let instance: LibSQLDatabase<typeof schema> | null = null;

function createLibsqlDatabase(): LibSQLDatabase<typeof schema> {
  // SvelteKit imports this module during the build step (postbuild analysis)
  // with `building = true` and no env vars; keep construction inert then — the
  // client is never used. At runtime a missing DATABASE_URL fails fast.
  if (!env.DATABASE_URL && !building) throw new Error("DATABASE_URL is not set");
  const client = createClient({ url: env.DATABASE_URL ?? "file:build-time.db" });
  return drizzleLibsql(client, { schema });
}

// On Cloudflare Pages the D1 binding is only reachable through the current
// request (`platform.env.DB`); modules are evaluated before the platform is
// bound, so construction must be deferred to first use (always inside a
// request) and cached for the worker lifetime. Outside a request we fall back
// to libsql (local dev, tests, build analysis).
export function getDb(): LibSQLDatabase<typeof schema> {
  if (instance) return instance;
  let event: ReturnType<typeof getRequestEvent> | null = null;
  try {
    event = getRequestEvent();
  } catch {
    event = null;
  }
  const d1 = event?.platform?.env?.DB;
  if (d1) {
    // D1 speaks the same async SQLite dialect as libsql; the D1 drizzle
    // client is structurally compatible with LibSQLDatabase, so bridge once.
    instance = drizzleD1(d1, { schema }) as unknown as LibSQLDatabase<typeof schema>;
    return instance;
  }
  instance = createLibsqlDatabase();
  return instance;
}

// `db` resolves the driver lazily on first property access so module-scope
// consumers (hooks, auth, rate limiter) can import it without forcing a
// connection before the platform is available.
export const db: LibSQLDatabase<typeof schema> = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get: (target, prop) => {
    if (prop === "then") return undefined; // never let the proxy be awaited
    const resolved = getDb();
    return Reflect.get(resolved, prop, resolved);
  },
});
