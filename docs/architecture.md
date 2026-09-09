# Architecture

Living description of the honey storefront system.

## Stack

- SvelteKit 2.70 (Svelte 5, runes), TypeScript strict
- Tailwind CSS v4 with Cairo variable font; Arabic RTL layout (`dir="rtl"`)
- Drizzle ORM + SQLite (`local.db`, libsql client), drizzle-kit for schema
- Better Auth (`auth` package) with password provider; tables in
  `src/lib/server/db/auth.schema.ts`
- Package manager: pnpm (npm refuses scripts via `devEngines` pin); toolchain:
  Vite+ (`vp dev`, `vp build`, `vp test`, `vp check`); adapter-cloudflare for
  production (Cloudflare Pages, D1 database, preview via `wrangler pages dev`)
- Testing: Vitest (unit, `*.spec.ts`) and Playwright (E2E, `*.e2e.ts`) against
  the seeded preview server
- UI primitives: `bits-ui` v2 (Dialog, ToggleGroup, Combobox, AspectRatio,
  Separator, Button) owns interactive behavior; visual identity lives in
  `src/routes/layout.css` (`.btn-*`, `.chip`, `.field`, tokens)

## Module map

- `src/lib/currency.ts` — `formatEGP`: formats integer qirsh (1/100 EGP) with
  the `ar-EG` currency locale.
- `src/lib/cart.ts` — pure cart helpers (add/remove/quantity/totals); flat
  shipping (EGP 60, free ≥ EGP 600). Cart model is a union:
  `CartEntry = CartLine | BlendLine` and `CartItem = RegularCartItem |
BlendCartItem`, so a composed blend rides the cart as one line
  (`isBlendItem`, `itemId`, `lineTotal`/`blendTotal`).
- `src/lib/blends.ts` — pure config/logic for the blends studio: 5 goal
  presets, 5 base honeys with their half/full catalog slugs, 5 additives with
  product slugs, per-additive recommended doses per jar size (`DOSE_FOR`),
  `MAX_DOSE`, `isAdditiveKey`, `presetDoses`.
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
  governorate, address); messages via i18n. Card fields are deliberately
  absent — payment is simulated out of PCI scope.
- `src/lib/server/checkout-nonce.ts` — per-checkout nonce proof cookies
  (`honey_checkout_<nonce>`): the load action issues a signed, expiring
  HttpOnly cookie bound to each nonce, and the submit action refuses any
  nonce the caller cannot prove. Keeps the count bounded (8) and makes a
  copied guest nonce worthless to a third party.
- `src/lib/server/env.ts` — production boot validation of `BETTER_AUTH_SECRET`
  and `ORDER_ACCESS_SECRET` (both length ≥ 32), `ORIGIN`, and well-formedness
  of the optional var `ADMIN_EMAIL` (plausible email); imported first by
  `auth.ts` and `db/index.ts`.
- `src/lib/server/store.ts` — catalog/store queries; FTS5 search
  (`searchProductIds` via `MATCH` prefix tokens), server-side sort
  (`newest`/`price-asc`/`price-desc` via a `MIN(price)` variant subquery), and
  paged listing (`listProductsPage` → `{ products, total, page, pageSize,
totalPages }`, page size 12). `resolveCartItems` returns `{ items, missing }`.
- `src/lib/server/orders.ts` — transactional order service (`createOrder`,
  `generateOrderNumber` → `HNY-######`); idempotent per nonce (proof-cookie
  verified at the route, ownership-checked on replay); retries order-number
  collisions with a fresh number; messages localized per `lang`. Expands each
  blend line into base-honey + additive order units (per-variant
  `store_order_item` rows with a `variant_id` snapshot). Stock reservation and
  cancel-restock live in the `0016` database triggers, gated per order on
  `stock_version`: new orders write `stock_version = 'atomic'` and rely on the
  triggers (`OUT_OF_STOCK` aborts the whole insert batch); legacy orders keep
  `stock_version = 'legacy'` and are restocked by guarded service SQL, so
  overlapping old/new app versions never double-adjust stock. New orders are
  `status = 'placed'`, `payment_status = 'simulated'`; legacy `paid` rows map
  to `placed` for display via `parseOrderStatus`.
