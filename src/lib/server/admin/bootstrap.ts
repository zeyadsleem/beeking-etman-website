import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

/** Minimal env surface this module needs; satisfied by $env/dynamic/private. */
export interface AdminEnv {
  readonly ADMIN_EMAIL?: string | undefined;
}

export function isAdminEmail(email: string, env: AdminEnv): boolean {
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(adminEmail) && email.trim().toLowerCase() === adminEmail;
}

export async function promoteAdminByEmail(
  db: LibSQLDatabase<typeof schema>,
  email: string,
  env: AdminEnv,
): Promise<boolean> {
  if (!isAdminEmail(email, env)) return false;
  const result = await db
    .update(schema.user)
    .set({ role: "admin" })
    .where(eq(schema.user.email, email.trim().toLowerCase()))
    .run();
  return result.rowsAffected > 0;
}
