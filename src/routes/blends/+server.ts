import { redirect } from "@sveltejs/kit";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import type { RequestHandler } from "./$types";

const BLENDS_CATEGORY_SLUG = "blends";
const BLENDS_PATH = "/honey/blends";
const HONEY_PATH = "/honey";

/**
 * The blend studio is retired (AgDR-0002). The blends category is seeded into
 * `store_category` from `src/lib/server/categories.ts`, but production has no
 * admin categories route and `scripts/seed.ts` refuses to run once orders
 * exist, so the row must be inserted directly (idempotent SQL against
 * `store_category`; see the AgDR-0002 shipped note for the exact command).
 *
 * Until that row exists — or if the lookup fails — the route 302s to `/honey`
 * so old links stay safe. The fallback is deliberately temporary (302, not
 * 301): browsers and crawlers cache a permanent redirect, which would outlive
 * the category's creation.
 */
export const GET: RequestHandler = async (event) => {
  const target = (await blendsCategoryExists())
    ? { status: 301, path: BLENDS_PATH }
    : { status: 302, path: HONEY_PATH };
  throw redirect(target.status, `${target.path}${event.url.search}`);
};

/** Mirrors the category page's precondition: the row must belong to the honey
 * department (or be a legacy null-department row) or `/honey/blends` 404s. */
async function blendsCategoryExists(): Promise<boolean> {
  try {
    const row = await db
      .select({ id: schema.category.id })
      .from(schema.category)
      .where(
        and(
          eq(schema.category.slug, BLENDS_CATEGORY_SLUG),
          or(eq(schema.category.department, "honey"), isNull(schema.category.department)),
        ),
      )
      .get();
    return row !== undefined;
  } catch (error) {
    console.error("[blends] category lookup failed; falling back to /honey", error);
    return false;
  }
}
