import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { getSearchSuggestions } from "$lib/server/store";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return json({ products: [], categories: [] });
  return json(await getSearchSuggestions(db, q));
};
