# Architecture

Living description of the honey storefront system. Implementation plan and
design spec: `docs/superpowers/plans/2026-08-12-honey-store.md` and
`docs/superpowers/specs/2026-08-12-honey-store-design.md`.

## Stack

- SvelteKit 2.70 (Svelte 5, runes), TypeScript strict
- Tailwind CSS v4 with Cairo variable font; Arabic RTL layout (`dir="rtl"`)
- Drizzle ORM + SQLite (`local.db`, libsql client), drizzle-kit for schema
- Better Auth (`auth` package) with password provider; tables in
  `src/lib/server/db/auth.schema.ts`
- Package manager: pnpm (npm refuses scripts via `devEngines` pin); toolchain:
  Vite+ (`vp dev`, `vp build`, `vp test`, `vp check`); adapter-node for
  production (preview via `vp preview`)
- Testing: Vitest (unit, `*.spec.ts`) and Playwright (E2E, `*.e2e.ts`) against
  the seeded preview server
- UI primitives: `bits-ui` v2 (Dialog, ToggleGroup, Combobox, AspectRatio,
  Separator, Button) owns interactive behavior; visual identity lives in
  `src/routes/layout.css` (`.btn-*`, `.chip`, `.field`, tokens)

## Module map

- `src/lib/currency.ts` — `formatEGP`: formats integer qirsh (1/100 EGP) with
  the `ar-EG` currency locale.
- `src/lib/cart.ts` — pure cart helpers (add/remove/quantity/totals); flat
  shipping (EGP 60, free ≥ EGP 600).
- `src/lib/cart-store.svelte.ts` — Svelte 5 client cart store, syncs to the
  signed cookie via `POST /api/cart`.
- `src/lib/server/cart-cookie.ts` — signed `honey_cart` cookie (HMAC, HttpOnly,
  SameSite=Lax, 30-day max age); `sanitizeCartLines` validates every external
  cart payload; `getCartSecret(env)`.
- `src/lib/i18n/messages.ts` — bilingual message catalogs (`ar` + `en`,
  `Record<MessageKey, string>` parity enforced by types), `t(lang, key, params)`
  interpolation with ar→key fallback, `getDir`, `getLocale`.
- `src/lib/server/lang.ts` — `lang` cookie read/write (`getLang`, `setLangCookie`);
  `/api/lang` POST switches the language.
- `src/lib/server/sqlite.ts` — shared SQLite resilience helpers: `isBusyError`,
  `SQLITE_BUSY_RETRIES`, `sleep`.
- `src/lib/server/checkout-schema.ts` — zod schema factory
  `createCheckoutSchema(lang)` (nonce, name, email, Egyptian phone, city,
  address, mock card fields with a past-date expiry check); messages via i18n.
- `src/lib/server/env.ts` — production boot validation of `BETTER_AUTH_SECRET`
  (length ≥ 32) and `ORIGIN`; imported first by `auth.ts` and `db/index.ts`.
- `src/lib/server/store.ts` — catalog/store queries; FTS5 search
  (`searchProductIds` via `MATCH` prefix tokens), server-side sort
  (`newest`/`price-asc`/`price-desc` via a `MIN(price)` variant subquery), and
  paged listing (`listProductsPage` → `{ products, total, page, pageSize,
totalPages }`, page size 12). `resolveCartItems` returns `{ items, missing }`.
- `src/lib/server/orders.ts` — transactional order service with mock payment
  (`createOrder`, `generateOrderNumber` → `HNY-######`); idempotent per nonce;
  retries order-number collisions with a fresh number; messages localized per
  `lang`.
- `src/lib/server/rate-limit.ts` — DB-backed fixed-window rate limiter for
  auth actions and checkout (`createDbRateLimiter`, `clientAddressKey`); busy
  retry + opportunistic global pruning of abandoned buckets.
- `src/lib/server/db/{index,schema}.ts` — Drizzle client and store tables.
- `src/routes/api/cart/+server.ts` — cart sync endpoint (sanitize + sign +
  set cookie).
- `src/lib/components/` — `Button` (bits-ui `Button.Root` wrapper with
  `.btn-primary/.btn-outline/.btn-ghost` variants), `Breadcrumb` (`Separator.Root`
  dividers), `ProductCard`, `Hero`, `CartDrawer` (bits-ui `Dialog`),
  `SearchSuggestions` (bits-ui `Combobox`, `dir` follows the active language),
  `SectionTitle`, `Price`, `QuantityPicker`.
