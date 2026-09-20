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
  shipping (EGP 60, free ≥ EGP 600). `CartItem` extends the serialized
  `CartLine` (`variantId`, `quantity`) with the display fields
  (`itemId`, `lineTotal`).
- `src/lib/cart-store.svelte.ts` — Svelte 5 client cart store, syncs to the
  signed cookie via `POST /api/cart`.
- `src/lib/server/cart-cookie.ts` — signed `beeking_cart` cookie (HMAC, HttpOnly,
  SameSite=Lax, 30-day max age; the pre-rename `honey_cart` name is still read
  and retired on write); `sanitizeCartLines` validates every external
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
  governorate, address, `paymentMethod` restricted to `cod`/`instapay`/`wallet`);
  messages via i18n. Card fields are deliberately absent — v1 collects cash on
  delivery or a manual transfer, so no card data enters the app.
- `src/lib/server/checkout-nonce.ts` — per-checkout nonce proof cookies
  (`beeking_checkout_<nonce>`, legacy `honey_checkout_*` still accepted): the
  load action issues a signed, expiring
  HttpOnly cookie bound to each nonce, and the submit action refuses any
  nonce the caller cannot prove. Keeps the count bounded (8) and makes a
  copied guest nonce worthless to a third party.
- `src/lib/server/env.ts` — production boot validation of `BETTER_AUTH_SECRET`
  and `ORDER_ACCESS_SECRET` (both length ≥ 32), `ORIGIN`, and well-formedness
  of the optional `ADMIN_EMAIL` (plausible email), `CART_SIGNING_SECRET`
  (length ≥ 32 when set), and `WHATSAPP_NUMBER` (international format when
  set); imported first by `auth.ts` and `db/index.ts`.
- `src/lib/server/store.ts` — catalog/store queries; FTS5 search
  (`searchProductIds` via `MATCH` prefix tokens), server-side sort
  (`newest`/`price-asc`/`price-desc` via a `MIN(price)` variant subquery), and
  paged listing (`listProductsPage` → `{ products, total, page, pageSize,
totalPages }`, page size 12). `resolveCartItems` returns `{ items, missing }`.
- `src/lib/server/orders.ts` — transactional order service (`createOrder`,
  `generateOrderNumber` → `HNY-######`); idempotent per nonce (proof-cookie
  verified at the route, ownership-checked on replay); retries order-number
  collisions with a fresh number; messages localized per `lang`. Writes one
  `store_order_item` row per cart line with a `variant_id` snapshot. Stock reservation and
  cancel-restock live in the database triggers (`0016`, recreated by `0019`),
  gated per order on `stock_version`: new orders write `stock_version = 'atomic'`
  and rely on the triggers (`OUT_OF_STOCK` aborts the whole insert batch);
  legacy orders keep `stock_version = 'legacy'` and are restocked by guarded
  service SQL, so overlapping old/new app versions never double-adjust stock.
  New orders are `status = 'pending_confirmation'`, `payment_status = 'unpaid'`,
  `payment_method` is `cod`/`instapay`/`wallet`, and `hold_expires_at` is the
  resolved hold deadline from `settlement/config.ts`. Legacy `placed`/`paid`
  fulfillment values read as `confirmed` through `parseOrderStatus`; `simulated`
  remains a legacy-only payment status and method (`parsePaymentStatus`), both
  in `src/lib/settlement/types.ts`.
- `src/lib/server/addresses.ts` — per-user saved-address service
  (`addressSchema(lang)` + `listAddresses`/`listAddressSummaries`/
  `getDefaultAddress`/`createAddress`/`updateAddress`/`setDefaultAddress`/
  `deleteAddress`, all keyed `(db, userId)`); enforces the 10-address cap and
  the single-default invariant (default promotion runs as one atomic `batch`,
  delete promotes the most recent survivor).
- `src/lib/server/rate-limit.ts` — DB-backed fixed-window rate limiter
  (`createDbRateLimiter`, `clientAddressKey`); busy retry + opportunistic
  global pruning of abandoned buckets. `AUTH_RATE_LIMITS` defines login
  (10/60 s), register (5/1 h), and password reset (3/1 h). Shipped keys:
  `login:`, `register:`, `reset:` (form actions and the matching
  `/api/auth/*` paths in `hooks.server.ts`), `acct:` (profile and security,
  15/60 s), `addr:` (address mutations, 30/60 s), `cart:` (30/60 s),
  `checkout:` (10/60 s), `claim:<orderId>` (5/1 h) with `claim-ip:` (20/1 h),
  and `search-suggestions:` (30/60 s).