- `src/lib/server/addresses.ts` — per-user saved-address service
  (`addressSchema(lang)` + `listAddresses`/`listAddressSummaries`/
  `getDefaultAddress`/`createAddress`/`updateAddress`/`setDefaultAddress`/
  `deleteAddress`, all keyed `(db, userId)`); enforces the 10-address cap and
  the single-default invariant (default promotion runs as one atomic `batch`,
  delete promotes the most recent survivor).
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
  `/blends` (interactive Phaser blend lab — see "Blend Lab (/blends)" below),
  `/cart`, `/checkout` + `/checkout/success/[id]`, `/login`, `/register`,
  `/account` (profile hub: name/password/sign-out), `/account/addresses`
  (saved-address CRUD), `/account/orders` + `/account/orders/[id]`
  (ownership-gated detail), `/media/[...key]` (product
  images served from the MEDIA KV namespace), `/api/cart`, `/api/health`,
  `/api/lang`, `/api/rpc/[...rest]` (oRPC endpoint — see "oRPC boundary"
  below).
- oRPC boundary: search suggestions are a contract-first oRPC procedure
  (`src/lib/features/search/`: `contract.ts` (zod input 2–100 chars, typed
  output, `TOO_MANY_REQUESTS` error), `router.ts` (rate-limited
  implementation reusing the store queries), `client.ts` (typed
  `ContractRouterClient`)), mounted request-scoped at
  `src/routes/api/rpc/[...rest]/+server.ts` via `RPCHandler`. The storefront
  `SearchSuggestions` component consumes the typed client. This is the
  template for future contract-first capabilities; SvelteKit server actions
  remain the transport for form flows where they are simpler.

## Data model

- `store_category` — categories (name, slug).
- `store_product` — honey types (name, slug, description, image, category ref,
  featured). Money/stock live on variants.
- `store_product_variant` — sellable lines per product (name, price in qirsh,
  stock, image, sort order). Cart/checkout/orders are keyed by variant.
- `store_product_fts` — FTS5 virtual table mirroring product name/description,
  kept in sync by triggers, searched with `MATCH` prefix tokens.
- `store_order` — orders (number, nullable unique nonce, customer fields,
  governorate, persisted `shipping_cost` and total in qirsh, `status`
  (lifecycle vocabulary in `src/lib/admin-order-status.ts`), `payment_status`
  (`simulated` until a real gateway lands), `stock_version`
  (`atomic`/`legacy` — gates which component owns stock adjustment), nullable
  `user_id`, created-at). `nonce` makes creation idempotent per checkout
  attempt; the nonce is provable only by the checkout session that received it.
- `store_order_item` — line items (order ref, product ref, `variant_id`
  snapshot with an FK, name, `variant_name`, quantity > 0, unit price ≥ 0 in
  qirsh). The `variant_id` snapshot makes cancellation restock and inventory
  reconciliation name-independent.
- `store_address` — saved shipping addresses per user (`user_id` not null with
  an index, deliberately **no FK** — mirrors `store_order.user_id`; deletion of
  auth users never blocks), label, recipient name, phone, city, address
  details, `is_default` flag (single default enforced in the service layer),
  created/updated timestamps. Capped at 10 rows per user (`MAX_ADDRESSES` in
  `addresses.ts`).
- `store_rate_limit` — fixed-window rate-limit buckets (key + window-start
  composite PK, count) for auth endpoints.
- Better Auth tables — user/session/account, etc.

## Notable behavior

- Cart is client-mirrored and server-signed; the server is the source of truth
  at order time. `POST /api/cart` sanitizes unsigned input before signing. A
  `storage` listener keeps cart state in sync across tabs; `resolveCartItems`
  reports missing variants so the checkout page prunes them from the UI.
