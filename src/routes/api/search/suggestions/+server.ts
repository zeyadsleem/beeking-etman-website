import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { getSearchSuggestions } from "$lib/server/store";
import { getLang } from "$lib/server/lang";
import type { RequestHandler } from "./$types";

const SUGGESTIONS_LIMIT = createDbRateLimiter(db, { windowMs: 60_000, max: 30 });

export const GET: RequestHandler = async (event) => {
  if (!(await SUGGESTIONS_LIMIT.allow(`search-suggestions:${clientAddressKey(event)}`))) {
    return json({ products: [], categories: [] }, { status: 429 });
  }
  const q = event.url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return json({ products: [], categories: [] });
  return json(await getSearchSuggestions(db, q, getLang(event)));
};
