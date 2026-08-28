/**
 * JSON-LD builders for structured-data SEO. Pure functions so page components
 * can compose them from load data; all URLs are absolute against the site
 * origin. Prices are stored in piastres and emitted in EGP.
 */
import { canonicalUrl, siteOrigin } from "$lib/site";
import type { Lang } from "$lib/i18n/messages";

export type JsonLdObject = Record<string, unknown>;

/** Collapse whitespace and clamp to a crawler-friendly description length. */
export function metaDescription(text: string, maxLength = 157): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function organizationJsonLd(lang: Lang): JsonLdObject {
  const ar = lang === "ar";
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteOrigin()}/#organization`,
    name: ar ? "مملكة النحل" : "Kingdom of Honey",
    url: siteOrigin(),
    logo: canonicalUrl("/images/logo.png"),
  };
}

export function websiteJsonLd(lang: Lang): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteOrigin()}/#website`,
    url: siteOrigin(),
    name: lang === "ar" ? "مملكة النحل" : "Kingdom of Honey",
    inLanguage: lang,
    publisher: { "@id": `${siteOrigin()}/#organization` },
  };
}

export interface BreadcrumbEntry {
  name: string;
  path?: string;
}

export function breadcrumbJsonLd(entries: BreadcrumbEntry[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      ...(entry.path === undefined ? {} : { item: canonicalUrl(entry.path) }),
    })),
  };
}

export interface ProductJsonLdInput {
  path: string;
  name: string;
  description: string;
  image: string;
  minPrice: number;
  inStock: boolean;
}

export function productJsonLd(product: ProductJsonLdInput): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image.startsWith("http") ? product.image : canonicalUrl(product.image),
    offers: {
      "@type": "Offer",
      url: canonicalUrl(product.path),
      priceCurrency: "EGP",
      price: (product.minPrice / 100).toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
}
