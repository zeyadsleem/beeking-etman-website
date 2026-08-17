import { getCategories } from "$lib/server/store";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async (event) => {
  const lang = getLang(event);
  const categories = await getCategories(db, lang);
  return {
    categories,
    user: event.locals.user ?? null,
    lang,
  };
};