- `src/lib/server/settlement/` — the manual-settlement surface:
  `types.ts` (shared browser-safe vocabulary), `lifecycle.ts` (conditional
  transition guards for both state machines and the append-only
  `store_payment_event` writes), `claims.ts` (`submitClaim`: sanitized
  transfer reference, `unpaid`/`failed` → `pending_review` only), `config.ts`
  (`settlementConfig`, `availablePaymentMethods`, `holdDeadline`; method
  availability from env), `expiry.ts` (`releaseExpiredHolds`), and `jobs.ts`
  (`runSettlementJobs`, the EM-4 hook). `src/lib/server/admin/settlement.ts`
  holds the audited
  `verifyPayment`/`rejectClaim`/`refundPayment`/`extendHold` actions.
  The settlement modules carry a coverage floor (`pnpm run test:coverage`,
  thresholds in `vite.config.ts`; floor and rationale in the runbook).
- `src/lib/server/db/{index,schema}.ts` — Drizzle client and store tables.
- `src/routes/api/cart/+server.ts` — cart sync endpoint (sanitize + sign +
  set cookie).
- `src/lib/components/` — `Button` (bits-ui `Button.Root` wrapper with
  `.btn-primary/.btn-outline/.btn-ghost` variants), `Breadcrumb` (`Separator.Root`
  dividers), `ProductCard`, `Hero`, `CartDrawer` (bits-ui `Dialog`),
  `SearchSuggestions` (bits-ui `Combobox`, `dir` follows the active language),
  `SectionTitle`, `Price`, `QuantityPicker`.
- Routes: `/` (home), `/products` + `/products/[slug]` (filterable catalog,
  server-paged), `/honey` and `/[department]/[category]` (department and
  category listings), `/blends` (retired studio: 301 → `/honey/blends` once
  the category row exists, 302 → `/honey` until then), `/cart`, `/checkout` +
  `/checkout/success/[id]`, `/login`, `/register`, `/account` (profile hub:
  name/password/sign-out), `/account/addresses` (saved-address CRUD),
  `/account/orders` + `/account/orders/[id]` (ownership-gated detail),
  `/media/[...key]` (product images served from the MEDIA KV namespace),
  `/api/cart`, `/api/health`, `/api/lang`, `/api/rpc/[...rest]` (oRPC
  endpoint — see "oRPC boundary" below).
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
- `store_product_fts` — FTS5 virtual table mirroring the bilingual product
  name/description fields (`name`/`description` and `name_en`/`description_en`),
  kept in sync by triggers, searched with `MATCH` prefix tokens.
- `store_order` — orders (number, nullable unique nonce, customer fields,
  governorate, persisted `shipping_cost` and total in qirsh, `stock_version`
  (`atomic`/`legacy` — gates which component owns stock adjustment), nullable
  `user_id`, created-at). Fulfillment `status` defaults to
  `pending_confirmation`; the vocabulary and the fulfillment transition table
  live in `src/lib/settlement/types.ts`, and the payment transition table
  (`PAYMENT_TRANSITIONS`) lives in `src/lib/server/settlement/lifecycle.ts`.
  Payment state is `payment_status`
  (`unpaid`/`pending_review`/`paid`/`failed`/`refunded`, legacy `simulated`),
  `payment_method` (`cod`/`instapay`/`wallet`, legacy `simulated`, reserved
  `paymob`), `payment_reference`, `payment_claimed_at`,
  `payment_reviewed_at`/`payment_reviewed_by`, `paid_at`, and `hold_expires_at`
  (the stock-reservation deadline). Pre-pivot rows keep
  `placed`/`paid`/`simulated`; `placed`/`paid` read as `confirmed`, and
  `simulated` stays a legacy-only value. No backfill ran. `nonce` makes
  creation idempotent per checkout attempt; the nonce is provable only by the
  checkout session that received it.
- `store_order_item` — line items (order ref, product ref, `variant_id`
  snapshot with an FK, name, `variant_name`, quantity > 0, unit price ≥ 0 in
  qirsh). The `variant_id` snapshot makes cancellation restock and inventory
  reconciliation name-independent.
- `store_payment_event` — append-only settlement ledger (order ref, `type`
  (`claim`/`verified`/`rejected`/`refund`/`expiry`/`note`), `actor`
  (`customer`/`admin`/`system`), `actor_user_id`, `method`, `reference`,
  `note`, created-at), indexed `(order_id, created_at)`. `BEFORE UPDATE` and
  `BEFORE DELETE` triggers raise `PAYMENT_EVENT_APPEND_ONLY`; a value trigger
  rejects unknown types and actors.
