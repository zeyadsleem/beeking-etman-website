import { getCategories, getFeaturedProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const [categories, featured] = await Promise.all([getCategories(db), getFeaturedProducts(db, 8)]);
  return { categories, featured };
};
