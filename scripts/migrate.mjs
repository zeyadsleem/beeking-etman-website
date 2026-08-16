// Runtime migration runner for the production container. Runs Drizzle
// migrations from `drizzle/` against DATABASE_URL before the app boots so a
// fresh deployment never starts with an empty schema. Plain ESM so it needs no
// toolchain in the runtime image (uses only `dependencies`: @libsql/client +
// drizzle-orm).
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:local.db";
const db = drizzle(createClient({ url }));
const migrationsFolder = new URL("../drizzle/", import.meta.url).pathname;

await migrate(db, { migrationsFolder });
console.log(`Migrations applied (${url})`);
