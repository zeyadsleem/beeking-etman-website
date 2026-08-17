import { error } from "@sveltejs/kit";
import { getCategories, listProductsPage, PRODUCTS_PAGE_SIZE } from "$lib/server/store";
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
  const activeCategory = categories.find((c) => c.slug === rawCategory);
  if (rawCategory && !activeCategory) error(404, t(lang, "products.categoryNotFound"));

  const result = await listProductsPage(
    db,
    {
      query: rawQ,
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
    filters: { q: rawQ, category: rawCategory, sort, page: result.page },
  };
};
