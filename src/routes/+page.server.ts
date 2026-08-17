import { getCategories, getFeaturedProducts, listProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const [categories, featured, products] = await Promise.all([
    getCategories(db, lang),
    getFeaturedProducts(db, 8, lang),
    listProducts(db, { limit: 100 }, lang),
  ]);
  return { categories, featured, products };
};
