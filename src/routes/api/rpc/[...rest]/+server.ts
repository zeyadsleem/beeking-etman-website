import type { RequestHandler } from "./$types";
import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { db } from "$lib/server/db";
import { getLang } from "$lib/server/lang";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { searchRouter } from "$lib/features/search/router";

const SUGGESTIONS_RATE_LIMIT = createDbRateLimiter(db, { windowMs: 60_000, max: 30 });

const handler = new RPCHandler(searchRouter, {
  interceptors: [
    onError((error) => {
      console.error("oRPC search error:", error);
    }),
  ],
});

const handle: RequestHandler = async (event) => {
  const { response } = await handler.handle(event.request, {
    prefix: "/api/rpc",
    context: {
      db,
      rateLimiter: SUGGESTIONS_RATE_LIMIT,
      clientAddress: clientAddressKey(event),
      lang: getLang(event),
    },
  });
  return response ?? new Response("Not found", { status: 404 });
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
