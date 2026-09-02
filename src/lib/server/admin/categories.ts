import { and, asc, eq, or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { z } from "zod";
import * as schema from "$lib/server/db/schema";

// Slugs are lowercase ASCII words joined by single hyphens — the same shape
// the storefront's category routes already link to (e.g. /category/sidr).
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATEGORY_NAME_MAX = 120;
export const CATEGORY_SLUG_MAX = 120;

interface CategoryInput {
  name: string;
  nameEn: string;
  slug: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-");
}

/**
 * Issue messages double as i18n keys: routes localize them with t() to give
 * the admin exact guidance instead of a generic failure, without duplicating
 * the classification logic outside this module.
 */
export const CATEGORY_SLUG_REQUIRED = "admin.categories.slugRequired";
export const CATEGORY_SLUG_INVALID = "admin.categories.slugInvalid";

/**
 * Validates category form payloads. The slug is optional on intake: a blank
 * slug is auto-generated from nameEn (preferred) or name. A payload whose
 * generated slug is empty — e.g. an Arabic-only name with no English name —
 * fails with the slugRequired issue so the admin supplies one explicitly; a
 * provided-but-malformed slug fails with the slugInvalid issue.
 */
export const categoryInputSchema: z.ZodType<CategoryInput> = z
  .object({
    name: z.string().trim().min(1).max(CATEGORY_NAME_MAX),
    nameEn: z.string().trim().max(CATEGORY_NAME_MAX).default(""),
    slug: z.string().trim().max(CATEGORY_SLUG_MAX).default(""),
  })
  .transform((value) => ({
    ...value,
    slug: value.slug !== "" ? value.slug : slugify(value.nameEn !== "" ? value.nameEn : value.name),
  }))
  .superRefine((value, ctx) => {
    if (value.slug === "") {
      ctx.addIssue({ code: "custom", path: ["slug"], message: CATEGORY_SLUG_REQUIRED });
    } else if (!SLUG_PATTERN.test(value.slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: CATEGORY_SLUG_INVALID });
    }
  });

export interface AdminCategoryRow {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
  productCount: number;
  department: string;
}

export async function listCategoriesWithCounts(
  db: LibSQLDatabase<typeof schema>,
  opts?: { department?: string; query?: string },
): Promise<AdminCategoryRow[]> {
  const conditions: SQL[] = [];
  if (opts?.department) {
    conditions.push(
      or(
        eq(schema.category.department, opts.department),
        sql`${schema.category.department} IS NULL`,
      )!,
    );
  }
  // Same LIKE-escaping contract as the products/orders filters: user-supplied
  // % _ \ are matched literally.
  const needle = opts?.query?.trim() ?? "";
  if (needle !== "") {
    const pattern = `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push(
      or(
        sql`${schema.category.name} LIKE ${pattern} ESCAPE '\\'`,
        sql`${schema.category.nameEn} LIKE ${pattern} ESCAPE '\\'`,
      )!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: schema.category.id,
      name: schema.category.name,
      nameEn: schema.category.nameEn,
      slug: schema.category.slug,
      department: schema.category.department,
      // count(product.id) — not count(*) — keeps empty categories at 0
      // through the left join instead of inflating them to 1.
      productCount: sql<number>`count(${schema.product.id})`,
    })
    .from(schema.category)
    .leftJoin(schema.product, eq(schema.product.categoryId, schema.category.id))
    .where(where)
    .groupBy(schema.category.id)
    .orderBy(asc(schema.category.name));
  return rows.map((row) => ({ ...row, productCount: Number(row.productCount) }));
}

export type CategoryWriteResult = { ok: true; id: string } | { ok: false; reason: "slug_taken" };

export interface CategoryWriteInput {
  id?: string;
  name: string;
  nameEn: string;
  slug: string;
  department?: "honey" | "equipment";
}

export async function upsertCategory(
  db: LibSQLDatabase<typeof schema>,
  input: CategoryWriteInput,
): Promise<CategoryWriteResult> {
  // Select-before-write keeps the failure contract narrow: the unique index
  // stays as a backstop, but callers get the typed `slug_taken` reason instead
  // of a driver-specific constraint error. An update holding its own slug is
  // not a clash, hence the self-exclusion.
  const clash = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(eq(schema.category.slug, input.slug))
    .get();
  if (clash && clash.id !== input.id) return { ok: false, reason: "slug_taken" };

  // Only carry an explicit department so existing rows are never blanked by a
  // form that omits it; inserts without one keep the schema default.
  const values = {
    name: input.name,
    nameEn: input.nameEn,
    slug: input.slug,
    ...(input.department !== undefined ? { department: input.department } : {}),
  };

  if (input.id !== undefined) {
    const updated = await db
      .update(schema.category)
      .set(values)
      .where(eq(schema.category.id, input.id))
      .returning({ id: schema.category.id });
    if (updated[0]) return { ok: true, id: updated[0].id };
    // The row vanished between rendering and submit; honor the write by
    // creating it under the requested id ("upsert").
    const created = await db
      .insert(schema.category)
      .values({ ...values, id: input.id })
      .returning({ id: schema.category.id });
    if (!created[0]) throw new Error("[admin/categories] insert returned no row");
    return { ok: true, id: created[0].id };
  }

  const created = await db
    .insert(schema.category)
    .values(values)
    .returning({ id: schema.category.id });
  if (!created[0]) throw new Error("[admin/categories] insert returned no row");
  return { ok: true, id: created[0].id };
}

export type CategoryDeleteResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "has_products" };

export async function deleteCategory(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<CategoryDeleteResult> {
  const existing = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(eq(schema.category.id, id))
    .get();
  if (!existing) return { ok: false, reason: "not_found" };

  // Deleting a category that still holds products would orphan them (the
  // mirrored DDL carries no enforced FK), so block while any product remains.
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.product)
    .where(eq(schema.product.categoryId, id));
  if (Number(countRow?.count ?? 0) > 0) return { ok: false, reason: "has_products" };

  await db.delete(schema.category).where(eq(schema.category.id, id));
  return { ok: true };
}
