import { implement } from "@orpc/server";
import { getSearchSuggestions } from "$lib/server/store";
import { searchContract } from "./contract";
import type { SearchRpcContext } from "./context";

const os = implement(searchContract).$context<SearchRpcContext>();

const rateLimit = os.middleware(async ({ next, errors, context }) => {
  if ("TOO_MANY_REQUESTS" in errors) {
    const allowed = await context.rateLimiter.allow(`search-suggestions:${context.clientAddress}`);
    if (!allowed) throw errors.TOO_MANY_REQUESTS();
  }
  return next();
});

export const searchRouter = os.router({
  suggestions: os.suggestions.use(rateLimit).handler(async ({ input, context }) => {
    return getSearchSuggestions(context.db, input.q, context.lang);
  }),
});
