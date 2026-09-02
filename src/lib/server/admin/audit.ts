import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

export type AuditTargetType = "order" | "product" | "category" | "user" | "warehouse";

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
  opts?: {
    limit?: number;
    offset?: number;
    targetType?: AuditTargetType;
    query?: string;
  },
): Promise<{ items: AuditLogEntry[]; total: number }> {
  const limit = opts?.limit ?? AUDIT_PAGE_SIZE;
  const offset = opts?.offset ?? 0;
  const conditions: SQL[] = [];
  if (opts?.targetType) {
    conditions.push(eq(schema.adminAudit.targetType, opts.targetType));
  }
  // Same LIKE-escaping contract as the products/orders/categories filters:
  // user-supplied % _ \ are matched literally.
  const needle = opts?.query?.trim() ?? "";
  if (needle !== "") {
    const pattern = `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push(
      or(
        sql`${schema.adminAudit.action} LIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.adminAudit.targetType} LIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.adminAudit.targetId} LIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }
  const where: SQL | undefined = conditions.length ? and(...conditions) : undefined;

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
