import "$lib/server/env";
import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";

// `building` guard: SvelteKit imports this module during the build step
// (postbuild analysis) with no env vars set, and better-auth refuses a
// default secret in production mode. env.ts validates the real values at
// runtime, so the fallbacks below only ever apply during the build.
// Passing `schema` keeps the adapter from touching `db._.fullSchema` at
// construction, so the lazily-resolved D1 driver is never forced early.
export const auth = betterAuth({
  baseURL: env.ORIGIN ?? (building ? "http://localhost:3000" : undefined),
  secret: env.BETTER_AUTH_SECRET ?? (building ? "build-time-secret-0123456789abcdef" : undefined),
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  plugins: [
    sveltekitCookies(getRequestEvent), // make sure this is the last plugin in the array
  ],
});
