import { error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import {
  findCategoryByQuery,
  getCategories,
  listProductsPage,
  PRODUCTS_PAGE_SIZE,
  resolveCategoryIds,
} from "$lib/server/store";
import type { Department, ProductSummary, SortOrder } from "$lib/server/store";
import { db } from "$lib/server/db";
import { t } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";

const SORTS = new Set(["newest", "price-asc", "price-desc"]);

export interface StorePageFilters {
  q: string;
  category: string;
  sort: SortOrder;
  page: number;
}

export interface StorePageData {
  categories: { id: string; name: string; slug: string }[];
  products: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  department: Department;
  filters: StorePageFilters;
}

export async function loadStorePage(event: RequestEvent, department: Department) {
  const { url } = event;
  const lang = getLang(event);
  const rawQ = url.searchParams.get("q")?.toString().trim() ?? "";
  const rawCategory = url.searchParams.get("category")?.toString().trim() ?? "";
  const rawSort = url.searchParams.get("sort")?.toString() ?? "newest";
  const rawPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const sort: SortOrder = SORTS.has(rawSort) ? (rawSort as SortOrder) : "newest";
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const categories = await getCategories(db, lang, department);
  if (!categories.length) error(500, t(lang, "products.unavailable"));

  let categorySlug = rawCategory;
  let autoCategory = false;
  if (!categorySlug && rawQ) {
    const matched = await findCategoryByQuery(db, rawQ);
    if (matched) {
      categorySlug = matched.slug;
      autoCategory = true;
    }
  }
  const categoryIds = await resolveCategoryIds(db, department, categorySlug);
  if (categorySlug && !categoryIds?.length) error(404, t(lang, "products.categoryNotFound"));

  const result = await listProductsPage(
    db,
    {
      query: autoCategory ? "" : rawQ,
      categoryIds: categoryIds ?? [],
      department,
      sort,
      page,
      pageSize: PRODUCTS_PAGE_SIZE,
    },
    lang,
  );

  return {
    categories,
    ...result,
    department,
    filters: {
      q: rawQ,
      category: categorySlug,
      sort,
      page: result.page,
    } satisfies StorePageFilters,
  } satisfies StorePageData;
}
