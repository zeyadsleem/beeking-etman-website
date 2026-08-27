import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

export interface BlendBenefitRow {
  id: string;
  key: string;
  valueAr: string;
  valueEn: string;
  updatedAt: number;
}

/**
 * Returns a single benefit row by key, or `undefined` if none exists.
 */
export async function getBenefit(
  db: LibSQLDatabase<typeof schema>,
  key: string,
): Promise<BlendBenefitRow | undefined> {
  const row = await db
    .select()
    .from(schema.blendBenefit)
    .where(eq(schema.blendBenefit.key, key))
    .get();
  return row ?? undefined;
}

/**
 * Returns all benefit rows as a Map keyed by benefit key.
 */
export async function getAllBenefits(
  db: LibSQLDatabase<typeof schema>,
): Promise<Map<string, BlendBenefitRow>> {
  const rows = await db.select().from(schema.blendBenefit);
  return new Map(rows.map((row) => [row.key, row]));
}

/**
 * Upserts a benefit by key. Creates a new row if the key doesn't exist,
 * or updates the existing row's Arabic and English values.
 */
export async function upsertBenefit(
  db: LibSQLDatabase<typeof schema>,
  key: string,
  valueAr: string,
  valueEn: string,
): Promise<string> {
  const existing = await db
    .select({ id: schema.blendBenefit.id })
    .from(schema.blendBenefit)
    .where(eq(schema.blendBenefit.key, key))
    .get();

  if (existing) {
    await db
      .update(schema.blendBenefit)
      .set({ valueAr, valueEn, updatedAt: Date.now() })
      .where(eq(schema.blendBenefit.key, key));
    return existing.id;
  }

  const [created] = await db
    .insert(schema.blendBenefit)
    .values({ key, valueAr, valueEn })
    .returning({ id: schema.blendBenefit.id });
  return created.id;
}
