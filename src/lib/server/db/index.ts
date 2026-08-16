import "$lib/server/env";
import { building } from "$app/environment";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { env } from "$env/dynamic/private";

// SvelteKit imports this module during the build step (postbuild analysis)
// with `building = true` and no env vars; keep construction inert then — the
// client is never used. At runtime a missing DATABASE_URL fails fast.
if (!env.DATABASE_URL && !building) throw new Error("DATABASE_URL is not set");

const client = createClient({ url: env.DATABASE_URL ?? "file:build-time.db" });

export const db = drizzle(client, { schema });