- Blend items (`/blends`) are composed client-side but re-priced from the DB at
  resolve/order time (base variant price + Σ additive price × qty), so a
  composed blend's total can't be tampered with via the cookie.
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
- Checkout resolves cart lines to variant items via
  `loadVariantSnapshots`/`validateCart` (server re-prices from the DB), then
  inserts order + items in one Drizzle batch; the `0016` triggers decrement
  variant stock inside that batch and abort it entirely on any shortage, so
  stock can never go negative and a failed checkout leaves no partial state.
  New orders are `status = "placed"`, `payment_status = "simulated"` — no
  order is ever marked genuinely paid until a real gateway exists. Order
  creation is idempotent per nonce: `createOrder` pre-checks the nonce and
  re-checks on a UNIQUE violation, so a replayed submit returns the existing
  order instead of duplicating it; replays re-mint the access cookie but skip
  cart-clearing, address saving, and the confirmation email.
- The submit action verifies a signed, expiring nonce-proof cookie before
  calling the order service, so a nonce observed by a third party (logs,
  shared screen) cannot create or replay an order.
- Checkout failure never echoes card data; success page is `private, no-store`.
- Auth rate limiting is DB-backed (`store_rate_limit`, fixed window); the
  limiter guards both the login/register form actions and Better Auth's JSON
  API (`/api/auth/sign-in/email`, `/api/auth/sign-up/email` via
  `src/hooks.server.ts`); account order details are ownership-gated.
- Client-side navigation uses `startViewTransition`; `::view-transition-old(root)`
  stays opaque and the new page fades in over it (no white flash). Entrance
  animations are gated to the first full load via `html.has-nav`.

## Admin dashboard

- Route group `/admin` behind a role gate:
  `src/routes/admin/+layout.server.ts` redirects anyone without
  `locals.user.role === "admin"` to `/login` on page loads, and every mutating
  form action re-checks the role server-side (defense-in-depth — layout guards
  never cover POSTs). Pages: dashboard KPI/stats overview (`/admin`), orders
  list + detail with status transitions (cancellation is confirm-gated in the
  UI and restocks inventory server-side), product create/edit including
  variants and image upload, and category CRUD.
- Services live under `src/lib/server/admin/`: `bootstrap` (`ADMIN_EMAIL`
  promotion of the matching sign-in email), `categories`, `orders` (lifecycle
  transition table + flip-first conditional update; restock is either the
  atomic trigger or guarded legacy SQL keyed on `stock_version`), `products`,
  `product-form`, `inventory` (warehouses, batches, conversions, transfers),
  `stats`, `upload` (magic-byte image validation → Workers KV). Order-status
  vocabulary and allowed transitions have a single browser-safe source in
  `src/lib/admin-order-status.ts`, shared by customer pages, admin UI, and the
  server. Invoices render the stored `shipping_cost` snapshot, never today's
  shipping policy.
- Media: a Workers KV namespace is bound as `MEDIA` in `wrangler.jsonc`;
  uploads are stored at `products/<uuid>.<ext>` and persisted as RELATIVE
  `/media/products/<uuid>.<ext>` urls. The serving route
  `src/routes/media/[...key]/+server.ts` pattern-validates keys (so the KV
  namespace can never act as an open read proxy), serves edge-cache-first via
  `caches.default` (+ `waitUntil(cache.put)` background fill), and sets
  `Cache-Control: public, max-age=31536000, immutable` — safe because fresh
  UUID keys are never rewritten. Upload happens before the product DB write so
  a failed write cannot fork duplicate products on retry.

## Deployment

- **Cloudflare Pages** with `adapter-cloudflare`; build output `.svelte-kit/cloudflare`
  compiled to a single `_worker.js`; `wrangler pages dev` for local testing.
- **Cloudflare D1** (SQLite) as the production database; lazy driver in
  `src/lib/server/db/index.ts` resolves `platform.env.DB` (D1) in Cloudflare or
  falls back to libsql (`file:local.db`) for local dev/tests. FTS5 search works
  on D1; virtual-table DDL is in `drizzle/` migrations (applied via
  `wrangler d1 migrations apply`).
- Migrations applied via `wrangler d1 migrations apply beeking` (remote) or
  `--local` (dev). Seed via `wrangler d1 execute beeking --file=d1-seed.sql`.
