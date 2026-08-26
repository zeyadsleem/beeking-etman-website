import { and, asc, desc, eq, or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { z } from "zod";
import * as schema from "$lib/server/db/schema";

// Slug candidates follow the storefront's lowercase ASCII words joined by
// single hyphens; an Arabic-only source folds to nothing and falls back to
// "product" so a create never fails for lack of slug characters.
const SLUG_SUFFIX_PATTERN = /^-\d+$/;

const PRODUCT_NAME_MAX = 200;
const PRODUCT_DESCRIPTION_MAX = 5000;
const VARIANT_NAME_MAX = 80;
// Probe budget for slug conflict resolution: base, then -2 … -20 before the
// write is reported as slug_taken instead of looping forever.
const MAX_SLUG_PROBES = 20;

export interface ProductInput {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  price: number;
  categoryId: string;
  featured: boolean;
}

export const productInputSchema: z.ZodType<ProductInput> = z.object({
  name: z.string().trim().min(1).max(PRODUCT_NAME_MAX),
  nameEn: z.string().trim().max(PRODUCT_NAME_MAX).default(""),
  description: z.string().trim().min(1).max(PRODUCT_DESCRIPTION_MAX),
  descriptionEn: z.string().trim().max(PRODUCT_DESCRIPTION_MAX).default(""),
  price: z.number().int().positive(),
  categoryId: z.string().min(1),
  featured: z.boolean().default(false),
});

export interface VariantInput {
  name: string;
  nameEn: string;
  price: number;
  stock: number;
  image: string;
  sortOrder: number;
}

export const variantInputSchema: z.ZodType<VariantInput> = z.object({
  name: z.string().trim().min(1).max(VARIANT_NAME_MAX),
  nameEn: z.string().trim().max(VARIANT_NAME_MAX).default(""),
  price: z.number().int().positive(),
  stock: z.number().int().min(0),
  // The gallery field is optional at intake: "" means "no image pasted yet",
  // anything non-empty must be a real URL.
  image: z.union([z.literal(""), z.string().url().startsWith("https://")]).default(""),
  sortOrder: z.number().int().default(0),
});

export function generateSlug(source: string): string {
  const slug = source
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-");
  return slug === "" ? "product" : slug;
}

export const PRODUCTS_PAGE_SIZE = 20;

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  price: number;
  featured: boolean;
  categoryName: string;
  totalStock: number;
  variantCount: number;
  createdAt: number;
}

interface AdminProductDetailRow extends AdminProductRow {
  description: string;
  descriptionEn: string;
}

/**
 * Shared read for the list page and the edit page: one left join per child
 * table with GROUP BY product keeps totals right (count(variant.id) stays 0
 * for variantless products through the left join) without N+1 queries.
 * limit/offset paginate in SQL; they are only passed by the list path.
 */
async function fetchAdminProductRows(
  db: LibSQLDatabase<typeof schema>,
  where: SQL | undefined,
  range?: { limit: number; offset: number },
): Promise<AdminProductDetailRow[]> {
  const rows = await db
    .select({
      id: schema.product.id,
      name: schema.product.name,
      slug: schema.product.slug,
      description: schema.product.description,
      descriptionEn: schema.product.descriptionEn,
      price: schema.product.price,
      featured: schema.product.featured,
      createdAt: schema.product.createdAt,
      categoryName: schema.category.name,
      totalStock: sql<number>`coalesce(sum(${schema.productVariant.stock}), 0)`,
      variantCount: sql<number>`count(${schema.productVariant.id})`,
    })
    .from(schema.product)
    .leftJoin(schema.category, eq(schema.category.id, schema.product.categoryId))
    .leftJoin(schema.productVariant, eq(schema.productVariant.productId, schema.product.id))
    .where(where)
    .groupBy(schema.product.id)
    .orderBy(desc(schema.product.createdAt), desc(schema.product.id))
    .limit(range?.limit ?? -1)
    .offset(range?.offset ?? 0);
  return rows.map((row) => ({
    ...row,
    // A product whose category row vanished (SQLite does not enforce the FK)
    // still lists rather than crashing the admin page.
    categoryName: row.categoryName ?? "",
    featured: Boolean(row.featured),
    totalStock: Number(row.totalStock),
    variantCount: Number(row.variantCount),
  }));
}

function toAdminProductRow(row: AdminProductDetailRow): AdminProductRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    featured: row.featured,
    categoryName: row.categoryName,
    totalStock: row.totalStock,
    variantCount: row.variantCount,
    createdAt: row.createdAt,
  };
}

/**
 * LIKE filter over both display names. User-supplied % _ \\ are escaped and
 * matched literally via ESCAPE '\', so searching "50%" finds "50% off"
 * instead of everything.
 */
