import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { getSearchSuggestions } from "$lib/server/store";
import { getLang } from "$lib/server/lang";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const q = event.url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return json({ products: [], categories: [] });
  return json(await getSearchSuggestions(db, q, getLang(event)));
};
