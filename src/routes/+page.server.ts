import { listProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

// Categories are intentionally not fetched here: +layout.server.ts already
// loads them once per request and SvelteKit merges layout data into page
// data, so +page.svelte keeps reading data.categories.
export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const [honey, equipment] = await Promise.all([
    listProducts(db, { department: "honey", limit: 40 }, lang),
    listProducts(db, { department: "equipment", limit: 40 }, lang),
  ]);
  return { honey, equipment };
};
