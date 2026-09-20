import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// The blend studio is retired (AgDR-0002). #13 retargets this to the blends
// category page once that category exists; until then the storefront is /honey.
export const GET: RequestHandler = async (event) => {
  throw redirect(301, `/honey${event.url.search}`);
};
