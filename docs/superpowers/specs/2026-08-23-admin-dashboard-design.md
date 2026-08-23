# Admin Dashboard Design

Date: 2026-08-23
Status: approved (design phase)

## Goal

Give the store owner a protected admin dashboard inside the existing SvelteKit app to manage orders, products/variants/categories with image uploads to R2, and view sales statistics.

## Approach

Route group `/admin` inside this app (Approach A). The admin layout guards every child page server-side using the better-auth session role. Server logic lives in dedicated services under `src/lib/server/admin/` following the existing service + vitest pattern (`addresses.ts`, `orders.ts`). No separate deployment, no new auth system.

## Scope

In:

- Roles: better-auth `admin()` plugin, migration 0008 user columns, `ADMIN_EMAIL` bootstrap promotion on login.
- Orders: paginated list with status filter, detail page, legal status transitions, cancel restores stock.
- Products: CRUD for products and variants, category CRUD, featured flag, stock editing.
- Images: upload to R2 binding `MEDIA` (jpeg/png/webp ≤ 5 MB), public URL stored in existing `image` columns; manual URL paste still supported.
- Stats dashboard at `/admin`: revenue/orders KPIs, 30-day daily series, top 5 products, low-stock alerts.

Out (deferred):

- Customer management UI (ban/unban) despite plugin capability — YAGNI.
- Email notifications on status change — waits for transactional-email roadmap item.
- Sales charts beyond a simple 30-day table/series; no chart library.

## Auth and roles

1. Add `admin()` from `better-auth/plugins` to the plugins array in `src/lib/server/auth.ts`, before `sveltekitCookies` which must remain last.
2. Migration 0008 extends the `user` table with the columns the plugin expects:
   `role text not null default 'user'`, `banned integer default 0`,
   `ban_reason text`, `ban_expires integer`, `impersonated_by text`.
3. Bootstrap: optional `ADMIN_EMAIL` env var validated in `src/lib/server/env.ts`. After a successful sign-in in `/login/+page.server.ts`, if `session.user.email === ADMIN_EMAIL` and `role !== 'admin'`, update the row directly via drizzle. Do NOT use `auth.api.setRole` — it requires an existing admin (bootstrap chicken-and-egg).
4. Guard: `src/routes/admin/+layout.server.ts` loads the session; missing session or `session.user.role !== 'admin'` redirects to `/login`. All admin routes inherit the guard.
5. Header shows an "الأدمن" link only when the current session role is `admin`.

## Data model

No new tables. Migration 0008 only alters `user` as listed above. Product images keep storing URLs in existing text columns (`product.image`, `product_variant.image`, `product_image.url`), so uploaded-file delivery must resolve to a stable public base URL before insert.

## Server layer

New files under `src/lib/server/admin/`:

### orders.ts

- `listOrders({ status?: OrderStatus, page: number })`: joined order rows newest-first, page size matching the account orders list.
- `getOrderWithItems(id)`: order + items + customer fields.
- `transitionOrderStatus(orderId, next)` enforcing:

  | from      | allowed next         |
  | --------- | -------------------- |
  | paid      | shipped, cancelled   |
  | shipped   | delivered, cancelled |
  | delivered | — (terminal)         |
  | cancelled | — (terminal)         |

  On transition to `cancelled`: restore each item's quantity to `productVariant.stock` in one `db.batch` transaction (same pattern as `compensateLostStockRace` restock in `orders.ts`). Idempotency guard: reject cancelling an already-cancelled order. Invalid transitions return a typed error consumed by the form action's `fail()`.

- Status type: `"paid" | "shipped" | "delivered" | "cancelled"` exported from this module.

### products.ts

- `listAdminProducts({ query?, page })` with total variant stock and category name.
- `getProductForEdit(id)` with variants.
- Create/update/delete product with zod validation mirroring checkout-schema style: name/nameEn, description/descriptionEn, slug (auto-generated from name when blank, uniqueness enforced), price integer > 0, categoryId must exist, featured boolean.
- Delete rule: block when `orderItem.productId` references it (FK exists); surface error advising zero-stock instead. Allowed delete cascades variants/images otherwise.
- Variant create/update/delete: price, stock ≥ 0, sortOrder, unique `(productId, name)` (existing index).

### categories.ts

- List/create/update/delete. Delete blocked when products reference the category.

### stats.ts

- `getDashboardStats()`: single function returning `{ kpis, dailySeries(30d), topProducts(5), lowStock }`.
- KPIs: revenue = sum(total) where status != cancelled; order counts by status; distinct customer count (distinct email).
- Low stock: variants with stock <= 5 ordered ascending.
- Plain SQL aggregates via drizzle; no caching, no new tables.

## Uploads (R2)

- `wrangler.jsonc`: add `r2_buckets` binding `MEDIA`, bucket `beeking-media` (free tier: 10 GB storage, 1M class-A ops/month — far above need).
- Upload happens through form actions on admin product pages (progressive enhancement, consistent with project style): validate size ≤ 5 MB, then read the first bytes and verify the magic-number signature matches one of {jpeg FF D8 FF, png 89 50 4E 47, webp RIFF....WEBP}; derive the extension from the verified signature, never from the client-declared filename or Content-Type alone. Key `products/<uuid>.<ext>`, `env.MEDIA.put(key, file.stream())`.
- Public delivery: bucket public custom domain or r2.dev base URL stored as `MEDIA_PUBLIC_BASE_URL` env var; stored DB value is `<base>/products/<key>`.
- Rejected uploads return `fail()` with i18n message; nothing partial is written.

## Routes and UI

- `/admin` — stats dashboard (cards + tables, project styling, RTL-aware like the store).
- `/admin/orders` — list with status filter chips + pagination; row links to detail.
- `/admin/orders/[id]` — full detail (customer block, items table, totals) + status action buttons rendering only legal transitions.
- `/admin/products` — list + search + "new" entry.
- `/admin/products/new`, `/admin/products/[id]` — shared product form component; variants managed inline on the edit page.
- `/admin/categories` — simple CRUD list.
- All copy via flat i18n keys in `src/lib/i18n/messages.ts` (ar/en), including new status labels.

## Security

- Every admin route guarded server-side in the layout; actions re-check role too (defense in depth) because layout guards don't cover POSTs.
- Upload validation server-side (MIME sniffing via magic bytes where practical + extension allowlist + size cap).
- No secrets logged; R2 keys random UUIDs (no user-controlled path segments).
- Rate limiting not required for owner-only endpoints; reuse existing limiter only on login bootstrap path if trivially applicable.

## Testing

- Unit (vitest, colocated `.spec.ts` like `addresses.spec.ts`):
  - transition matrix legality + cancel restock correctness + double-cancel rejection.
  - product zod schema: slug generation, price bounds, unknown category.
  - category/product delete-reference guards.
  - upload validation: bad MIME, oversize, good file.
- E2E (Playwright, existing setup): signed-in non-admin hitting `/admin` gets redirected to `/login`; admin sees dashboard KPIs render.

## Rollout (phased)

1. Phase 1 — auth plugin + migration 0008 + `ADMIN_EMAIL` bootstrap + `/admin` guard + header link.
2. Phase 2 — orders management (service + list + detail + transitions).
3. Phase 3 — products/variants/categories CRUD + R2 uploads.
4. Phase 4 — stats dashboard.

Prerequisite: finish and commit the in-progress customer-account work (addresses page tasks) first — both features touch `messages.ts` and `Header.svelte`.
