import { getFeaturedProducts, listProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

// Categories are intentionally not fetched here: +layout.server.ts already
// loads them once per request and SvelteKit merges layout data into page
// data, so +page.svelte keeps reading data.categories.
export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const [featured, products] = await Promise.all([
    getFeaturedProducts(db, 8, lang),
    listProducts(db, { limit: 100 }, lang),
  ]);
  return { featured, products };
};