- Compatibility flags: `nodejs_als` (required) + `nodejs_compat` (HMAC crypto).
- CI (`.github/workflows/ci.yml`) is the single production deploy owner: the
  `test` job runs check + unit + migration replay + build and uploads the
  Cloudflare build artifact; the `e2e` job downloads that exact artifact and
  runs Playwright against it (no rebuild drift); `migrate-production` applies
  remote D1 migrations only after both pass; `deploy-production` deploys the
  downloaded build to Pages. Both production jobs gate on the `production`
  GitHub environment (required reviewers) and run only on pushes to `main`.
  Concurrency is keyed per ref, so PRs never queue behind or cancel a
  production deploy. `docs/production-runbook.md` covers the external setup
  (disable the Pages Git integration, secrets, reviewers) and rollback.
- Production boot validates `BETTER_AUTH_SECRET` and `ORDER_ACCESS_SECRET`
  (length ≥ 32), `ORIGIN`, and the shape of the optional `ADMIN_EMAIL` via
  `src/lib/server/env.ts`; dev stays lenient.

## Cost posture (Cloudflare Free tier)

The site runs entirely on Cloudflare's Free plan at $0/month:

- **Pages** (`beeking-etman-website.pages.dev`): static asset requests and
  bandwidth are unmetered on Free. Functions/Worker invocations are capped at
  100K requests/day (shared Workers Free limit).
- **D1** (`beeking`, ~300 KB): Free tier allows 5M rows read/day,
  100K rows written/day, 5 GB total storage. Current catalog traffic is orders
  of magnitude below these limits.
- **Deploys**: GitHub Actions builds and direct-uploads via
  `wrangler pages deploy`, so the Pages 500-builds/month quota is not consumed;
  Actions minutes come from the GitHub Free allowance.
- **Assets**: all catalog images are first-party under
  `static/images/Beeking Etman/` (no Unsplash/Pexels CDN dependence); fonts are
  self-hosted under `static/fonts/`.
- **Monitoring**: dashboard → Workers & Pages → project for request counts;
  D1 → `beeking` → Metrics → Row Metrics for rows read/written. If daily D1
  reads approach the limit, the next lever is edge-caching catalog pages —
  deliberately not implemented now to keep checkout/stock behavior simple.
- After changing catalog data locally, re-apply the regenerated seed remotely:
  `wrangler d1 execute beeking --remote --file=d1-seed.sql` (idempotent,
  FK-safe upserts).

## Known environment quirk (pre-existing)

- `vp dev` serves HTML without client entry scripts in this environment, so
  hydration/clicks do not work in dev mode. The production build (`vp preview`)
  hydrates and works normally. `vp env doctor` reports all checks passing; this
  is a Vite+ dev integration behavior, not an app bug. E2E therefore runs
  against the preview server.

## Blend Lab (/blends)

Interactive honey-blending game built with Phaser 3 (v3.90) on Svelte 5 runes. One game serves
every device: `Phaser.AUTO` uses WebGL when available and falls back to Canvas automatically.

- State: single `BlendsGame` runes class (`src/lib/blend-lab/game-state.svelte.ts`) drives steps
  goal → honey → prep → stir → pour → order. All stations/components read state via context.
- Pure logic (stir math, color mixing, pricing, benefits data) lives in plain TS modules under
  `src/lib/blend-lab/` with vitest coverage.
- Rendering is split by concern: Phaser owns the world only (`src/lib/blend-lab/phaser/` —
  `constants.ts`, `textures.ts` procedural art, `bridge.ts`, `scenes/`, `create-game.ts`);
  all text, commerce, and i18n UI stay in Svelte DOM overlays
  (`src/routes/blends/BlendGame.svelte`) so RTL Arabic and cart flows never touch canvas text.
- The two worlds talk through a typed bridge: Svelte→Phaser via immutable snapshots pushed on a
  `$effect`; Phaser→Svelte via direct `BlendsGame` calls plus typed inspect events.
- Every canvas action has an accessible DOM twin in the sr-only action bar
  (`src/lib/blend-lab/ui/ActionBar.svelte`) — keyboard users and e2e tests drive it instead of
  pixel coordinates.
- Art is fully procedural (Graphics + canvas textures); no binary assets ship for the lab.
- Ordering reuses the cart store `addBlend` contract unchanged; backend orders API untouched.
