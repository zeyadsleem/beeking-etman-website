import { and, eq } from "drizzle-orm";
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
  // Promote only verified owners (T1): without this, anyone who registers the
  // ADMIN_EMAIL address before the operator would gain permanent admin.
  const result = await db
    .update(schema.user)
    .set({ role: "admin" })
    .where(
      and(eq(schema.user.email, email.trim().toLowerCase()), eq(schema.user.emailVerified, true)),
    )
    .run();
  return result.rowsAffected > 0;
}
