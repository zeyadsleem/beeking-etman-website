import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const target = new URL(`/honey`, event.url);
  event.url.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  throw redirect(301, `${target.pathname}${target.search}`);
};
