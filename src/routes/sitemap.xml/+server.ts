import { desc } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { siteOrigin } from "$lib/site";
import type { RequestHandler } from "./$types";

const STATIC_PATHS = ["/", "/store/honey", "/store/equipment", "/blends"];

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Dynamic sitemap: static entry points plus one URL per product. Product
 * slugs are ASCII-safe but escaped anyway so a malformed slug can never
 * break the document; private areas stay out via robots.txt. */
export const GET: RequestHandler = async () => {
  const origin = siteOrigin();
  const products = await db
    .select({ slug: schema.product.slug, createdAt: schema.product.createdAt })
    .from(schema.product)
    .orderBy(desc(schema.product.createdAt));

  const entries = [
    ...STATIC_PATHS.map((path) => ({ path, lastmod: undefined as string | undefined })),
    ...products.map((product) => ({
      path: `/products/${product.slug}`,
      lastmod: new Date(product.createdAt).toISOString().slice(0, 10),
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      ({ path, lastmod }) =>
        `  <url><loc>${xmlEscape(`${origin}${path}`)}</loc>${
          lastmod === undefined ? "" : `<lastmod>${lastmod}</lastmod>`
        }</url>`,
    ),
    "</urlset>",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
