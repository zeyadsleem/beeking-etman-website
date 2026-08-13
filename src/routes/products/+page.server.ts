import { error } from "@sveltejs/kit";
import { listProducts, getCategories } from "$lib/server/store";
import type { SortOrder } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

const SORTS = new Set(["newest", "price-asc", "price-desc"]);

export const load: PageServerLoad = async ({ url }) => {
  const rawQ = url.searchParams.get("q")?.toString().trim() ?? "";
  const rawCategory = url.searchParams.get("category")?.toString().trim() ?? "";
  const rawSort = url.searchParams.get("sort")?.toString() ?? "newest";
  const sort: SortOrder = SORTS.has(rawSort) ? (rawSort as SortOrder) : "newest";

  const categories = await getCategories(db);
  if (!categories.length) error(500, "المتجر غير متاح حاليًا");
  const activeCategory = categories.find((c) => c.slug === rawCategory);
  if (rawCategory && !activeCategory) error(404, "قسم غير موجود");

  // listProducts filters by categoryId; the URL carries the category slug.
  const products = await listProducts(db, {
    query: rawQ,
    category: activeCategory?.id ?? "",
    sort,
  });

  return { categories, products, filters: { q: rawQ, category: rawCategory, sort } };
};
