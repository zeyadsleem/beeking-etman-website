import { and, desc, eq, ne, or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { logAdminAction } from "$lib/server/admin/audit";
import {
  USER_ROLES,
  type UserRole,
  ADMIN_ROLES,
  ROLE_MANAGER_ROLES,
  isUserRole,
  isAdminRole,
  isRoleManager,
} from "$lib/admin-roles";

export {
  USER_ROLES,
  type UserRole,
  ADMIN_ROLES,
  ROLE_MANAGER_ROLES,
  isUserRole,
  isAdminRole,
  isRoleManager,
} from "$lib/admin-roles";

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole | null;
  createdAt: number;
  updatedAt: number;
}

export const USERS_PAGE_SIZE = 20;

function rowToUser(row: typeof schema.user.$inferSelect): AdminUserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: isUserRole(row.role) ? row.role : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : Number(row.updatedAt),
  };
}

export async function listUsers(
  db: LibSQLDatabase<typeof schema>,
  opts?: { page?: number; query?: string },
): Promise<{ items: AdminUserRow[]; total: number }> {
  const page = Math.max(1, Math.trunc(opts?.page ?? 1));
  const needle = opts?.query?.trim() ?? "";
  const conditions: SQL[] = [];
  if (needle !== "") {
    const pattern = `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push(
      or(
        sql`${schema.user.email} LIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.user.name} LIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }
  const where: SQL | undefined = conditions.length ? and(...conditions) : undefined;

  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.user)
    .where(where);
  const total = Number(totalRows[0]?.total ?? 0);

  const rows = await db
    .select()
    .from(schema.user)
    .where(where)
    .orderBy(desc(schema.user.createdAt), desc(schema.user.id))
    .limit(USERS_PAGE_SIZE)
    .offset((page - 1) * USERS_PAGE_SIZE);

  return { items: rows.map(rowToUser), total };
}

export type UpdateRoleResult =
  | { ok: true; id: string }
  | { ok: false; reason: "notFound" | "invalidRole" | "lastSuperAdmin" | "unchanged" };

/**
 * Assign a role to a user. Only `super-admin` is allowed to change roles; this
 * is enforced by the caller passing through `isRoleManager`. The last
 * `super-admin` on the account can never be demoted (keeps the dashboard
 * recoverable). Writes an audit entry as a side effect.
 */
export async function updateUserRole(
  db: LibSQLDatabase<typeof schema>,
  targetUserId: string,
  role: string,
  actor?: { id?: string; role?: string | null },
): Promise<UpdateRoleResult> {
  if (!isUserRole(role)) return { ok: false, reason: "invalidRole" };
  if (actor && !isRoleManager(actor.role)) return { ok: false, reason: "invalidRole" };

  const target = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, targetUserId))
    .limit(1);
  const existing = target[0];
  if (!existing) return { ok: false, reason: "notFound" };

  if (existing.role === role) return { ok: false, reason: "unchanged" };

  // Never demote the last super-admin.
  if (existing.role === "super-admin" && role !== "super-admin") {
    const superAdmins = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(and(eq(schema.user.role, "super-admin"), ne(schema.user.id, targetUserId)))
      .limit(1);
    if (superAdmins.length === 0) return { ok: false, reason: "lastSuperAdmin" };
  }

  await db.update(schema.user).set({ role }).where(eq(schema.user.id, targetUserId)).run();

  logAdminAction(db, {
    action: "role.update",
    targetType: "user",
    targetId: targetUserId,
    details: { from: existing.role, to: role },
    userId: actor?.id,
  });

  return { ok: true, id: targetUserId };
}
