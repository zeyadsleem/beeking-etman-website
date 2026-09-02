import { or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

export interface AdminCustomerRow {
  email: string;
  name: string;
  phone: string;
  city: string;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: number;
}

export const CUSTOMERS_PAGE_SIZE = 20;

const orderByLastOrderAt = sql<number>`max(${schema.order.createdAt}) desc`;

// A customer is every distinct billing email that has placed at least one
// order. Name/phone/city are snapshots taken from the customer's orders —
// `max()` picks the alphabetically last value, which is a stable-enough
// identity for an admin CRM view; counts and spend are exact aggregates.
export async function listCustomers(
  db: LibSQLDatabase<typeof schema>,
  opts?: { page?: number; query?: string },
): Promise<{ items: AdminCustomerRow[]; total: number }> {
  const page = Math.max(1, Math.trunc(opts?.page ?? 1));

  const needle = opts?.query?.trim() ?? "";
  let where: SQL | undefined;
  if (needle !== "") {
    const pattern = `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    where = or(
      sql`${schema.order.email} LIKE ${pattern} ESCAPE '\\'`,
      sql`${schema.order.name} LIKE ${pattern} ESCAPE '\\'`,
      sql`${schema.order.phone} LIKE ${pattern} ESCAPE '\\'`,
    )!;
  }

  const rows = await db
    .select({
      email: schema.order.email,
      name: sql<string>`max(${schema.order.name})`,
      phone: sql<string>`max(${schema.order.phone})`,
      city: sql<string>`max(${schema.order.city})`,
      orderCount: sql<number>`count(*)`,
      totalSpend: sql<number>`sum(${schema.order.total})`,
      lastOrderAt: sql<number>`max(${schema.order.createdAt})`,
    })
    .from(schema.order)
    .where(where)
    .groupBy(schema.order.email)
    .orderBy(orderByLastOrderAt)
    .limit(CUSTOMERS_PAGE_SIZE)
    .offset((page - 1) * CUSTOMERS_PAGE_SIZE);

  const totalRows = await db
    .select({ total: sql<number>`count(distinct ${schema.order.email})` })
    .from(schema.order)
    .where(where);

  return {
    items: rows.map((row) => ({
      email: row.email,
      name: row.name,
      phone: row.phone,
      city: row.city,
      orderCount: Number(row.orderCount ?? 0),
      totalSpend: Number(row.totalSpend ?? 0),
      lastOrderAt: Number(row.lastOrderAt ?? 0),
    })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}
