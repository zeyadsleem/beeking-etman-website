import { desc, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { siteOrigin } from "$lib/site";
import type { RequestHandler } from "./$types";

const STATIC_PATHS = ["/", "/products", "/honey", "/equipment", "/about"];

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Dynamic sitemap: static entry points, one URL per category, plus one URL per
 * published product under its department/category. Product slugs are ASCII-safe
 * but escaped anyway so a malformed slug can never break the document;
 * unpublished products and private areas stay out. */
export const GET: RequestHandler = async () => {
  const origin = siteOrigin();
  const [categories, products] = await Promise.all([
    db
      .select({ slug: schema.category.slug, department: schema.category.department })
      .from(schema.category),
    db
      .select({
        slug: schema.product.slug,
        department: schema.product.department,
        categorySlug: schema.category.slug,
        createdAt: schema.product.createdAt,
      })
      .from(schema.product)
      .innerJoin(schema.category, eq(schema.product.categoryId, schema.category.id))
      .where(eq(schema.product.published, true))
      .orderBy(desc(schema.product.createdAt)),
  ]);

  const entries = [
    ...STATIC_PATHS.map((path) => ({ path, lastmod: undefined as string | undefined })),
    ...categories.map((c) => ({
      path: `/${c.department}/${c.slug}`,
      lastmod: undefined as string | undefined,
    })),
    ...products.map((product) => ({
      path: `/${product.department}/${product.categorySlug}/${product.slug}`,
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
