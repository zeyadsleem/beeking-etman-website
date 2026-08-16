import { and, asc, desc, eq, inArray, like, ne, sql, type SQL } from "drizzle-orm";
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
  limit?: number;
  offset?: number;
  sort?: SortOrder;
}

export interface ProductPageFilters {
  query?: string;
  category?: string;
  sort?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface ProductPageResult {
  products: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const PRODUCTS_PAGE_SIZE = 12;

type VariantRow = typeof schema.productVariant.$inferSelect;
type ProductRow = typeof schema.product.$inferSelect;

const minPriceExpr = sql<number>`(SELECT MIN(${schema.productVariant.price}) FROM ${schema.productVariant} WHERE ${schema.productVariant.productId} = ${schema.product.id})`;

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

function toFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replaceAll('"', '""')}"*`)
    .join(" ");
}

async function searchProductIds(
  db: LibSQLDatabase<typeof schema>,
  query: string,
  limit: number,
): Promise<string[]> {
  const rows = (await db.all(sql`
    SELECT product_id
    FROM store_product_fts
    WHERE store_product_fts MATCH ${toFtsQuery(query)}
    ORDER BY rank
    LIMIT ${limit}
  `)) as { product_id: string }[];
  return rows.map((r) => r.product_id);
}

async function buildProductWhere(
  db: LibSQLDatabase<typeof schema>,
  filters: Pick<ProductFilters, "query" | "category">,
): Promise<{ where: SQL | undefined; none: boolean }> {
  const conds: SQL[] = [];
  if (filters.query) {
    const ids = await searchProductIds(db, filters.query, 1000);
    if (ids.length === 0) return { where: undefined, none: true };
    conds.push(inArray(schema.product.id, ids));
  }
  if (filters.category) {
    conds.push(eq(schema.product.categoryId, filters.category));
  }
  return { where: conds.length ? and(...conds) : undefined, none: false };
}

function orderByFor(sort: SortOrder, minPrice: SQL<number>) {
  switch (sort) {
    case "price-asc":
      return asc(minPrice);
    case "price-desc":
      return desc(minPrice);
    default:
      return desc(schema.product.createdAt);
  }
}

export async function listProducts(
  db: LibSQLDatabase<typeof schema>,
  filters: ProductFilters = {},
): Promise<ProductSummary[]> {
  const { where, none } = await buildProductWhere(db, filters);
  if (none) return [];
  const rows = await db
    .select()
    .from(schema.product)
    .where(where)
    .orderBy(orderByFor(filters.sort ?? "newest", minPriceExpr))
    .limit(filters.limit ?? 1000)
    .offset(filters.offset ?? 0);
  return withVariants(
    rows,
    await loadVariantsForProducts(
      db,
      rows.map((r) => r.id),
    ),
  );
}

export async function listProductsPage(
  db: LibSQLDatabase<typeof schema>,
  filters: ProductPageFilters = {},
): Promise<ProductPageResult> {
  const requestedPage = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? PRODUCTS_PAGE_SIZE;
  const { where, none } = await buildProductWhere(db, filters);
  if (none) {
    return { products: [], total: 0, page: 1, pageSize, totalPages: 0 };
  }
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.product)
    .where(where);
  const total = totalRow?.count ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(requestedPage, Math.max(1, totalPages));
  const rows = await db
    .select()
    .from(schema.product)
    .where(where)
    .orderBy(orderByFor(filters.sort ?? "newest", minPriceExpr))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const summaries = withVariants(
    rows,
    await loadVariantsForProducts(
      db,
      rows.map((r) => r.id),
    ),
  );
  return { products: summaries, total, page, pageSize, totalPages };
}

export interface SearchSuggestionProduct {
  name: string;
  slug: string;
  image: string;
  minPrice: number;
}

export async function getSearchSuggestions(
  db: LibSQLDatabase<typeof schema>,
  query: string,
): Promise<{
  products: SearchSuggestionProduct[];
  categories: { id: string; name: string; slug: string }[];
}> {
  const trimmed = query.trim();
  const q = `%${trimmed}%`;
  const [ids, categories] = await Promise.all([
    searchProductIds(db, trimmed, 6),
    db.select().from(schema.category).where(like(schema.category.name, q)).limit(3),
  ]);
  const rows = ids.length
    ? await db.select().from(schema.product).where(inArray(schema.product.id, ids))
    : [];
  const variants = await loadVariantsForProducts(
    db,
    rows.map((r) => r.id),
  );
  const products: SearchSuggestionProduct[] = rows.map((row) => {
    const vs = variants.get(row.id) ?? [];
    return {
      name: row.name,
      slug: row.slug,
      image: row.image,
      minPrice: vs.length ? Math.min(...vs.map((v) => v.price)) : row.price,
    };
  });
  return { products, categories };
}

export async function getProductWithVariants(
  db: LibSQLDatabase<typeof schema>,
  slug: string,
): Promise<ProductSummary | null> {
  const row = await db.select().from(schema.product).where(eq(schema.product.slug, slug)).get();
  if (!row) return null;
  const list = withVariants([row], await loadVariantsForProducts(db, [row.id]));
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

export interface ResolvedCart {
  items: CartItem[];
  missing: string[];
}

export async function resolveCartItems(
  db: LibSQLDatabase<typeof schema>,
  lines: CartLine[],
): Promise<ResolvedCart> {
  if (lines.length === 0) return { items: [], missing: [] };
  const ids = [...new Set(lines.map((l) => l.variantId))];
  const variants = await db
    .select()
    .from(schema.productVariant)
    .where(inArray(schema.productVariant.id, ids));
  if (variants.length === 0) return { items: [], missing: ids };
  const products = await db
    .select()
    .from(schema.product)
    .where(inArray(schema.product.id, [...new Set(variants.map((v) => v.productId))]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const items: CartItem[] = [];
  const missingSet = new Set<string>();
  for (const line of lines) {
    const v = variantById.get(line.variantId);
    const p = v ? productById.get(v.productId) : undefined;
    if (!v || !p) {
      missingSet.add(line.variantId);
      continue;
    }
    items.push({
      variantId: v.id,
      productId: p.id,
      name: p.name,
      variantName: v.name,
      slug: p.slug,
      image: v.image,
      price: v.price,
      stock: v.stock,
      quantity: Math.min(line.quantity, v.stock),
    });
  }
  return { items, missing: [...missingSet] };
}
