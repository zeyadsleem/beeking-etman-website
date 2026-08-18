import { and, asc, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { jarLabel, ADDITIVE_LABELS, isAdditiveKey } from "$lib/blends";
import type { BlendCartItem, CartEntry, CartItem, CartLine } from "$lib/cart";
import { isBlendEntry } from "$lib/cart";
import { localized, type Lang } from "$lib/i18n/messages";
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
  images: string[];
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
type ImageRow = typeof schema.productImage.$inferSelect;

const minPriceExpr = sql<number>`(SELECT MIN(${schema.productVariant.price}) FROM ${schema.productVariant} WHERE ${schema.productVariant.productId} = ${schema.product.id})`;

function minPriceOf(rows: readonly { price: number }[], fallback: number): number {
  return rows.length ? Math.min(...rows.map((v) => v.price)) : fallback;
}

function categoryNameCondition(q: string): SQL {
  const condition = or(like(schema.category.name, q), like(schema.category.nameEn, q));
  if (condition === undefined) {
    throw new Error("category name condition unexpectedly empty");
  }
  return condition;
}

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(row);
    map.set(key(row), list);
  }
  return map;
}

export function withVariants(
  rows: ProductRow[],
  variantsByProduct: Map<string, VariantRow[]>,
  imagesByProduct: Map<string, ImageRow[]> = new Map(),
  lang: Lang = "ar",
): ProductSummary[] {
  return rows.map((row) => {
    const variants = (variantsByProduct.get(row.id) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const images = (imagesByProduct.get(row.id) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => i.url);
    return {
      id: row.id,
      name: localized(row.name, row.nameEn, lang),
      slug: row.slug,
      description: localized(row.description, row.descriptionEn, lang),
      image: row.image,
      images,
      categoryId: row.categoryId,
      featured: row.featured,
      createdAt: row.createdAt,
      variants: variants.map((v) => ({ ...v, name: localized(v.name, v.nameEn, lang) })),
      minPrice: minPriceOf(variants, 0),
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
  return groupBy(variants, (v) => v.productId);
}

async function loadImagesForProducts(
  db: LibSQLDatabase<typeof schema>,
  productIds: string[],
): Promise<Map<string, ImageRow[]>> {
  if (productIds.length === 0) return new Map();
  const images = await db
    .select()
    .from(schema.productImage)
    .where(inArray(schema.productImage.productId, productIds));
  return groupBy(images, (i) => i.productId);
}

export async function getCategories(
  db: LibSQLDatabase<typeof schema>,
  lang: Lang = "ar",
): Promise<{ id: string; name: string; slug: string }[]> {
  const rows = await db.select().from(schema.category).orderBy(asc(schema.category.name));
  return rows.map((c) => ({ id: c.id, name: localized(c.name, c.nameEn, lang), slug: c.slug }));
}

export async function findCategoryByQuery(
  db: LibSQLDatabase<typeof schema>,
  query: string,
): Promise<{ id: string; slug: string } | null> {
  const q = `%${query.trim()}%`;
  const row = await db.select().from(schema.category).where(categoryNameCondition(q)).get();
  return row ? { id: row.id, slug: row.slug } : null;
}

export async function getFeaturedProducts(
  db: LibSQLDatabase<typeof schema>,
  limit = 8,
  lang: Lang = "ar",
): Promise<ProductSummary[]> {
  const rows = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.featured, 1))
    .orderBy(desc(schema.product.createdAt))
    .limit(limit);
  const ids = rows.map((r) => r.id);
  return withVariants(
    rows,
    await loadVariantsForProducts(db, ids),
    await loadImagesForProducts(db, ids),
    lang,
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
  lang: Lang = "ar",
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
  const ids = rows.map((r) => r.id);
  return withVariants(
    rows,
    await loadVariantsForProducts(db, ids),
    await loadImagesForProducts(db, ids),
    lang,
  );
}

export async function listProductsPage(
  db: LibSQLDatabase<typeof schema>,
  filters: ProductPageFilters = {},
  lang: Lang = "ar",
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
    await loadImagesForProducts(
      db,
      rows.map((r) => r.id),
    ),
    lang,
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
  lang: Lang = "ar",
): Promise<{
  products: SearchSuggestionProduct[];
  categories: { id: string; name: string; slug: string }[];
}> {
  const trimmed = query.trim();
  const q = `%${trimmed}%`;
  const [ids, categoryRows] = await Promise.all([
    searchProductIds(db, trimmed, 6),
    db.select().from(schema.category).where(categoryNameCondition(q)).limit(3),
  ]);
  const categories = categoryRows.map((c) => ({
    id: c.id,
    name: localized(c.name, c.nameEn, lang),
    slug: c.slug,
  }));
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
      name: localized(row.name, row.nameEn, lang),
      slug: row.slug,
      image: row.image,
      minPrice: minPriceOf(vs, row.price),
    };
  });
  return { products, categories };
}

