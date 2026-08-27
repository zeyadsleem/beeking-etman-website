import { desc, eq, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

export type AuditTargetType = "order" | "product" | "category";

export interface AuditLogEntry {
  id: string;
  adminUserId: string | null;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  details: string | null;
  createdAt: number;
}

/**
 * Best-effort audit logger. Failures are logged to console but never
 * propagated — audit must never block the originating admin action.
 */
export function logAdminAction(
  db: LibSQLDatabase<typeof schema>,
  opts: {
    action: string;
    targetType: AuditTargetType;
    targetId: string;
    details?: Record<string, unknown>;
    userId?: string;
  },
): void {
  db.insert(schema.adminAudit)
    .values({
      adminUserId: opts.userId ?? null,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      details: opts.details ? JSON.stringify(opts.details) : null,
      createdAt: Date.now(),
    })
    .then(() => {
      /* success — no-op */
    })
    .catch((error: unknown) => {
      console.error("[audit] failed to write audit log", error);
    });
}

export const AUDIT_PAGE_SIZE = 20;

export async function listAuditLogs(
  db: LibSQLDatabase<typeof schema>,
  opts?: { limit?: number; offset?: number; targetType?: AuditTargetType },
): Promise<{ items: AuditLogEntry[]; total: number }> {
  const limit = opts?.limit ?? AUDIT_PAGE_SIZE;
  const offset = opts?.offset ?? 0;
  const where: SQL | undefined = opts?.targetType
    ? eq(schema.adminAudit.targetType, opts.targetType)
    : undefined;

  const rows = await db
    .select()
    .from(schema.adminAudit)
    .where(where)
    .orderBy(desc(schema.adminAudit.createdAt), desc(schema.adminAudit.id))
    .limit(limit)
    .offset(offset);

  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.adminAudit)
    .where(where);

  return {
    items: rows.map((row) => ({
      ...row,
      adminUserId: row.adminUserId ?? null,
      details: row.details ?? null,
      targetType: row.targetType as AuditTargetType,
    })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}
