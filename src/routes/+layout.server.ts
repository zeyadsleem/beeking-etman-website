import { getCategories } from "$lib/server/store";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async (event) => {
  const categories = await getCategories(db);
  return {
    categories,
    user: event.locals.user ?? null,
    lang: getLang(event),
  };
};
