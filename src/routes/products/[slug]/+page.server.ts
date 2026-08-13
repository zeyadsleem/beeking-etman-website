import { error } from "@sveltejs/kit";
import { getProductBySlug, getRelatedProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const product = await getProductBySlug(db, params.slug);
  if (!product) error(404, "المنتج غير موجود");
  const related = await getRelatedProducts(db, product, 4);
  return { product, related };
};