function buildNameFilter(query: string | undefined): SQL | undefined {
  const needle = query?.trim() ?? "";
  if (needle === "") return undefined;
  const pattern = `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return or(
    sql`${schema.product.name} LIKE ${pattern} ESCAPE '\\'`,
    sql`${schema.product.nameEn} LIKE ${pattern} ESCAPE '\\'`,
  );
}

export async function listAdminProducts(
  db: LibSQLDatabase<typeof schema>,
  opts?: { query?: string; page?: number },
): Promise<{ items: AdminProductRow[]; total: number }> {
  const requestedPage = opts?.page ?? 1;
  const page = Math.max(1, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1);
  const where = buildNameFilter(opts?.query);

  const rows = await fetchAdminProductRows(db, where, {
    limit: PRODUCTS_PAGE_SIZE,
    offset: (page - 1) * PRODUCTS_PAGE_SIZE,
  });

  const totalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.product)
    .where(where);

  return {
    items: rows.map(toAdminProductRow),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export async function getProductForEdit(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<{
  product: AdminProductRow & { description: string; descriptionEn: string };
  variants: Array<VariantInput & { id: string }>;
} | null> {
  const [row] = await fetchAdminProductRows(db, eq(schema.product.id, id));
  if (!row) return null;

  const variants = await db
    .select({
      id: schema.productVariant.id,
      name: schema.productVariant.name,
      nameEn: schema.productVariant.nameEn,
      price: schema.productVariant.price,
      stock: schema.productVariant.stock,
      image: schema.productVariant.image,
      sortOrder: schema.productVariant.sortOrder,
    })
    .from(schema.productVariant)
    .where(eq(schema.productVariant.productId, id))
    .orderBy(asc(schema.productVariant.sortOrder), asc(schema.productVariant.name));

  return { product: row, variants };
}

export type ProductWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" | "category_missing" };

async function categoryExists(
  db: LibSQLDatabase<typeof schema>,
  categoryId: string,
): Promise<boolean> {
  const row = await db
    .select({ id: schema.category.id })
    .from(schema.category)
    .where(eq(schema.category.id, categoryId))
    .get();
  return row !== undefined;
}

/**
 * True when the stored slug was derived from this base — either identical or
 * carrying only the auto-suffix (-2, -3…). An edit form resubmitting the same
 * base must keep the stored slug exactly: storefront links point at it, so
 * silently re-probing onto a shorter free candidate would break them.
 */
function slugDerivesFromBase(existingSlug: string, base: string): boolean {
  if (!existingSlug.startsWith(base)) return false;
  const suffix = existingSlug.slice(base.length);
  return suffix === "" || SLUG_SUFFIX_PATTERN.test(suffix);
}

/**
 * Returns the first free candidate among base, base-2 … base-N, or null once
 * the probe budget is exhausted (caller reports slug_taken). excludeProductId
 * lets an update ignore the row it is updating itself.
 */
async function probeAvailableSlug(
  db: LibSQLDatabase<typeof schema>,
  base: string,
  excludeProductId?: string,
): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_SLUG_PROBES; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const clash = await db
      .select({ id: schema.product.id })
      .from(schema.product)
      .where(eq(schema.product.slug, candidate))
      .get();
    if (!clash || clash.id === excludeProductId) return candidate;
  }
  return null;
}

/**
 * Column set written by create/update. Product-level stock/image are legacy
 * columns that the admin form does not carry (stock lives on variants); they
 * are zeroed/emptied explicitly because the mirrored DDL has no defaults for
 * image. featured rides the existing integer column.
 */
interface ProductWriteValues {
  name: string;
  nameEn: string;
  slug: string;
  description: string;
  descriptionEn: string;
  price: number;
  stock: number;
  image: string;
  categoryId: string;
  featured: number;
}

function productWriteValues(input: ProductInput, slug: string): ProductWriteValues {
  return {
    name: input.name,
    nameEn: input.nameEn,
    slug,
    description: input.description,
    descriptionEn: input.descriptionEn,
    price: input.price,
    stock: 0,
    image: "",
    categoryId: input.categoryId,
    featured: input.featured ? 1 : 0,
  };
}

export async function createProduct(
  db: LibSQLDatabase<typeof schema>,
  input: ProductInput,
  slug: string,
): Promise<ProductWriteResult> {
  if (!(await categoryExists(db, input.categoryId))) {
    return { ok: false, reason: "category_missing" };
  }

  const finalSlug = await probeAvailableSlug(db, slug);
  if (!finalSlug) return { ok: false, reason: "slug_taken" };

  const created = await db
    .insert(schema.product)
    .values(productWriteValues(input, finalSlug))
    .returning({ id: schema.product.id });
  if (!created[0]) throw new Error("[admin/products] insert returned no row");
  return { ok: true, id: created[0].id };
}

export async function updateProduct(
  db: LibSQLDatabase<typeof schema>,
  id: string,
  input: ProductInput,
  slug: string,
): Promise<ProductWriteResult> {
  if (!(await categoryExists(db, input.categoryId))) {
    return { ok: false, reason: "category_missing" };
  }

  const existing = await db
    .select({ id: schema.product.id, slug: schema.product.slug })
    .from(schema.product)
    .where(eq(schema.product.id, id))
    .get();

  let finalSlug: string | null;
  if (existing && slugDerivesFromBase(existing.slug, slug)) {
    finalSlug = existing.slug;
  } else {
    finalSlug = await probeAvailableSlug(db, slug, id);
    if (!finalSlug) return { ok: false, reason: "slug_taken" };
  }

  const values = productWriteValues(input, finalSlug);
  const updated = await db
    .update(schema.product)
    .set(values)
    .where(eq(schema.product.id, id))
    .returning({ id: schema.product.id });
  if (updated[0]) return { ok: true, id: updated[0].id };
  // The row vanished between rendering and submit; honor the write by
  // creating it under the requested id ("upsert") — same decision as
  // upsertCategory in the sibling service.
  const created = await db
    .insert(schema.product)
    .values({ ...values, id })
    .returning({ id: schema.product.id });
  if (!created[0]) throw new Error("[admin/products] insert returned no row");
  return { ok: true, id: created[0].id };
}

export type ProductDeleteResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "referenced_by_orders" };

export async function deleteProduct(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<ProductDeleteResult> {
  const existing = await db
    .select({ id: schema.product.id })
    .from(schema.product)
    .where(eq(schema.product.id, id))
    .get();
  if (!existing) return { ok: false, reason: "not_found" };

  // order_item rows store productId + variantName denormalized, so deleting a
  // purchased product would corrupt historical line items — block instead.
  const reference = await db
    .select({ id: schema.orderItem.id })
    .from(schema.orderItem)
    .where(eq(schema.orderItem.productId, id))
    .get();
  if (reference) return { ok: false, reason: "referenced_by_orders" };

  // Children first (images → variants → product); SQLite does not enforce the
  // declared FKs, so nothing cascades on our behalf.
  await db.batch([
    db.delete(schema.productImage).where(eq(schema.productImage.productId, id)),
    db.delete(schema.productVariant).where(eq(schema.productVariant.productId, id)),
    db.delete(schema.product).where(eq(schema.product.id, id)),
  ]);
  return { ok: true };
}

export type VariantWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "name_taken" | "product_missing" };

export async function upsertVariant(
  db: LibSQLDatabase<typeof schema>,
  productId: string,
  input: VariantInput & { id?: string },
): Promise<VariantWriteResult> {
  const product = await db
    .select({ id: schema.product.id })
    .from(schema.product)
    .where(eq(schema.product.id, productId))
    .get();
  if (!product) return { ok: false, reason: "product_missing" };

  // Select-before-write mirrors upsertCategory: the unique index
  // store_product_variant(product_id, name) stays as a backstop while callers
  // get the typed name_taken reason; an update holding its own name is not a
  // clash.
  const clash = await db
    .select({ id: schema.productVariant.id })
    .from(schema.productVariant)
    .where(
      and(
        eq(schema.productVariant.productId, productId),
        eq(schema.productVariant.name, input.name),
      ),
    )
    .get();
  if (clash && clash.id !== input.id) return { ok: false, reason: "name_taken" };

  const values = {
    productId,
    name: input.name,
    nameEn: input.nameEn,
    price: input.price,
    stock: input.stock,
    image: input.image,
    sortOrder: input.sortOrder,
  };

  if (input.id !== undefined) {
    const updated = await db
      .update(schema.productVariant)
      .set(values)
      // Scoped to the parent product so a forged hidden field cannot move a
      // variant across products.
      .where(
        and(eq(schema.productVariant.id, input.id), eq(schema.productVariant.productId, productId)),
      )
      .returning({ id: schema.productVariant.id });
    if (updated[0]) return { ok: true, id: updated[0].id };

    // The scoped UPDATE matched nothing: either the id belongs to a variant of
    // a different product (forged or stale hidden field) or the row vanished
    // between rendering and submit. Only a genuine vanish may take the
    // recreate-under-id path; a cross-product id is rejected with the typed
    // product_missing reason instead of crashing on the primary key.
    const owner = await db
      .select({ productId: schema.productVariant.productId })
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, input.id))
      .get();
    if (owner) return { ok: false, reason: "product_missing" };

    // The row vanished; honor the write under the requested id, matching the
    // sibling service's upsert behavior.
    const created = await db
      .insert(schema.productVariant)
      .values({ ...values, id: input.id })
      .returning({ id: schema.productVariant.id });
    if (!created[0]) throw new Error("[admin/products] variant insert returned no row");
    return { ok: true, id: created[0].id };
  }

  const created = await db
    .insert(schema.productVariant)
    .values(values)
    .returning({ id: schema.productVariant.id });
  if (!created[0]) throw new Error("[admin/products] variant insert returned no row");
  return { ok: true, id: created[0].id };
}

export async function deleteVariant(
  db: LibSQLDatabase<typeof schema>,
  id: string,
  productId?: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const condition = productId
    ? and(eq(schema.productVariant.id, id), eq(schema.productVariant.productId, productId))
    : eq(schema.productVariant.id, id);
  const deleted = await db
    .delete(schema.productVariant)
    .where(condition)
    .returning({ id: schema.productVariant.id });
  if (deleted[0]) return { ok: true };
  return { ok: false, reason: "not_found" };
}