- Migration `0019_settlement.sql` recreates `trg_order_item_reserve_stock` and
  `trg_order_status_cancel_restock` after its `store_order` rebuild (SQLite
  leaves a trigger broken when its table is dropped) and adds the settlement
  guards: `trg_order_settlement_values_valid` / `_update` (enum guards on
  status, payment status, and payment method; legacy values accepted),
  `trg_order_cancelled_terminal` (a cancelled order cannot be reopened, so a
  cancel cannot restock twice), and the `store_payment_event` append-only and
  value triggers.
- `store_address` — saved shipping addresses per user (`user_id` not null with
  an index, deliberately **no FK** — mirrors `store_order.user_id`; deletion of
  auth users never blocks), label, recipient name, phone, city, address
  details, `is_default` flag (single default enforced in the service layer),
  created/updated timestamps. Capped at 10 rows per user (`MAX_ADDRESSES` in
  `addresses.ts`).
- `store_rate_limit` — fixed-window rate-limit buckets (key + window-start
  composite PK, count) for every key listed under `rate-limit.ts` above.
- `store_blend_benefit` — retired blend-studio benefit texts (migration 0013).
  No code reads the table; its drop is drain-gated under the staged-migration
  convention (AgDR-0002). No v1 migration removes it.
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
- Checkout resolves cart lines to variant items via
  `loadVariantSnapshots`/`validateCart` (server re-prices from the DB), then
  inserts order + items in one Drizzle batch; the settlement triggers decrement
  variant stock inside that batch and abort it entirely on any shortage, so
  stock can never go negative and a failed checkout leaves no partial state.
  New orders are `pending_confirmation` / `unpaid` with a `hold_expires_at`
  deadline. No customer path reaches `paid`: a claim can only move
  `unpaid`/`failed` to `pending_review`, and only the admin `mark_paid` action
  (with a reference or note) moves an order to `paid`. Order
  creation is idempotent per nonce: `createOrder` pre-checks the nonce and
  re-checks on a UNIQUE violation, so a replayed submit returns the existing
  order instead of duplicating it; replays re-mint the access cookie but skip
  cart-clearing, address saving, and the confirmation email.
- The submit action verifies a signed, expiring nonce-proof cookie before
  calling the order service, so a nonce observed by a third party (logs,
  shared screen) cannot create or replay an order.
- Checkout failure never echoes card data; success page is `private, no-store`.
- Settlement runs on two separate state machines: the vocabulary and
  fulfillment transitions live in `src/lib/settlement/types.ts`, and the
  payment transitions (`PAYMENT_TRANSITIONS`) in
  `src/lib/server/settlement/lifecycle.ts`.
  A transfer claim is untrusted customer input: the success-page form accepts
  an optional reference that `sanitizeReference` strips of control and bidi
  characters and caps at 120 characters, and `submitClaim` refuses
  non-transfer methods and only moves `unpaid`/`failed` to `pending_review`.
  The status change and its `store_payment_event` row commit in one batch.
  The admin order detail renders the settlement timeline and exposes
  `mark_paid` (reference or note required), `reject_claim` (note required; the
  customer may re-claim), `refund` (full refunds only, reference and note
  required, no restock), and `extend_hold` (+24 h while pre-shipment). Each
  action appends a `store_payment_event` row; the admin audit row is written
  best-effort and asynchronously (the audit write never blocks the action — the
  durability gap is tracked as M4-1).
- Hold expiry (`releaseExpiredHolds`) cancels `pending_confirmation` orders of
  any method and accepted (`confirmed`/`processing`) transfer orders whose
  payment is still `unpaid`/`pending_review`, once `hold_expires_at` plus a
  5-minute grace has passed. Only `stock_version = 'atomic'` rows are selected;
  the 0019 restock trigger returns the reservation exactly once and an `expiry`
  event is appended. An open claim becomes `failed`. The job is exposed as
  `runSettlementJobs` for the EM-4 email worker's `scheduled()` handler and is
  not wired in production yet — Cloudflare Pages has no cron runtime.
- Settlement notifications enqueue `pending` rows in the durable outbox
  (`store_notification`): `payment_claimed` (customer and admin),
  `payment_confirmed`, `payment_failed`, and `refund`. The hold-expiry notice
  (`sendHoldExpired`) is defined for the EM-4 job and enqueues a
  `status_update` cancellation. Callers wrap them in try/catch, so a
  notification failure never blocks a recorded claim or admin action.
