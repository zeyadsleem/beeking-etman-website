import { and, asc, desc, eq, like, ne, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  categoryId: string;
  featured: number;
  createdAt: number;
}

export type SortOrder = "newest" | "price-asc" | "price-desc";

export interface ProductFilters {
  query?: string;
  category?: string;
  sort?: SortOrder;
  limit?: number;
  offset?: number;
}

function toSummary(row: typeof schema.product.$inferSelect): ProductSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    stock: row.stock,
    image: row.image,
    categoryId: row.categoryId,
    featured: row.featured,
    createdAt: row.createdAt,
  };
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
  return rows.map(toSummary);
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
  const orderBy =
    filters.sort === "price-asc"
      ? asc(schema.product.price)
      : filters.sort === "price-desc"
        ? desc(schema.product.price)
        : desc(schema.product.createdAt);
  const rows = await db
    .select()
    .from(schema.product)
    .where(where)
    .orderBy(orderBy)
    .limit(filters.limit ?? 1000)
    .offset(filters.offset ?? 0);
  return rows.map(toSummary);
}

export async function getProductBySlug(
  db: LibSQLDatabase<typeof schema>,
  slug: string,
): Promise<ProductSummary | null> {
  const row = await db.select().from(schema.product).where(eq(schema.product.slug, slug)).get();
  return row ? toSummary(row) : null;
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
  return rows.map(toSummary);
}