- Routes: `/` (home), `/products` + `/products/[slug]` (catalog, server-paged),
  `/cart`, `/checkout` + `/checkout/success/[id]`, `/login`, `/register`,
  `/account/orders` (signed-in user's orders), `/api/cart`, `/api/health`,
  `/api/lang`.

## Data model

- `store_category` — categories (name, slug).
- `store_product` — honey types (name, slug, description, image, category ref,
  featured). Money/stock live on variants.
- `store_product_variant` — sellable lines per product (name, price in qirsh,
  stock, image, sort order). Cart/checkout/orders are keyed by variant.
- `store_product_fts` — FTS5 virtual table mirroring product name/description,
  kept in sync by triggers, searched with `MATCH` prefix tokens.
- `store_order` — orders (number, nullable unique nonce, customer fields,
  total in qirsh, status, nullable `user_id`, created-at). `nonce` makes
  creation idempotent per checkout attempt.
- `store_order_item` — line items (order ref, product ref, name, `variant_name`,
  quantity, unit price in qirsh).
- `store_rate_limit` — fixed-window rate-limit buckets (key + window-start
  composite PK, count) for auth endpoints.
- Better Auth tables — user/session/account, etc.

## Notable behavior

- Cart is client-mirrored and server-signed; the server is the source of truth
  at order time. `POST /api/cart` sanitizes unsigned input before signing. A
  `storage` listener keeps cart state in sync across tabs; `resolveCartItems`
  reports missing variants so the checkout page prunes them from the UI.
- The catalog is server-sorted and paged (`/products`, 12/page); search goes
  through SQLite FTS5 (indexing both Arabic and English name/description).
- Language is Arabic by default and switchable to English (`lang` cookie); all
  UI chrome and server messages localize via `src/lib/i18n/messages.ts`. A
  first visit auto-detects the browser language from the `Accept-Language`
  header (`parseAcceptLanguage` in `src/lib/server/lang.ts`, q-value aware),
  with the explicit cookie always taking precedence. Catalog content is stored
  bilingually (`name`/`description` + `name_en`/
  `description_en` on category/product/variant); `store.ts` queries take a
  `lang` and localize via a `localized()` helper. `GET /api/cart` resolves
  cookie cart lines in the active language so client-side cart names refresh.
  `formatEGP(amount, lang)` in `src/lib/currency.ts` formats prices with
  `ar-EG` (Arabic-Indic digits) or `en-US` (Western digits + `EGP`).
- Checkout resolves cart lines to variant items via `resolveCartItems`, then
  runs in a Drizzle transaction: re-reads variant stock, decrements with a
  stock guard, inserts order + items (with `variant_name`), mocks payment
  (`status = "paid"`). A failed payment leaves the cart intact. Order creation
  is idempotent per nonce: `createOrder` pre-checks the nonce and re-checks on
  a UNIQUE violation, so a replayed submit returns the existing order instead
  of duplicating it.
- Checkout failure never echoes card data; success page is `private, no-store`.
- Auth rate limiting is DB-backed (`store_rate_limit`, fixed window); the
  limiter guards both the login/register form actions and Better Auth's JSON
  API (`/api/auth/sign-in/email`, `/api/auth/sign-up/email` via
  `src/hooks.server.ts`); account order details are ownership-gated.
- Client-side navigation uses `startViewTransition`; `::view-transition-old(root)`
  stays opaque and the new page fades in over it (no white flash). Entrance
  animations are gated to the first full load via `html.has-nav`.

## Deployment

- Containerized with a multi-stage `Dockerfile` (node:22-alpine, non-root
  runtime, `HEALTHCHECK` against `/api/health`); `.dockerignore` keeps the
  build context lean. The runtime image runs `scripts/migrate.mjs`
  (drizzle-orm migrator, plain ESM) before boot so a fresh container never
  starts with an empty schema, and `/api/health` probes the DB (`select 1`) so
  a broken database fails the healthcheck. CI (`.github/workflows/ci.yml`)
  runs check + unit + build, then a gated e2e job against the preview server.
- Production boot validates `BETTER_AUTH_SECRET` (length ≥ 32) and `ORIGIN`
  via `src/lib/server/env.ts`; dev stays lenient.
- Persistence note: the container must mount a volume at the SQLite path (or
  use a libsql remote) so orders survive a redeploy; see `docs/todo.md`.

## Known environment quirk (pre-existing)

- `vp dev` serves HTML without client entry scripts in this environment, so
  hydration/clicks do not work in dev mode. The production build (`vp preview`)
  hydrates and works normally. `vp env doctor` reports all checks passing; this
  is a Vite+ dev integration behavior, not an app bug. E2E therefore runs
  against the preview server.
