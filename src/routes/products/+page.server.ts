import { error } from "@sveltejs/kit";
import {
  findCategoryByQuery,
  getCategories,
  listProductsPage,
  PRODUCTS_PAGE_SIZE,
} from "$lib/server/store";
import type { SortOrder } from "$lib/server/store";
import { db } from "$lib/server/db";
import { t } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

const SORTS = new Set(["newest", "price-asc", "price-desc"]);

export const load: PageServerLoad = async (event) => {
  const { url } = event;
  const lang = getLang(event);
  const rawQ = url.searchParams.get("q")?.toString().trim() ?? "";
  const rawCategory = url.searchParams.get("category")?.toString().trim() ?? "";
  const rawSort = url.searchParams.get("sort")?.toString() ?? "newest";
  const rawPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const sort: SortOrder = SORTS.has(rawSort) ? (rawSort as SortOrder) : "newest";
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const categories = await getCategories(db, lang);
  if (!categories.length) error(500, t(lang, "products.unavailable"));

  // When the query names a category (e.g. "السدر"), filter by that category
  // instead of running a plain text search, so the results come pre-filtered.
  let categorySlug = rawCategory;
  let autoCategory = false;
  if (!categorySlug && rawQ) {
    const matched = await findCategoryByQuery(db, rawQ);
    if (matched) {
      categorySlug = matched.slug;
      autoCategory = true;
    }
  }
  const activeCategory = categories.find((c) => c.slug === categorySlug);
  if (categorySlug && !activeCategory) error(404, t(lang, "products.categoryNotFound"));

  const result = await listProductsPage(
    db,
    {
      query: autoCategory ? "" : rawQ,
      category: activeCategory?.id ?? "",
      sort,
      page,
      pageSize: PRODUCTS_PAGE_SIZE,
    },
    lang,
  );

  return {
    categories,
    ...result,
    filters: { q: rawQ, category: categorySlug, sort, page: result.page },
  };
};
