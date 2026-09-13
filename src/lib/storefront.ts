/**
 * Client-safe helpers for building hierarchical storefront URLs.
 * Kept dependency-free so both server and client components can import it.
 */

export type StoreDepartment = "honey" | "equipment";

/**
 * Build the canonical storefront URL for a product:
 * /{department}/{categorySlug}/{slug}.
 */
export function productPath(p: { department: string; categorySlug: string; slug: string }): string {
  return `/${p.department}/${p.categorySlug}/${p.slug}`;
}

/** URL for a department landing page. */
export function departmentPath(department: StoreDepartment): string {
  return `/${department}`;
}

/** URL for a category page within a department. */
export function categoryPath(department: StoreDepartment, categorySlug: string): string {
  return `/${department}/${categorySlug}`;
}

const PLACEHOLDER_IMAGE = "/images/logo.png";

/** True when a product has no real photo and should fall back to category art. */
export function isPlaceholderImage(src: string | null | undefined): boolean {
  return !src || src.endsWith(PLACEHOLDER_IMAGE) || src.includes("etman-wax");
}
