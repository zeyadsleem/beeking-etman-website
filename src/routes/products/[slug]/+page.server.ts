import { error } from "@sveltejs/kit";
import { getProductWithVariants, getRelatedProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import { t } from "$lib/i18n/messages";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const lang = getLang(event);
  const product = await getProductWithVariants(db, event.params.slug, lang);
  if (!product) error(404, t(lang, "products.notFound"));
  const related = await getRelatedProducts(db, product, 4, lang);
  return { product, related };
};