export async function getProductWithVariants(
  db: LibSQLDatabase<typeof schema>,
  slug: string,
  lang: Lang = "ar",
): Promise<ProductSummary | null> {
  const row = await db.select().from(schema.product).where(eq(schema.product.slug, slug)).get();
  if (!row) return null;
  const list = withVariants(
    [row],
    await loadVariantsForProducts(db, [row.id]),
    await loadImagesForProducts(db, [row.id]),
    lang,
  );
  return list[0];
}

export async function getRelatedProducts(
  db: LibSQLDatabase<typeof schema>,
  product: Pick<ProductSummary, "id" | "categoryId">,
  limit = 4,
  lang: Lang = "ar",
): Promise<ProductSummary[]> {
  const rows = await db
    .select()
    .from(schema.product)
    .where(
      and(eq(schema.product.categoryId, product.categoryId), ne(schema.product.id, product.id)),
    )
    .orderBy(desc(schema.product.featured), desc(schema.product.createdAt))
    .limit(limit);
  const ids = rows.map((r) => r.id);
  return withVariants(
    rows,
    await loadVariantsForProducts(db, ids),
    await loadImagesForProducts(db, ids),
    lang,
  );
}

export interface ResolvedCart {
  items: CartItem[];
  missing: string[];
}

export async function resolveCartItems(
  db: LibSQLDatabase<typeof schema>,
  lines: CartEntry[],
  lang: Lang = "ar",
): Promise<ResolvedCart> {
  if (lines.length === 0) return { items: [], missing: [] };
  const regularLines = lines.filter((l) => !isBlendEntry(l)) as CartLine[];
  const blendLines = lines.filter(isBlendEntry);
  const items: CartItem[] = [];
  const missingSet = new Set<string>();

  if (regularLines.length > 0) {
    const ids = [...new Set(regularLines.map((l) => l.variantId))];
    const variants = await db
      .select()
      .from(schema.productVariant)
      .where(inArray(schema.productVariant.id, ids));
    if (variants.length === 0) {
      for (const id of ids) missingSet.add(id);
    } else {
      const products = await db
        .select()
        .from(schema.product)
        .where(inArray(schema.product.id, [...new Set(variants.map((v) => v.productId))]));
      const productById = new Map(products.map((p) => [p.id, p]));
      const variantById = new Map(variants.map((v) => [v.id, v]));
      for (const line of regularLines) {
        const v = variantById.get(line.variantId);
        const p = v ? productById.get(v.productId) : undefined;
        if (!v || !p) {
          missingSet.add(line.variantId);
          continue;
        }
        items.push({
          variantId: v.id,
          productId: p.id,
          name: localized(p.name, p.nameEn, lang),
          variantName: localized(v.name, v.nameEn, lang),
          slug: p.slug,
          image: v.image,
          price: v.price,
          stock: v.stock,
          quantity: Math.min(line.quantity, v.stock),
        });
      }
    }
  }

  if (blendLines.length > 0) {
    const baseIds = [...new Set(blendLines.map((l) => l.baseVariantId))];
    const additiveIds = [
      ...new Set(blendLines.flatMap((l) => l.additives.map((a) => a.variantId))),
    ];
    const [baseVariants, additiveVariants] = await Promise.all([
      db.select().from(schema.productVariant).where(inArray(schema.productVariant.id, baseIds)),
      additiveIds.length
        ? db
            .select()
            .from(schema.productVariant)
            .where(inArray(schema.productVariant.id, additiveIds))
        : Promise.resolve([]),
    ]);
    const allIds = [...new Set([...baseVariants, ...additiveVariants].map((v) => v.productId))];
    const products = allIds.length
      ? await db.select().from(schema.product).where(inArray(schema.product.id, allIds))
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));
    const baseById = new Map(baseVariants.map((v) => [v.id, v]));
    const additiveById = new Map(additiveVariants.map((v) => [v.id, v]));

    for (const line of blendLines) {
      const base = baseById.get(line.baseVariantId);
      const baseProduct = base ? productById.get(base.productId) : undefined;
      if (!base || !baseProduct) {
        missingSet.add(line.baseVariantId);
        continue;
      }
      const additives: BlendCartItem["additives"] = [];
      for (const a of line.additives) {
        const variant = additiveById.get(a.variantId);
        const product = variant ? productById.get(variant.productId) : undefined;
        if (!variant || !product) continue;
        const label = isAdditiveKey(a.key) ? ADDITIVE_LABELS[a.key] : undefined;
        const name = label
          ? localized(label.ar, label.en, lang)
          : localized(product.name, product.nameEn, lang);
        additives.push({
          key: a.key,
          variantId: variant.id,
          productId: product.id,
          name,
          image: variant.image,
          qty: Math.min(a.qty, variant.stock),
          price: variant.price,
          stock: variant.stock,
        });
      }
      const item: BlendCartItem = {
        kind: "blend",
        id: line.id,
        baseVariantId: base.id,
        productId: baseProduct.id,
        name: localized(baseProduct.name, baseProduct.nameEn, lang),
        variantName: jarLabel(lang, line.jarSize),
        image: base.image,
        jarSize: line.jarSize,
        basePrice: base.price,
        stock: base.stock,
        quantity: 1,
        additives,
      };
      items.push(item);
    }
  }

  return { items, missing: [...missingSet] };
}
