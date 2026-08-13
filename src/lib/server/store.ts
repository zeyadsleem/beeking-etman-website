import { and, asc, desc, eq, inArray, like, ne, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { CartItem, CartLine } from "$lib/cart";
import * as schema from "$lib/server/db/schema";

export interface ProductVariantSummary {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  sortOrder: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  categoryId: string;
  featured: number;
  createdAt: number;
  variants: ProductVariantSummary[];
  minPrice: number;
}

export type SortOrder = "newest" | "price-asc" | "price-desc";

export interface ProductFilters {
  query?: string;
  category?: string;
  sort?: SortOrder;
  limit?: number;
  offset?: number;
}

type VariantRow = typeof schema.productVariant.$inferSelect;
type ProductRow = typeof schema.product.$inferSelect;

export function withVariants(
  rows: ProductRow[],
  variantsByProduct: Map<string, VariantRow[]>,
): ProductSummary[] {
  return rows.map((row) => {
    const variants = (variantsByProduct.get(row.id) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      image: row.image,
      categoryId: row.categoryId,
      featured: row.featured,
      createdAt: row.createdAt,
      variants,
      minPrice: variants.length ? Math.min(...variants.map((v) => v.price)) : 0,
    };
  });
}

async function loadVariantsForProducts(
  db: LibSQLDatabase<typeof schema>,
  productIds: string[],
): Promise<Map<string, VariantRow[]>> {
  if (productIds.length === 0) return new Map();
  const variants = await db
    .select()
    .from(schema.productVariant)
    .where(inArray(schema.productVariant.productId, productIds));
  const map = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const list = map.get(v.productId) ?? [];
    list.push(v);
    map.set(v.productId, list);
  }
  return map;
}

export async function getCategories(
  db: LibSQLDatabase<typeof schema>,
): Promise<{ id: string; name: string; slug: string }[]> {
  return db.select().from(schema.category).orderBy(asc(schema.category.name));
}

export async function getFeaturedProducts(
  db: LibSQLDatabase<typeof schema>,
  limit = 8,
): Promise<ProductSummary[]> {
  const rows = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.featured, 1))
    .orderBy(desc(schema.product.createdAt))
    .limit(limit);
  return withVariants(
    rows,
    await loadVariantsForProducts(
      db,
      rows.map((r) => r.id),
    ),
  );
}

export async function listProducts(
  db: LibSQLDatabase<typeof schema>,
  filters: ProductFilters = {},
): Promise<ProductSummary[]> {
  const conds = [];
  if (filters.query) {
    const q = `%${filters.query.trim()}%`;
    conds.push(or(like(schema.product.name, q), like(schema.product.description, q))!);
  }
  if (filters.category) {
    conds.push(eq(schema.product.categoryId, filters.category));
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(schema.product)
    .where(where)
    .orderBy(desc(schema.product.createdAt))
    .limit(filters.limit ?? 1000)
    .offset(filters.offset ?? 0);
  const summaries = withVariants(
    rows,
    await loadVariantsForProducts(
      db,
      rows.map((r) => r.id),
    ),
  );
  if (filters.sort === "price-asc") summaries.sort((a, b) => a.minPrice - b.minPrice);
  if (filters.sort === "price-desc") summaries.sort((a, b) => b.minPrice - a.minPrice);
  return summaries;
}

export async function getProductWithVariants(
  db: LibSQLDatabase<typeof schema>,
  slug: string,
): Promise<ProductSummary | null> {
  const row = await db.select().from(schema.product).where(eq(schema.product.slug, slug)).get();
  if (!row) return null;
  const list = await withVariants([row], await loadVariantsForProducts(db, [row.id]));
  return list[0];
}

export async function getRelatedProducts(
  db: LibSQLDatabase<typeof schema>,
  product: Pick<ProductSummary, "id" | "categoryId">,
  limit = 4,
): Promise<ProductSummary[]> {
  const rows = await db
    .select()
    .from(schema.product)
    .where(
      and(eq(schema.product.categoryId, product.categoryId), ne(schema.product.id, product.id)),
    )
    .orderBy(desc(schema.product.featured), desc(schema.product.createdAt))
    .limit(limit);
  return withVariants(
    rows,
    await loadVariantsForProducts(
      db,
      rows.map((r) => r.id),
    ),
  );
}

export async function resolveCartItems(
  db: LibSQLDatabase<typeof schema>,
  lines: CartLine[],
): Promise<CartItem[]> {
  if (lines.length === 0) return [];
  const ids = [...new Set(lines.map((l) => l.variantId))];
  const variants = await db
    .select()
    .from(schema.productVariant)
    .where(inArray(schema.productVariant.id, ids));
  if (variants.length === 0) return [];
  const products = await db
    .select()
    .from(schema.product)
    .where(inArray(schema.product.id, [...new Set(variants.map((v) => v.productId))]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));
  return lines.flatMap((line) => {
    const v = variantById.get(line.variantId);
    if (!v) return [];
    const p = productById.get(v.productId);
    if (!p) return [];
    return [
      {
        variantId: v.id,
        productId: p.id,
        name: p.name,
        variantName: v.name,
        slug: p.slug,
        image: v.image,
        price: v.price,
        stock: v.stock,
        quantity: Math.min(line.quantity, v.stock),
      },
    ];
  });
}
