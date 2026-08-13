import { getCategories, getFeaturedProducts, listProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const [categories, featured, products] = await Promise.all([
    getCategories(db),
    getFeaturedProducts(db, 8),
    listProducts(db, { limit: 100 }),
  ]);
  return { categories, featured, products };
};