- Rate limiting is DB-backed (`store_rate_limit`, fixed window) and covers
  the login/register/reset form actions and the matching Better Auth JSON API
  (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`,
  `/api/auth/request-password-reset`, `/api/auth/forget-password` via
  `src/hooks.server.ts`), checkout, the success-page claim (per order and per
  IP), cart sync, account profile/security, address mutations, and search
  suggestions — keys under `rate-limit.ts` above. Account order details are
  ownership-gated.
- The blend studio is retired (AgDR-0002). `/blends` 301s to `/honey/blends`
  when the `blends` category row exists and 302s to `/honey` until then; the
  temporary fallback avoids caching a 301 that would outlive the row. Blend
  products are ordinary products with variants, so they ride the same cart,
  order, stock, and admin paths as honey jars.
- Client-side navigation uses `startViewTransition`; `::view-transition-old(root)`
  stays opaque and the new page fades in over it (no white flash). Entrance
  animations are gated to the first full load via `html.has-nav`.

## Admin dashboard

- Route group `/admin` behind a role gate:
  `src/routes/admin/+layout.server.ts` redirects anyone outside `ADMIN_ROLES`
  (`super-admin`, `admin` — `src/lib/admin-roles.ts`, re-exported by
  `src/lib/server/admin/roles.ts`) to `/login` on page loads, and every mutating
  form action re-checks the role server-side (defense-in-depth — layout guards
  never cover POSTs). Role assignment on `/admin/users` is limited to
  `super-admin` (`ROLE_MANAGER_ROLES`), and the last super-admin cannot be
  demoted. The mobile sidebar is a bits-ui `Dialog` owned by
  `AdminShell` (Escape dismissal, focus containment/restoration, and a close
  when the viewport reaches desktop so focus never stays in a hidden layer).
  Pages: dashboard KPI/stats overview (`/admin`), orders
  list + detail with status transitions and the settlement panel (cancellation
  is confirm-gated in the UI and restocks inventory server-side), product
  create/edit including variants and image upload, and category CRUD. The
  orders list carries a `pending_review` payment filter and a review-queue
  shortcut (`/admin/orders?payment=pending_review`).
- Services live under `src/lib/server/admin/`: `bootstrap` (`ADMIN_EMAIL`
  promotion of the matching sign-in email), `categories`, `orders` (lifecycle
  transition table + flip-first conditional update; restock is either the
  atomic trigger or guarded legacy SQL keyed on `stock_version`), `settlement`
  (`verifyPayment`, `rejectClaim`, `refundPayment`, `extendHold`; each writes a
  `store_payment_event` row and a best-effort asynchronous admin audit row),
  `products`,
  `product-form`, `inventory` (warehouses, batches, conversions, transfers),
  `stats`, `upload` (magic-byte image validation → Workers KV). Fulfillment
  vocabulary and transitions have a single browser-safe source in
  `src/lib/settlement/types.ts`, shared by customer pages, admin UI, and the
  server; the payment transitions live in the server-only
  `src/lib/server/settlement/lifecycle.ts`. Invoices render the stored
  `shipping_cost` snapshot, never today's
  shipping policy; invoice and CSV-export responses send
  `Cache-Control: private, no-store`.
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
- CI (`.github/workflows/ci.yml`) is the single production deploy owner: one
  `test` job runs check + unit + the coverage floor + migration replay + build,
  then Playwright against that same build, and uploads the Cloudflare build
  artifact; `migrate-production` applies remote D1 migrations after `test`
  passes; `deploy-production` downloads that exact artifact and deploys it to
  Pages (no rebuild drift). Both production jobs gate on the `production`
  GitHub environment (required reviewers) and run only on pushes to `main`.
  Concurrency is keyed per ref, so PRs never queue behind or cancel a
  production deploy. `docs/production-runbook.md` covers the external setup
  (confirm the Pages Git integration stays disconnected, secrets, reviewers)
  and rollback.
- Production boot validates `BETTER_AUTH_SECRET` and `ORDER_ACCESS_SECRET`
  (length ≥ 32), `ORIGIN`, and the shape of the optional `ADMIN_EMAIL`,
  `CART_SIGNING_SECRET` (length ≥ 32 when set), and `WHATSAPP_NUMBER`
  (international format when set) via `src/lib/server/env.ts`; dev stays
  lenient.

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
