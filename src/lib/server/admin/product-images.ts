/**
 * Gallery (store_product_image) and cover-image management for the admin
 * product editor. This is where the storefront-facing imagery is written:
 * the legacy `product.image` column is synced as a fallback/SEO value, and a
 * cover upload also becomes the image of a single-variant product so cards
 * and the first gallery slot reflect it immediately (decision D1/D2 of the
 * admin-ops plan). Gallery rows drive the storefront's extra images.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

export interface AdminGalleryImage {
  id: string;
  url: string;
  sortOrder: number;
}

export async function listProductImages(
  db: LibSQLDatabase<typeof schema>,
  productId: string,
): Promise<AdminGalleryImage[]> {
  return db
    .select({
      id: schema.productImage.id,
      url: schema.productImage.url,
      sortOrder: schema.productImage.sortOrder,
    })
    .from(schema.productImage)
    .where(eq(schema.productImage.productId, productId))
    .orderBy(asc(schema.productImage.sortOrder), asc(schema.productImage.id));
}

export type ProductImageWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "product_missing" };

export async function addProductImage(
  db: LibSQLDatabase<typeof schema>,
  productId: string,
  url: string,
): Promise<ProductImageWriteResult> {
  const owner = await db
    .select({ id: schema.product.id })
    .from(schema.product)
    .where(eq(schema.product.id, productId))
    .get();
  if (!owner) return { ok: false, reason: "product_missing" };

  const [maxRow] = await db
    .select({
      max: sql<number>`coalesce(max(${schema.productImage.sortOrder}), -1)`,
    })
    .from(schema.productImage)
    .where(eq(schema.productImage.productId, productId));

  const created = await db
    .insert(schema.productImage)
    .values({ productId, url, sortOrder: (maxRow?.max ?? -1) + 1 })
    .returning({ id: schema.productImage.id });
  if (!created[0]) throw new Error("[admin/product-images] insert returned no row");
  return { ok: true, id: created[0].id };
}

export type ProductImageDeleteResult = { ok: true } | { ok: false; reason: "not_found" };

export async function deleteProductImage(
  db: LibSQLDatabase<typeof schema>,
  productId: string,
  imageId: string,
): Promise<ProductImageDeleteResult> {
  const deleted = await db
    .delete(schema.productImage)
    .where(and(eq(schema.productImage.id, imageId), eq(schema.productImage.productId, productId)))
    .returning({ id: schema.productImage.id });
  if (deleted[0]) return { ok: true };
  return { ok: false, reason: "not_found" };
}

export type ProductImageReorderResult = { ok: true } | { ok: false; reason: "mismatch" };

/**
 * Persists the full display order: the submitted id sequence must be exactly
 * the set of this product's gallery rows, otherwise nothing is written — a
 * stale or forged list must never silently drop or reorder rows.
 */
export async function reorderProductImages(
  db: LibSQLDatabase<typeof schema>,
  productId: string,
  orderedIds: string[],
): Promise<ProductImageReorderResult> {
  const existing = await db
    .select({ id: schema.productImage.id })
    .from(schema.productImage)
    .where(eq(schema.productImage.productId, productId));
  const existingSet = new Set(existing.map((row) => row.id));
  if (orderedIds.length !== existingSet.size) return { ok: false, reason: "mismatch" };
  for (const id of orderedIds) {
    if (!existingSet.has(id)) return { ok: false, reason: "mismatch" };
  }
  if (orderedIds.length === 0) return { ok: true };

  // Sequential per-row updates: N is small (gallery rows) and this avoids
  // baking a batch-tuple type into the service for marginal D1 wins.
  for (const [index, id] of orderedIds.entries()) {
    await db
      .update(schema.productImage)
      .set({ sortOrder: index })
      .where(and(eq(schema.productImage.id, id), eq(schema.productImage.productId, productId)));
  }
  return { ok: true };
}

/**
 * Writes the cover to the legacy `product.image` column AND, per decision
 * D1, to the image of a single-variant product. Multi-variant products keep
 * their per-variant images untouched here — those are edited per row.
 */
export async function setCoverUrl(
  db: LibSQLDatabase<typeof schema>,
  productId: string,
  url: string,
): Promise<void> {
  await db.update(schema.product).set({ image: url }).where(eq(schema.product.id, productId));

  const variants = await db
    .select({ id: schema.productVariant.id })
    .from(schema.productVariant)
    .where(eq(schema.productVariant.productId, productId))
    .limit(2);
  if (variants.length === 1 && variants[0]) {
    await db
      .update(schema.productVariant)
      .set({ image: url })
      .where(eq(schema.productVariant.id, variants[0].id));
  }
}
