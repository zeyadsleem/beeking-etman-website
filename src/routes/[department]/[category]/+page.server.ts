import { error } from "@sveltejs/kit";
import { and, eq, or, sql } from "drizzle-orm";
import {
  listProductsPage,
  isDepartment,
  resolveCategoryIds,
  type Department,
  type SortOrder,
} from "$lib/server/store";
import { db } from "$lib/server/db";
import { t, localized } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";
import * as schema from "$lib/server/db/schema";
import { getCategoryBySlug } from "$lib/server/categories";
import type { PageServerLoad } from "./$types";

const SORTS = new Set(["newest", "price-asc", "price-desc"]);

export const load: PageServerLoad = async (event) => {
  event.setHeaders({ "cache-control": "s-maxage=60, stale-while-revalidate=300" });
  const lang = getLang(event);
  const { department: rawDepartment, category } = event.params;
  if (!isDepartment(rawDepartment)) error(404, t(lang, "products.notFound"));
  const department: Department = rawDepartment;

  const node = getCategoryBySlug(category);
  if (!node || node.department !== department) {
    error(404, t(lang, "products.categoryNotFound"));
  }

  const categoryRow = await db
    .select()
    .from(schema.category)
    .where(
      and(
        eq(schema.category.slug, category),
        or(eq(schema.category.department, department), sql`${schema.category.department} IS NULL`),
      ),
    )
    .get();
  if (!categoryRow) error(404, t(lang, "products.categoryNotFound"));

  const categoryIds = await resolveCategoryIds(db, department, category);
  if (!categoryIds?.length) error(404, t(lang, "products.categoryNotFound"));

  const rawSort = event.url.searchParams.get("sort")?.toString() ?? "newest";
  const rawPage = Number.parseInt(event.url.searchParams.get("page") ?? "1", 10);
  const sort: SortOrder = SORTS.has(rawSort) ? (rawSort as SortOrder) : "newest";
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const result = await listProductsPage(
    db,
    { query: "", categoryIds, department, sort, page, pageSize: 12 },
    lang,
  );

  const subcategoryRows = categoryRow.parentId
    ? []
    : await db.select().from(schema.category).where(eq(schema.category.parentId, categoryRow.id));
  const subcategories = subcategoryRows
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ slug: c.slug, name: localized(c.name, c.nameEn, lang) }));

  return {
    ...result,
    department,
    category: {
      slug: category,
      name: localized(categoryRow.name, categoryRow.nameEn, lang),
    },
    subcategories,
    filters: { sort, page: result.page },
  };
};
