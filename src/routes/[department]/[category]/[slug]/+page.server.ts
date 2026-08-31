import { error, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import {
  getProductWithVariants,
  getRelatedProducts,
  isDepartment,
  type Department,
} from "$lib/server/store";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { localized } from "$lib/i18n/messages";
import { t } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";
import { getCategoryBySlug } from "$lib/server/categories";
import { productPath } from "$lib/server/store";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  event.setHeaders({ "cache-control": "s-maxage=120, stale-while-revalidate=600" });
  const lang = getLang(event);
  const { department: rawDepartment, category: rawCategory, slug } = event.params;

  if (!isDepartment(rawDepartment)) error(404, t(lang, "products.notFound"));

  const department: Department = rawDepartment;
  const categoryNode = getCategoryBySlug(rawCategory);
  if (!categoryNode || categoryNode.department !== department) {
    error(404, t(lang, "products.notFound"));
  }

  const product = await getProductWithVariants(db, slug, lang);
  if (!product) error(404, t(lang, "products.notFound"));

  // A product has a single home in the tree: its own department + category.
  // If the URL path disagrees (e.g. old flat slug or wrong category), send a
  // permanent redirect to the canonical location so every URL collapses to one.
  const canonical = productPath(product);
  const requested = `/${department}/${rawCategory}/${slug}`;
  if (requested !== canonical) {
    throw redirect(301, canonical);
  }

  const related = await getRelatedProducts(db, product, 4, lang);
  const category = product.categoryId
    ? await db
        .select()
        .from(schema.category)
        .where(eq(schema.category.id, product.categoryId))
        .get()
    : undefined;

  return {
    product,
    related,
    categoryName: category ? localized(category.name, category.nameEn, lang) : "",
  };
};
