# Architecture Decision Records

Append-only, newest last. Each entry records a meaningful architectural choice.

## 2026-08-16: Thoughtful bits-ui adoption for interactive primitives

**Context:** The storefront hand-rolled a lot of interaction code (cart drawer
focus trap/Escape/scroll-lock, native selects for variants/sort, fixed aspect
ratios, duplicated breadcrumbs and button markup) while `bits-ui` was already in
`package.json`. The user asked to use the library's full feature set for
consistency with less custom code, keep the existing visual identity, and fix a
white flash/flicker on client-side route changes.

**Decision:**

- **Flash fix:** `::view-transition-old(root)` is frozen (`animation: none`) and
  `::view-transition-new(root)` fades in over it, so the near-white `paper`
  background never flashes through during the cross-fade. Entrance animations
  (`animate-fade-up/float/spin-slow`) are gated to the first full load via
  `html.has-nav` (set in `beforeNavigate`) — they no longer replay on every
  client-side navigation.
- **RTL for floating layers:** bits-ui floating layers default to `dir="ltr"`
  and do not auto-detect direction. `Combobox.Content` now receives an explicit
  `dir="rtl"`, fixing both Arabic text rendering and floating-ui logical
  alignment (the dropdown aligns to the input's right edge).
- **Dialog for the cart drawer:** `CartDrawer` uses `Dialog.Root bind:open`
  - Portal/Overlay/Content/Title/Description/Close, deleting ~60 lines of
    hand-rolled a11y code. The drawer test id stays `data-testid="cart-drawer"`.
- **ToggleGroup** replaces the native selects for variant (product detail) and
  sort/category (products page) selection; `.chip` + a `data-[state=on]`-driven
  `@utility chip-active` keep the existing visual. The "الكل" category item uses
  an explicit `"all"` sentinel so an empty selection still highlights the
  default item (ToggleGroup's single-mode `""` means "nothing selected").
- **AspectRatio.Root** for product images (cards + detail + Hero) fixes
  layout shift.
- **Shared components:** `Breadcrumb` (uses `Separator.Root` for dividers) and
  `Button` (wraps bits-ui `Button.Root`, mapping `variant` →
  `.btn-primary/.btn-outline/.btn-ghost`) adopted site-wide.
- **Cleanup:** removed dead CSS (`wordmark`, `rule-flourish`); moved
  `@utility chip-active` out of `@layer components` (Tailwind v4 forbids nesting
  `@utility`); dropped a redundant `await` in `getProductWithVariants`; hardened
  `verify.e2e.ts` to wait for the initial `load` event before counting full
  loads.

**Consequences:** bits-ui now owns the interactive behavior (dialog, toggle
groups, combobox positioning, aspect ratio) while the design stays in
`layout.css`. The full gate is green: `vp check` clean (0 errors/warnings), 59
unit tests pass, 5 e2e tests pass (view transitions still fire, CLS low, no
`.reveal-hidden`), verified across repeated runs.

## 2026-08-14: One product per sellable line with per-container imagery

**Context:** The user's real price list is 43 sellable lines (عسل برسيم 1 ك
زجاج، 1 ك بلاستيك، 1 ك اسكويز، 500 زجاج، Vib، نص Vib، شمع، مكسرات بالعسل…). The
variant model grouped them under ~21 honey types, so each line was a button on a
shared page and the catalog rotated ~10 generic photos that did not represent
the actual packages. The user asked for each line to be its own product with a
truly representative image, organized under category sections.

**Decision:** Flattened the catalog: each of the user's 43 lines is now its own
`store_product` with a single `store_product_variant` (schema unchanged — cart,
checkout, and store queries still work as-is). Product names are the user's exact
line names (مكسرات بالعسل for the former عسل مكسرات). Images are new, verified
(`curl` 200 `image/*`) Unsplash/Pexels photos chosen per package type: glass jar
(light/dark), plastic jar, squeeze bottle, comb frame, comb chunks, nuts-in-honey
jar, tin can, plus per-nut shots (بندق/فستق/لوز/كاجو/مشكّل), bee pollen, royal
jelly, propolis, ginseng, palm pollen, and honey spoons — no more shared generic
art. Home rails, category stories, and the hero caption were updated to the new
slugs; the e2e flow now opens `sidr-honey-1kg` directly (no size selector).

**Consequences:** 43 standalone product pages each with an accurate image, name,
price, and description. Products sharing a package type still share a photo
(e.g. all plastic jars), which is acceptable; a true first-party photo shoot
remains the future option (tracked in `docs/todo.md`).

## 2026-08-14: PNG brand logo replaces SVG BrandMark

**Context:** The user provided a real brand logo (`static/images/logo.png`,
643×649 RGBA) and asked to use it as the store's logo.

**Decision:** Replaced the generated `BrandMark.svelte` SVG component with the
PNG in the header, footer, and auth pages (`<img src="/images/logo.png">`).
The now-unused component was deleted. The wordmark text (مملكة النحل / عتمان
الأصلي) was removed from the visual chrome — the image alone is the logo — but
is kept as `sr-only` text (plus the `alt` attribute) so the brand name stays
present for SEO and screen readers.

**Consequences:** The brand uses the owner's actual mark as a standalone logo;
the SVG is gone. Favicon remains the `favicon.svg` in `$lib/assets`.

## 2026-08-14: Light editorial UI redesign (minimal + clean)

**Context:** The Royal Kingdom dark+gold theme felt heavy against the artisanal
honey brand. The user asked for a "minimal and clean" redesign of the whole
storefront, replacing the royal look entirely rather than layering on top of
it.

**Decision:** Replaced the gold-on-ink system with a light, airy editorial
system in `src/routes/layout.css`: warm paper/white background, deep cocoa
text, ONE restrained honey accent (honey-700), clean Cairo body with Amiri
display, subtle 1px cocoa borders, and minimal shadows. Removed all royal
motifs (gold drips, marquee ticker, arch frames, honeycomb/grain/dot
textures, count-up hero, gold-gradient buttons) — `.btn-primary`, `.btn-outline`,
`.btn-ghost`, `.chip`/`.chip-active`, `.eyebrow`, and a new shared
`BrandMark.svelte` logo component replaced them. The five UI areas (chrome,
landing, catalog, commerce, auth) were redesigned in parallel by subagents
against the shared token foundation, then QA'd and verified. `Aref Ruqaa`
font import removed (wordmark now renders in Amiri).

**Consequences:** A cohesive minimal storefront that still preserves every
Arabic e2e hook, `data-testid`, field label, and button name, so the full test
suite passes unchanged (59 unit + 2 e2e). The `vp check` gate is clean aside
from one pre-existing `await-thenable` warning in `src/lib/server/store.ts`.

## 2026-08-13: Harden checkout against double-submit and card echo

**Context:** Code review of the checkout flow (commit `845c211`) found two blockers:
(1) the submit button was not disabled during an in-flight request, so rapid
double-clicks could create duplicate orders; (2) the re-rendered failure page
echoed the submitted card number, expiry, and CVV back into the DOM via form
`value` round-tripping. Follow-ups also asked to fix the success page cache
headers, order-by determinism, a dead import, and a type cast.

**Decision:**

- Disable the submit button while pending (`submitting` state) with
  `use:enhance`; the enhance callback calls `update()` with no arguments so
  SvelteKit's default behavior (including redirect navigation on action
  `redirect()`) is preserved. A callback passing `result` would break
  redirects in SvelteKit 2.70.2 because action redirects serialize as
  `result.type === "redirect"`.
- Build the re-rendered `values` from a `shippingValues(form)` helper that
  filters out the `CARD_FIELDS` set (`cardNumber`, `cardExpiry`, `cardCvc`).
  All three failure returns (validation/cart-empty, and the out-of-stock 409)
  are annotated `satisfies CheckoutFail` so the client can read
  `form?.errors?.[name]` without a cast.
- Set `cache-control: private, no-store` on the success page via
  `setHeaders` (page loads cannot return `headers`; the whole return is
  devalued into `data`), and order order items by `id` for deterministic
  rendering.
- Extract `getCartSecret(env)` into `src/lib/server/cart-cookie.ts` and
  reuse it from the API endpoint.

**Consequences:** Card data never reaches the DOM on failure. Client-side
double-submit is prevented; a server-side second submit after the cart cookie
is cleared fails on the empty-cart guard, so sequential submits cannot create
duplicate orders (concurrent two-tab submits still can — tracked in
`docs/todo.md`).
Verified by smoke tests: one order on rapid double-click, no card values in
the 400 response, 303 redirect + cookie clear + no-store header on success.

## 2026-08-12: Mock payment via transactional order service

**Context:** The storefront has no real payment provider. Checkout needed a
realistic but mock payment step that either succeeds or fails deterministically
and only persists an order on success.

**Decision:** A server-only `orderService` (`src/lib/server/orders.ts`) runs in
a Drizzle transaction: re-reads stock, decrements quantities, inserts the order
and its items. Payment is mocked (`order.status = "paid"` on success). Cart
cookie consumption and stock/order writes are atomic; a failed payment leaves
the cart intact.

**Consequences:** One order at most per cart, stock is only decremented when an
order is actually persisted. Enables the checkout hardening ADR above.

## 2026-08-12: Stateless signed cart cookie

**Context:** The cart must survive reloads and be readable in server load
functions and API endpoints without a server-side cart table.

**Decision:** The cart is a signed, HttpOnly, SameSite=Lax cookie
(`honey_cart`) built by `src/lib/server/cart-cookie.ts` using HMAC
signatures derived from a server secret (`BETTER_AUTH_SECRET`). The client
mirrors it in a Svelte 5 rune store (`src/lib/cart-store.svelte.ts`) and syncs
via `POST /api/cart`.

**Consequences:** Stateless, no cart table needed; tampering is detectable via
signature mismatch (cookie rejected). Secret access is centralized in
`getCartSecret`.

## 2026-08-13: Arabic RTL storefront

**Context:** The storefront targets Egyptian honey buyers; all product copy and
UI text are Arabic and checkout validates Egyptian phone numbers.

**Decision:** The app is a full Arabic RTL storefront: `dir="rtl"` on `<html>`,
Arabic strings embedded verbatim (no i18n layer), Cairo variable font
(`@fontsource-variable/cairo`), `ar-EG` locale for dates and currency, and a
honey-toned Tailwind palette (honey/cream/stone) defined in
`src/routes/layout.css`.

**Consequences:** Layout uses RTL-native (logical) properties; e2e tests select
by Arabic text. Adding a second language later requires introducing an i18n
layer.

## 2026-08-13: EGP prices stored as integer qirsh

**Context:** Prices are in Egyptian pounds; floats invite rounding and
comparison bugs.

**Decision:** All money is stored as integer qirsh (1/100 EGP) in
`store_product.price`, `store_order.total`, and `store_order_item.unit_price`.
`formatEGP` (`src/lib/currency.ts`) divides by 100 and formats with
`Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" })`. Seed data
uses qirsh literals (e.g. `380_00` = EGP 380).

**Consequences:** Exact integer arithmetic; callers must keep amounts in qirsh
and divide only at format time.

## 2026-08-13: Guest-first checkout with optional accounts

**Context:** First-time buyers should not need an account to place an order.

**Decision:** Checkout is guest-first: `store_order.user_id` is nullable and the
checkout action attaches `locals.user?.id` when a session exists. Better Auth
(password provider, drizzle adapter, `sveltekitCookies` plugin) powers optional
accounts: `/login`, `/register`, and `/account/orders` (order history gated by
ownership).

**Consequences:** Guests always complete checkout; accounts add order history on
top without blocking purchase.

## 2026-08-13: Flat shipping fee with free-shipping threshold

**Context:** Small store; shipping needs to be simple and predictable.

**Decision:** Flat shipping fee of EGP 60 (`SHIPPING_COST = 60_00`), free when
the subtotal is ≥ EGP 600 (`FREE_SHIPPING_THRESHOLD = 600_00`,
`src/lib/cart.ts`); an empty cart pays nothing.

**Consequences:** Totals are easy to reason about; no zone/weight logic.

## 2026-08-13: Server-side cart sanitization at the API boundary

**Context:** `POST /api/cart` accepts unsigned JSON from the client — only the
stored cookie is HMAC-signed.

**Decision:** Every external cart input is validated by `sanitizeCartLines`
(`src/lib/server/cart-cookie.ts`): entries must have a string `productId` and a
finite positive quantity, which is floored to an integer; invalid entries are
dropped. The signed-cookie path re-verifies the HMAC and re-sanitizes on read.

**Consequences:** Malformed client payloads cannot corrupt the cart; tampered
cookies are rejected by signature mismatch.

## 2026-08-14: Artisanal bohemian UI redesign

**Context:** The storefront UI (plain Tailwind, stock photos) did not match the
"بيت العسل" artisanal brand.

**Decision:** Redesigned the whole UI as a handcrafted "House of Honey" system
in `src/routes/layout.css` and all components/pages: Aref Ruqaa for the
wordmark and Amiri for headlines (both `@fontsource` Arabic subsets, dev
dependencies) on the existing Cairo body font; a paper/parchment/cocoa/honey/
olive/clay palette; custom classes `.btn-honey`, `.btn-dark`, `.btn-outline`,
`.field`, `.chip`, `.arch-frame(-lg)`, `.rule-flourish`, `.honeycomb-bg`,
`.dot-bg`, `.grain-bg`; `--texture-*` custom properties in `:root`; and
`@keyframes fade-up`/`float-y` exposed as Tailwind v4 `@utility` classes so
`motion-safe:` variants work (radius tokens were hardcoded because `@theme
inline` does not emit custom properties to `:root`).

**Consequences:** A cohesive artisanal aesthetic; product imagery is now
first-party. All e2e selectors, `data-testid`s, and unit-test expectations were
preserved so the suite still passes unchanged.

## 2026-08-14: Authentic Egyptian honey catalog with bespoke SVG art

**Context:** The seeded catalog mixed non-Egyptian products (مانوكا، صنوبر) and
rotated only three generic stock photos, so the store did not look like an
Egyptian honey shop.

**Decision:** Replaced the catalog with 14 authentic Egyptian honeys across 4
categories (سدر، برسيم، موالح، أعشاب جبلية وخلطات) — e.g. عسل سدر سيناء، برسيم
مصري، زهر البرتقال، غذاء ملكي، قطن صعيدي، قرص شمع، بوكس هدايا — at realistic EGP
qirsh prices. Product art is a set of hand-drawn SVG illustrations
(`static/images/honey/*.svg`): a jar per variety in its true honey tone, a
honeycomb slab for قرص الشمع, and a gift box. The seed now prunes products and
categories whose slugs are absent from the seed (it previously only upserted,
so removed items lingered).

**Consequences:** Every image clearly reads as honey and loads from first-party
static assets (no remote 404 risk). Seed runs are idempotent. The `sidr-natural`
product (عسل سدر طبيعي) is preserved, so the e2e suite is unchanged.

## 2026-08-14: Variant product model (size/package per honey type)

**Context:** The real Egyptian catalog sells the same honey in many sizes and
packages (500 جم، 1 ك، زجاج، بلاستيك، Vib، اسكويز…). Treating each as a separate
`store_product` duplicated names and blurry search; the user's 43-line price list
is really ~21 honey types × variant lines.

**Decision:** `store_product` becomes a honey _type_ and a new
`store_product_variant` table (`id, productId, name, price, stock, image,
sortOrder`) carries the sellable lines. Cart/checkout/order are variant-keyed:
`CartLine { variantId, quantity }`, `CartItem` carries `variantName`, and
`store_order_item.variant_name` records the purchased line (migration
`drizzle/0001_messy_vargas.sql`). Store queries return `ProductSummary` with
`variants` + `minPrice`; `resolveCartItems(db, lines)` joins variant→product for
checkout/orders. Seed maps each of the user's 43 lines to exactly one variant.

**Consequences:** One product page per honey with a size selector; cards show
min-price and quick-add the cheapest in-stock variant; order history shows the
exact line bought. Stock is decremented per variant.

## 2026-08-14: Royal Kingdom rebrand with real honey photography

**Context:** The user named the store مملكة النحل (عتمان الأصلي) and asked to
compete with big Egyptian honey sites using a luxury dark+gold aesthetic and real
photography instead of the hand-drawn SVG art.

**Decision:** Rebranded everywhere (favicon, header/footer wordmarks, titles) to
مملكة النحل / عتمان الأصلي with a gold-on-ink Royal Kingdom theme over parchment:
new `ink-*`/`gold-*` Tailwind tokens, `.btn-gold`/`.btn-ink` buttons, royal
textures, `::view-transition-*` styles, and `@utility` animations (`animate-drip`,
`animate-shine`, `animate-marquee`) plus `startViewTransition` on client
navigation. Home was rebuilt with a dark royal hero (gold drip), count-up stats,
a marquee ticker, category storytelling banners, benefit rails, and staggered
scroll reveals (`src/lib/actions/reveal.svelte.ts`, `countup.svelte.ts`). The
catalog now uses real honey photographs from Unsplash CDN, each verified with
`curl -sI` to return `200 image/*` before being committed (three of the planned
URLs 404'd and were replaced after `websearch` + re-verification).

**Consequences:** A distinctive royal brand that still keeps every Arabic e2e
hook; remote images are verified but remain third-party (a future first-party
CDN migration is tracked in `docs/todo.md`).

## 2026-08-14: Production-readiness hardening

**Context:** A production-readiness audit found gaps: no idempotency on order
creation (concurrent double-submit could duplicate an order), card expiry only
format-validated, in-memory per-process rate limiting (unsafe for multi-instance
and reset on restart), no Docker/CI, and no boot-time env validation.

**Decision:**

- **Order nonce:** `store_order.nonce` (nullable, unique) carries a
  `crypto.randomUUID()` generated in the checkout `load`, passed as a hidden
  form field, and validated as a UUID in `checkoutSchema`. `createOrder` takes a
  required `nonce`; a replay (pre-check or UNIQUE-violation catch) returns the
  existing order and redirects to its success page. One nonce ⇒ at most one
  order. Two deliberately separate tabs still create two orders — accepted as
  correct purchase intent. Rejected: content-derived cart hash (blocks
  legitimate repeat of an identical cart) and a separate idempotency table
  (YAGNI). The local libsql driver has no busy timeout, so a concurrent
  same-nonce submit surfaces `SQLITE_BUSY` rather than a UNIQUE violation;
  `createOrder` retries up to 3 times with linear backoff and falls back to the
  nonce re-query so the loser still resolves to the existing order.
- **Card expiry:** `checkoutSchema` refines `MM/YY` to reject dates before the
  end of the expiry month (valid through `23:59:59.999` of the last day).
- **DB-backed rate limiting:** replaced the in-memory `createRateLimiter` with
  `createDbRateLimiter(db, { windowMs, max })` on a fixed-window
  `store_rate_limit(key, window_start, count)` table with a composite PK; the
  atomic `INSERT … ON CONFLICT DO UPDATE` decision point means SQLite serializes
  concurrent hits so the limit is exact. Keys are namespaced per endpoint
  (`login:${ip}` / `register:${ip}`) because the shared table would otherwise
  merge counters. Fixed-window (up to 2×max burst at a boundary) accepted over
  sliding-window complexity; DB-backed counts now persist across restarts.
  Security review found Better Auth's JSON API (`POST /api/auth/sign-in/email`,
  `/api/auth/sign-up/email`, served by the `svelteKitHandler`) bypassed the
  form-action limiter, so `src/hooks.server.ts` now applies the same limiter to
  those paths before delegating — brute force is throttled on both the forms
  and the JSON API.
- **Env boot validation:** `src/lib/server/env.ts` self-executes on import and
  is imported first in `auth.ts` and `db/index.ts`. In production (`$app/
environment` `dev === false`) it throws if `BETTER_AUTH_SECRET` is missing or
  < 32 chars or `ORIGIN` is unset. Dev stays lenient. Validation (and the
  equivalent guards in `db/index.ts` and `auth.ts`) is skipped while `$app/
environment` `building` is true, because SvelteKit's postbuild analysis
  imports the server bundle with no env vars set — production runtime still
  fails fast.
- **Docker + CI:** multi-stage `Dockerfile` (node:22-alpine, non-root runtime),
  `.dockerignore`, `src/routes/api/health/+server.ts` for the HEALTHCHECK, a
  `start` script, and a GitHub Actions workflow splitting a fast `test` job
  (check, unit, build) from a gated `e2e` job that installs Playwright with
  system deps. CI env sets a ≥32-char test secret + ORIGIN. Deviation from the
  original plan: the runtime stage installs production dependencies (`pnpm
install --prod --frozen-lockfile`) — adapter-node externalizes everything in
  `dependencies`, and the libsql native binding cannot be bundled — so
  `@libsql/client` and `drizzle-orm` moved from devDependencies to
  dependencies. Verified with a standalone `node build/index.js` boot and a
  full `docker build` + container run. Code review follow-ups landed: the
  runtime image copies `drizzle/` and runs `scripts/migrate.mjs`
  (`drizzle-orm/libsql/migrator`, plain ESM, no toolchain) before boot so a
  fresh container never starts with an empty schema; `/api/health` now probes
  the DB (`select 1`) so a broken database fails the HEALTHCHECK instead of
  reporting healthy; and the sign-up JSON-API limiter uses the register
  window (5/hour) rather than the login window so account-creation spam can't
  bypass the form limit.
- **Leftovers:** removed the dead `task` table (migration `0002_*`).
  `store_product.price` / `store_product.stock` columns are dead but **kept** —
  a SQLite column drop risks a table-recreate migration across three FK
  relationships for zero runtime gain; deferred to a maintenance release with a
  reviewed hand-written migration.

**Consequences:** Duplicate orders are prevented at the database boundary;
expired cards are rejected; rate limiting survives restarts and scales to
multi-instance; misconfigured production fails fast; the app ships in a
container with CI verifying check/unit/build/e2e.

## 2026-08-16 — FTS search migration fix and test stability

- **Root cause of broken search:** migration `0003_fts_search.sql` inserted the
  TEXT `store_product.id` into the FTS5 `rowid`, which must be INTEGER →
  `SQLITE_MISMATCH`, so `drizzle-kit migrate` failed and `store_product_fts`
  never existed; every `MATCH` query threw `no such table`.
- **Fix:** FTS5 now auto-assigns its integer `rowid`; `product_id` is a stored
  `UNINDEXED` column. Delete/update triggers use `DELETE FROM store_product_fts
WHERE product_id = old.id`. The backfill insert works (43/43 products).
- **Tests:** `store.spec.ts` `buildDb()` now creates the FTS table + triggers
  so the search test actually exercises FTS. `orders.spec.ts` and
  `store.spec.ts` now reuse a single libsql client per file and close it, which
  eliminates the `SQLITE_BUSY` flakiness (multiple never-closed connections to
  the same test `.db`).
- **Config:** server test project sets `testTimeout: 15_000` — real file-backed
  libsql setup can exceed the 5s default when the client (chromium) project
  runs in parallel.
- **Cleanup:** removed unused `or` import from `store.ts`.

## 2026-08-16 — Server-side pagination and sort for the catalog

**Context:** `/products` loaded up to 1000 products and sorted client-side with
`@tanstack/svelte-table` — fine for 43 rows, not for a real catalog. A real
catalog needs offset + total from the server.

**Decision:** `listProductsPage(db, filters)` returns
`{ products, total, page, pageSize, totalPages }` (page size 12). Price sorting
uses a correlated `MIN(price)` subquery over variants (`minPriceExpr`); sorting
(`newest` / `price-asc` / `price-desc`) is applied in SQL, so paging slices a
sorted set. `listProducts` remains for the home-page rails (limit 100). The
TanStack table, its sorting state, and the dependency were removed; the products
page now navigates via URL params (`q`/`category`/`sort`/`page`) with
prev/next + "صفحة X من Y" controls hidden when there is a single page.

**Consequences:** One source of truth for sorting (the URL) and the server;
pagination scales to thousands of rows; the TanStack dependency is gone. The
e2e happy path searches for "سدر" before clicking the product, since
`sidr-honey-1kg` is no longer on page 1.

## 2026-08-16 — SQLite FTS5 full-text search

**Context:** Search used `LIKE '%q%'` — no index, full scan per query, and it
degrades as the catalog grows.

**Decision:** FTS5 virtual table `store_product_fts(product_id UNINDEXED, name,
description)` with `unicode61` tokenizer, kept in sync by triggers on
`store_product` INSERT/UPDATE/DELETE (migration `0003_fts_search.sql`,
backfilled on apply). Queries build prefix tokens (`"token"*`) and run
`MATCH` via raw SQL (`searchProductIds`), joined back to product rows by id;
`listProducts`, `listProductsPage`, and `getSearchSuggestions` all route
query filters through FTS. Categories still search with `LIKE` (3 rows).

**Consequences:** Prefix/token search is indexed and fast at scale. Arabic has
no stemming under `unicode61`, so search matches whole-token prefixes (e.g.
"سدر" matches "عسل سدر مصري"); substring-within-word queries are not
supported — acceptable for the catalog and documented as a trade-off.

## 2026-08-16 — Bilingual i18n layer (Arabic default, English switchable)

**Context:** All UI strings were Arabic, embedded verbatim in components —
documented as a trade-off; adding a language required a full layer.

**Decision:** Introduced `src/lib/i18n/messages.ts` — flat message catalogs
(`ar` + `en`, `Record<MessageKey, string>` enforcing parity), `t(lang, key,
params)` with `{param}` interpolation and fallback to ar then the key,
`getDir(lang)`, `getLocale(lang)` (`ar-EG`/`en-US`). `lang` comes from a
`lang` cookie (`src/lib/server/lang.ts`), read in `+layout.server.ts`, flows
to pages via `data.lang`, and drives `document.documentElement` `lang`/`dir`
in `+layout.svelte`. A language switcher in the header POSTs to
`/api/lang?lang=X` then reloads. Server messages (zod schema factory
`createCheckoutSchema(lang)`, order errors, login/register, 404s, rate-limit
responses) all localize through the same catalogs. Default language is Arabic
so e2e Arabic selectors and unit specs keep passing. **Scope:** UI chrome is
fully bilingual; DB catalog content (product names/descriptions) remains
Arabic-only — a follow-up would need a per-entity translation model.

**Consequences:** A real i18n foundation exists with zero breaking changes to
the Arabic default; switching languages flips `dir`/`lang` and Intl locale.
Catalog content translation is the documented next step, not part of this ADR.

## 2026-08-17 — Full catalog translation (per-entity bilingual columns)

**Context:** In English mode every DB-backed string (product names,
descriptions, categories, variant names) was still Arabic. UI chrome was
already bilingual via `t(lang, key)`, but catalog data lived only in Arabic
`name`/`description` columns.

**Decision:** Added bilingual columns to the catalog tables —
`store_category.name_en`, `store_product.name_en` + `description_en`,
`store_product_variant.name_en` (all `NOT NULL DEFAULT ''`). FTS was rebuilt
(`store_product_fts` now indexes `name_en`/`description_en`) so English search
works. `store.ts` functions take `lang: Lang = 'ar'` and localize via a
`localized(ar, en, lang)` helper; every server load, the search-suggestions
endpoint, and `resolveCartItems` pass the current `lang` through.
`api/cart` gained a GET handler that resolves cookie cart lines in the current
language, and `cart-store.svelte.ts` refreshes stored names on load so cart
drawer/page names follow the active language. The hardcoded Arabic product 404
was replaced with a `products.notFound` message key. Seed now carries
`nameEn`/`descriptionEn` for all 43 products, 43 variants, and 6 categories.
`formatEGP(amount, lang)` now picks the locale per language (`ar-EG` Arabic
digits vs `en-US` Western digits + `EGP`), so prices and totals render in
Western digits in English mode.

**Consequences:** Arabic and English modes are now fully bilingual end-to-end,
including search and price formatting. The Arabic default is unchanged; English
rows fall back to the Arabic text if ever left empty. Order-history line items
remain immutable historical snapshots (stored in the order's language at
purchase time).

## 2026-08-17 — Automatic language detection from the browser

**Context:** After the full catalog translation, first-time visitors with an
English browser still saw Arabic until they used the switcher. We evaluated
frontend `navigator.language` vs backend `Accept-Language` (per an Arabic
article): frontend detection flashes after hydration, and naive `.includes('ar')`
ignores q-value priority; cookies beat localStorage (no SSR access).

**Decision:** Detect language on the server from the `Accept-Language` header.
`getLang(event)` now resolves: explicit `lang` cookie first, else
`parseAcceptLanguage(event.request.headers.get('accept-language'))`, else `ar`.
`parseAcceptLanguage` is a pure, unit-tested parser that respects q-values,
takes the base tag (`ar-EG` → `ar`), only accepts `ar`/`en`, and falls back to
`ar`. The manual switcher cookie still overrides. `formatEGP`/`Price.svelte`
take `lang` so prices use `ar-EG` Arabic-Indic digits or `en-US` Western digits.

**Consequences:** A first visit now matches the browser's primary language with
zero flash of wrong language; the cookie keeps the user's explicit choice.
Playwright e2e contexts pin `locale: "ar-EG"` so `Accept-Language` selects
Arabic deterministically and the Arabic selectors stay green.

## 2026-08-16 — Checkout rate limiting, order-number retry, and HMAC secret hardening

**Context:** The review flagged three small gaps: the checkout submit action had
no rate limit (spam orders insert rows + decrement stock), order numbers
(`HNY-######`, ~900k space) collided to a generic error, and
`getCartSecret` silently fell back to a fixed `'dev-secret'` on misconfiguration.

**Decision:**

- **Checkout rate limit:** `CHECKOUT_LIMIT = createDbRateLimiter(db,
{ windowMs: 60_000, max: 10 })` keyed `checkout:${ip}`, checked first in the
  submit action (429 with `errors.tooManyAttempts`).
- **Order-number collision retry:** `generateOrderNumber()` moved inside the
  retry loop; a new `isOrderNumberConflict` (message includes
  `store_order.number`) retries with a fresh number up to `MAX_ORDER_ATTEMPTS`
  before failing with a specific message. `isNonceConflict` is now strict
  (message must include `store_order.nonce`), so a plain `SQLITE_CONSTRAINT_UNIQUE`
  no longer masquerades as a nonce replay.
- **HMAC secret:** `getCartSecret(env)` uses `BETTER_AUTH_SECRET` when set;
  in dev only it falls back to a clearly-named dev constant; in production a
  missing secret throws at boot. No silent weak signing.

**Consequences:** Checkout is throttled like auth; order creation is resilient
to number collisions; cart-cookie HMAC can no longer silently degrade.

## 2026-08-16 — Rate limiter resilience: busy retry and global pruning

**Context:** `createDbRateLimiter.allow()` had no busy-timeout retry (a rate
limit hit colliding with a checkout write lock could fail a request) and only
pruned expired buckets per key, so abandoned keys could accumulate.

**Decision:** The insert/upsert now retries on `SQLITE_BUSY` (reusing the
`sqlite.ts` helpers, 3 retries, linear backoff) and throws on non-busy errors
instead of mis-reporting. Global cleanup is opportunistic: `pruneAbandonedKeys`
deletes buckets older than 2h with ~1% probability per `allow()` call, wrapped
in a best-effort catch so pruning never blocks a request.

**Consequences:** Rate limiting is resilient under SQLite contention and
self-cleans abandoned buckets without a scheduled job.

## 2026-08-16 — Cart resilience: cross-tab sync and missing-line reporting

**Context:** Two cart issues: no `storage` event sync between tabs (each tab
kept its own cart copy), and `resolveCartItems` silently dropped cart lines
whose variant was deleted mid-session.

**Decision:**

- **Cross-tab sync:** `cart-store.svelte.ts` binds a `storage` listener on
  first `loadCart()`; when another tab writes `honey_cart_v2`, the current tab
  adopts the new items and re-syncs the cookie.
- **Missing lines:** `resolveCartItems` now returns `{ items, missing }`
  instead of a bare array. Checkout surfaces `missing` as `missingVariantIds`
  in the page data; the checkout page prunes those variants from the client
  cart on mount, so a deleted variant no longer lingers invisibly until order
  time. Callers updated (checkout load, `createOrder` uses `items`).

**Consequences:** Tabs converge on the latest cart; stale variants are removed
from the UI immediately instead of disappearing silently at checkout.

## 2026-08-17 — Blends studio: composed honey blends as one cart line

**Context:** The user wanted a distinct "الخلطات" page where customers compose a
custom honey blend like a game — pick a goal, a base honey and jar size, then
drag-and-drop bee supplements (غذاء ملكات، بروبليس، جينسنج، طلع النخل، حبوب
لقاح) with adjustable doses, ending in a success screen that shows the composed
jar and lets them order it. The existing cart is variant-keyed (`CartLine
{variantId, quantity}`) and prices are stored per variant.

**Decision:**

- **Composition:** A new pure module `src/lib/blends.ts` owns the game config —
  5 goal presets, 5 base honeys with their half/full catalog slugs, 5 additives
  with product slugs, per-additive recommended doses per jar size
  (`DOSE_FOR`, propolis stays 1× for both sizes) and a `MAX_DOSE` of 3.
- **Cart model union:** `CartEntry = CartLine | BlendLine` and
  `CartItem = RegularCartItem | BlendCartItem`. A `BlendLine` carries
  `{ kind: 'blend', id, baseVariantId, jarSize, additives: [{key, variantId,
qty}] }`; the cookie, sanitizer, cart store, and `resolveCartItems` all
  branch on `kind`. The client cart store persists the full item for instant
  rendering; the signed cookie keeps only the identifiers.
- **Prices are always DB-derived:** the page loads base-honey + additive
  variants from the catalog, the client composes and shows a live total, but at
  checkout/order time `resolveCartItems` re-builds the blend item from the DB
  (base price + Σ additive price × qty), so a tampered cookie cannot change what
  is charged.
- **Order expansion:** `orders.ts` expands each blend into order units — one
  base-honey unit (quantity 1) plus one unit per additive — so stock is
  decremented per real variant and `store_order_item` rows reflect the actual
  products. Stock guards use the unit quantity (not an aggregate `requested`
  map) to avoid double-decrementing a variant shared by two blend lines.
- **UI:** the game runs entirely client-side on `/blends` (goal → honey + jar
  size → drag-and-drop mix → success), uses native HTML5 drag events plus
  +/- buttons as a touch fallback, and adds to the cart via the existing
  `addBlend` store path; the drawer/cart/checkout render blend lines with their
  additive composition. No new DB tables or migrations were needed.

**Consequences:** A composed blend is a first-class, one-line cart item that
flows through the existing signed-cookie, checkout, and order pipeline with
server-side price integrity; the game config is pure and unit-tested; and the
catalog variants double as both standalone products and blend ingredients.

## 2026-08-17: Fraunces display serif for the English version

**Context:** The Arabic version renders `.headline` in Amiri (a classical Naskh
serif) and body copy in Cairo Variable. When the site is switched to English,
those same fonts serve Latin glyphs — Amiri's secondary Latin is dated and
Cairo's is geometric/plain, so the English version looked generic next to the
warm, artisanal honey-brand design.

**Decision:** Add `@fontsource-variable/fraunces` (Latin subsets only, loaded
lazily via `unicode-range`) and scope it to English with
`html:lang(en) .headline { font-family: var(--font-display) }` (weight 600,
`letter-spacing: -0.015em`, optical sizing on). `--font-display` falls back to
Amiri then Cairo so any Arabic characters mixed into English strings still
render correctly. Arabic pages are untouched and never download the Latin
subset because `.headline` still resolves to Amiri there.

**Consequences:** English headlines, prices, and hero stats render in a soft
characterful display serif that matches the honey brand; the change is pure CSS
scoped to `:lang(en)` and costs nothing on Arabic pages.

## 2026-08-17: Image-collage cards for blend goals on `/blends`

**Context:** Step 1 of the blend builder presented each goal (vitality,
immunity, children, digestive, energy) as a text-only card — name, description,
and recommended-additive chips. The user asked to replace the text block with an
expressive image per goal that entices clicking the card, rather than reading a
paragraph.

**Decision:** Each goal card becomes an image-led collage. The card is a
`<button>` with an `aspect-[4/3]` photo: the first recommended additive's
product image as a full-bleed cover, a bottom-up dark gradient overlay for text
legibility, the goal name rendered in `.headline` over the gradient, overlapping
circular thumbnails of the remaining recommended additives in the bottom corner,
and a hover-revealed arrow. The description paragraph and chips were removed, so
the card communicates the goal's composition visually. Annotated the `$props`
destructure (`let { data }: { data: PageData } = $props()`) to fix svelte-check
collapsing complex `PageData` property types under the generic `$props<...>()`
form, and typed the jar-size loop via `const JAR_SIZES: readonly JarSize[]`.

**Consequences:** Goal selection reads at a glance and feels clickable; cards
reuse the additives' existing product images (remote URLs) so no new assets are
needed; hover states (`-translate-y-1`, `scale-105`, arrow reveal) give tactile
feedback. Text remains as a fallback label over the gradient, preserving the
goal names in both languages.

## 2026-08-17: Blend cart lines rendered like regular product lines

**Context:** The user reported that the blend builder's checkout flow "isn't
sound" and that a blend's cart line "doesn't look like the other products'"
lines. Inspection found two real problems: (1) the drawer's blend quantity text
used `t(lang, "cart.quantity")`, a key that doesn't exist in `messages.ts`, so
the literal key `cart.quantity 1` rendered in the cart; and (2) a server-side
cookie sanitizer dropped a blend line entirely when its additive list cleaned
to empty, so a honey-only blend (all doses removed) showed in the drawer but
silently vanished from the server cart and checkout.

**Decision:** Render blend lines through the same markup as regular products —
image link, clickable name, muted gray sub-line, price — and fold the blend's
composition into the muted sub-line via a new shared helper
`blendLineDetail(variantName, additives)` (e.g. `كيلو · غذاء ملكات × 2 · جينسنج
× 2`). The honey-colored "Custom blend" badge and additive chips were removed
from the drawer and cart page; quantity is a fixed `× 1` since blends are
always single units. Checkout keeps its compact line but drops the "Custom
blend —" prefix so it matches `checkout.itemLine`. The unused `blends.cartName`
and `blends.quantity` message keys were deleted. On the server,
`sanitizeBlendLine` now keeps a blend whose additives were all malformed/empty
instead of dropping the whole line; the corresponding cookie spec tests were
updated to assert the line is retained.

**Consequences:** Blend cart lines look and behave like regular product lines
in the drawer, cart page, and checkout; the composition remains visible in the
sub-line. A honey-only blend no longer disappears between the drawer and
checkout. The spinner-wheel goal click is exercised in e2e via
`click({ force: true })` because Playwright's stability check can't settle on
the auto-rotating wheel; blend e2e expectations were updated for the new
full-jar default (royal jelly dose starts at × 2, jar label `كيلو`).

## 2026-08-18: DRY refactor — extract shared cart/icon/logic helpers

**Context:** The user asked to remove all repeated code and make the project DRY.
Audit found the cart line-item markup duplicated across CartDrawer/cart page
(and its totals block again in checkout), the honeycomb empty-state SVG in three
places, blended/duplicated logic in the blend wizard, hardcoded zod enums in
cart-store, the auth rate-limit config in three files, near-identical
desktop/mobile nav markup in Header, and six leftover root-level scratch
e2e/config files.

**Decision:**

- **`CartLineItem.svelte`** owns cart line rendering (`size="drawer"|"page"`
  switches layout density); **`CartTotals.svelte`** owns the subtotal/shipping/
  total block; **`HoneycombIcon.svelte`** owns the empty-state hexagon. Wired
  into CartDrawer, cart, checkout and products pages.
- **`messages.ts`** now exports `localized(ar,en,lang)` (moved from
  `server/store.ts`) and a cached `formatDate(lang, ts, options?)`; the two
  `Intl.DateTimeFormat` call sites (orders + checkout success) use it.
- **`blends.ts`** exports `zeroDoses()`, `jarLabel(lang, jarSize)` and
  `JAR_SIZES`; the wizard's private `zeroDoses`/`JAR_SIZES`/`goalName`/
  `honeyName`/jar ternaries were removed and `currentStepLabel` was merged into
  `stepLabel`.
- **`cart.ts`** adds `regularItemPayload(product, variant)`; ProductCard and
  the product detail page build their add-to-cart payload through it.
- **`rate-limit.ts`** exports `AUTH_RATE_LIMITS` (login 10/60s, register 5/1h);
  hooks.server.ts and the login/register actions share it.
- **Header** nav links are a single `NAV_ITEMS` array rendered by both desktop
  and mobile navs; the duplicated globe/user SVGs became `GlobeIcon`/
  `UserIcon`. `cart-store` zod enums derive from `ADDITIVE_KEYS`/`JAR_SIZES`
  instead of hardcoded literals.
- **`store.ts`** shares `minPriceOf`, `categoryNameCondition` and `groupBy`
  (the two identical map-grouping loaders collapsed into one helper).
- Deleted scratch files: `dup.e2e.ts`, `dup-vt.config.ts`, `dup-vt.spec.ts`,
  `repro.e2e.ts`, `store.check.config.ts`, `verify.playwright.config.ts`.

**Consequences:** The cart UI, empty states, nav, icons, blend labels, rate-limit
config and add-to-cart payload each have exactly one source of truth. Behavior
is unchanged — `pnpm run check`, all 93 unit tests and all 9 e2e tests pass.

## 2026-08-19: Migrate from adapter-node + Docker to Cloudflare Pages + D1

**Context:** The project ran on adapter-node with a Dockerfile for containerized
deployment. The user wanted to run the whole project on Cloudflare. The original
premise that "D1 does not support FTS5" was outdated — D1 now supports FTS5
(including fts5vocab). drizzle-kit works with D1 via the `d1-http` driver. D1
batches replace interactive transactions for rate-limiting and order creation.

**Decision:**

- **Adapter swap:** `@sveltejs/adapter-node` → `@sveltejs/adapter-cloudflare`
  (7.2.9); build output `.svelte-kit/cloudflare` compiled to a single
  `_worker.js` on Pages.
- **Lazy driver:** `src/lib/server/db/index.ts` exports a Proxy `db` that
  resolves lazily via `getRequestEvent()` — if `platform.env.DB` exists (D1 on
  Cloudflare), uses `drizzleD1`; otherwise falls back to libsql for local dev
  and tests. `getDb()` exported for explicit calls.
- **auth.ts:** `drizzleAdapter(db, { provider: "sqlite", schema })` — passing
  `schema` explicitly avoids touching the db at construction (better-auth line 90).
- **app.d.ts:** minimal `D1Database` structural interface (avoids global
  `@cloudflare/workers-types` pollution that breaks `Response.json()` types).
- **wrangler.jsonc:** `d1_databases` with binding "DB", `preview_database_id`
  "DB", `nodejs_als` + `nodejs_compat` compatibility flags, `pages_build_output_dir`.
- **Seed:** `scripts/export-d1-seed.ts` reads local.db and emits
  `d1-seed.sql` (INSERT OR IGNORE); applied via `wrangler d1 execute --file`.
- **Playwright:** webServer runs full db:reset → d1:seed → build → d1:migrate →
  d1:seed → preview flow.
- **CI:** deploy job uses `cloudflare/wrangler-action@v3 pages deploy` on push to
  main; e2e uses wrangler pages dev.
- **.dev.vars:** secrets for local Pages dev (`.env` is ignored when
  `.dev.vars` exists). `.dev.vars.example` committed.
- **Removed:** `Dockerfile`, `.dockerignore`, `@sveltejs/adapter-node` dependency.

**Consequences:** The project runs entirely on Cloudflare Pages + D1. Local dev
uses `wrangler pages dev` with D1 local persistence. Tests continue to use libsql
`file:local.db` unchanged (the lazy driver resolves libsql outside Cloudflare).
Migrations apply via `wrangler d1 migrations apply` — drizzle's
`--> statement-breakpoint` comments are handled correctly by wrangler. The Docker
deployment path is removed.

## 2026-08-21: Post-audit security & performance hardening

**Context:** A full audit after the vibe-coding sprint found a critical IDOR
(guest orders viewable by URL UUID), non-atomic checkout (stock decrements +
order insert without a transaction), unbounded Arabic search hitting D1's
~50-byte LIKE-pattern limit, FTS ids feeding >100 bound parameters, no
pagination/indexes on user orders, missing FK indexes, full-row over-fetching,
missing rate limits on `/api/search/suggestions` and `/api/cart`, simulated
payment collecting real card fields (needless PCI scope), and 5 dependency
audit findings.

**Decision:**

- **Guest order access:** HMAC-SHA256 capability token
  (`src/lib/server/order-access.ts`, WebCrypto only) issued into an HttpOnly
  cookie path-scoped to `/checkout/success`; success page grants access iff
  owner session OR valid per-order token, else uniform 404. Dedicated
  `ORDER_ACCESS_SECRET` env var, fail-hard in production (≥32 chars).
- **Column projection:** every read path selects only rendered columns
  (success page, account orders, product lists, suggestions); `nonce`/`userId`
  never serialized.
- **Card fields removed** from checkout schema/UI/i18n — payment is simulated;
  out of PCI scope.
- **Atomic checkout:** `createOrder` runs order + items + guarded decrements
  in ONE `db.batch` (implicit D1 transaction). Sufficiency pre-checked against
  a fresh stock read; because a guarded UPDATE matching 0 rows is not an
  error, per-statement affected-row counts are verified after commit and a
  lost race triggers a compensating batch (delete order/items, restore only
  applied decrements) with its own SQLITE_BUSY retries; compensation failure
  returns `orders.failed`. Nonce/order-number conflict + BUSY retries kept.
- **D1 limits:** search queries byte-capped at 40 (`truncateQueryToByteLimit`),
  FTS ids capped at 64 (`FTS_MATCH_LIMIT` < 100-param hard limit), all list
  limits clamped; variant/image loads parallelized (`Promise.all`).
- **Rate limits:** suggestions 30/min, cart GET+POST 30/min via
  `createDbRateLimiter`.
- **Migration `0006`:** rebuilt `store_order` with `user_id → user.id`
  (ON DELETE SET NULL) FK + `(user_id, created_at)` index; FK indexes on
  `store_order_item.order_id`, `store_product.category_id`,
  `store_product_image.product_id`, `store_product_variant.product_id`;
  deduped variants then UNIQUE(`product_id`,`name`). Dead scaffolding `task`
  table dropped earlier in schema work.
- **Account orders:** paginated (12/page) server-side.
- **Auth/deps:** `minPasswordLength: 8`; better-auth ^1.7.1; pnpm-workspace
  overrides pin `cookie@^0.7.2`, `lodash@^4.17.24`, `esbuild@^0.25.0`
  (`pnpm audit` now clean).

**Consequences:** Production Pages MUST set `ORDER_ACCESS_SECRET` (≥32 chars)
or boot throws, same contract as `BETTER_AUTH_SECRET`. Guest orders placed
before this change 404 (no capability cookie existed). Each guest checkout
overwrites the previous capability cookie. Variant dedup discards duplicate
rows' stock; stale cart cookies referencing deleted variants degrade gracefully
via `resolveCartItems` missing-reporting. Migration applies during a deploy
window (writes between INSERT…SELECT and cutover are lost). pnpm 11 ignores
`package.json#pnpm.overrides` — overrides must live in `pnpm-workspace.yaml`.

## 2026-08-23: Admin dashboard

**Context:** The admin dashboard branch (order management, product/category
CRUD with variants, dashboard stats, R2 media) went through spec → plan →
implementation → final whole-branch review. Five rulings made during that work
are load-bearing and need a durable record beyond the plan document.

**Decision:**

1. **Branch topology:** `feat/admin-dashboard` was cut from
   `feat/customer-account`, not `main`, and merges land in order account →
   admin; the admin work builds directly on the user/role columns and auth
   plugin setup introduced by the account branch.
2. **Auth schema source of truth:** better-auth v1.7.1's generator output
   supersedes the plan document's illustrative SQL — including the hand-fixed
   `account` issuer default `'local:credential'` and the nullable `user.role`
   column. Migrations follow the generated DDL; the plan's SQL is prose only.
3. **Order transitions without transactions:** D1 has no interactive
   transactions, so `transitionOrderStatus` flips the status first with a
   conditional UPDATE guarded on the current status, then performs the
   cancellation restock. Accepted residual risk: a crash between flip and
   restock leaves an under-restoration window; the failure is logged loudly on
   the write path and surfaced to the admin as a retryable 500.
4. **Upload-before-write:** product image upload to R2 happens BEFORE the
   product row write so that a failed DB write cannot fork duplicate products
   when the admin retries the form. Accepted cost: the failed write can leave
   an orphaned R2 blob.
5. **Vanished-order mapping:** a POST targeting an order that no longer exists
   maps to the same 409 invalid-transition failure today; mapping it to 404 is
   the recommended follow-up (tracked in `docs/todo.md`).

**Consequences:** Admin features can be reviewed against these five points
without re-deriving them from git history or the plan doc. Rulings 3–4 trade
strict consistency for D1-compatible simplicity, with the failure modes made
observable rather than silent; ruling 5 leaves one known rough edge explicitly
open instead of silently shipping it.

## 2026-08-24: Product media pivots from R2 to Workers KV

**Context:** R2 requires accepting updated Terms of Service with a payment card
on file even on the free tier, and the owner has none — every R2 API route
returned error 10042 (dashboard-only action), blocking the admin branch's media
story. The free-tier Workers KV namespace `beeking-media`
(`8b48e8ac78804d37bd07d229de466821`) needs no card and was created via API.

**Decision:** Product images persist to the `MEDIA` KV binding instead of R2;
`wrangler.jsonc` swaps `r2_buckets` for `kv_namespaces`. Keys keep the
`products/<uuid>.<ext>` shape (fresh UUID ⇒ immutable objects), but stored urls
are now RELATIVE (`/media/products/<uuid>.<ext>`) — `MEDIA_PUBLIC_BASE_URL` and
its env validation are deleted entirely. A new serving route
`src/routes/media/[...key]/+server.ts` pattern-validates keys against
`^products/[0-9a-f][0-9a-f-]{35}\.(jpg|png|webp)$` so the namespace can never act as an
open read proxy, serves edge-cache-first (`caches.default` match + `waitUntil`
background put), and sets `Cache-Control: public, max-age=31536000, immutable`.

**Consequences:** Zero Cloudflare dashboard prerequisites remain before deploy.
Known trade-offs accepted: (1) KV is eventually consistent (~60s propagation),
so a just-uploaded image can 404 briefly — harmless for admin-authored catalog
imagery that is viewed long after upload; (2) the orphaned-blob cost of
upload-before-write now lands in KV (same accepted risk as 2026-08-23 #4);
(3) KV values cap at 25 MB — well above the enforced 5 MB upload limit. The
shared `KvLikeNamespace` structural type covers both the write half (uploads)
and the arrayBuffer read half (serving route), keeping
`@cloudflare/workers-types` globals out of client code per the app.d.ts
convention.

## 2026-08-23: better-auth 1.7 account.issuer + e2e restart resilience (Task 7)

**Context:** Task 7's e2e suite was the first automated coverage of `/register`;
it exposed that `signUpEmail` 500'd after inserting the user row. better-auth
1.7 scopes account identities by a new required `issuer` field, and its drizzle
adapter throws `BetterAuthError` when the schema lacks it — the committed
auth schema predated 1.7. Separately, full e2e runs died to the preview server
exiting mid-run.

**Decision:**

- **Migration `0008`:** `account.issuer TEXT NOT NULL DEFAULT 'local:credential'`
  - `UNIQUE(issuer, account_id)` per the better-auth 1.7 upgrade guide. The
    default exists because SQLite cannot ADD COLUMN NOT NULL without one; every
    account this app creates is credential-scoped so the value is semantically
    exact. No data backfill needed (`account` had zero rows in every env).
- **e2e resilience:** wrangler ≥4.114 exits on benign client-side request
  aborts during page loads (upstream cloudflare/workers-sdk#14926, unfixed as
  of 4.125; miniflare 5-alpha affected too; downgrading wrangler breaks our
  compatibility_date). Instead of pinning versions, `src/routes/e2e-utils.ts`
  exports a Playwright fixture whose `page.goto` retries through ~15–30s
  restart windows. Store guest-checkout reaches
  checkout via the cart page because the drawer button unmounts its own anchor
  mid-click and can swallow the navigation.
- **pnpm-workspace:** resolved the pending `sharp` build decision to `false`
  (prebuilt binaries are used) — an unresolved decision made pnpm's
  verify-deps-before-run fail any script after dependency changes.

**Consequences:** Registration works again (user + credential account +
session in one call). Future better-auth upgrades must regenerate/verify the
account schema. e2e remains sensitive to machine load (crash cascades under
heavy parallel CPU work) but recovers via retry+fixture instead of failing.

## 2026-08-25: Migration-collision repair + single-deployer architecture (production hotfix)

**Context:** Merging `feat/admin-dashboard` collided two independently
generated `0008_*` migrations (both added `account.issuer` + its unique
index). The merged journal replayed the admin variant as 0008 and main's
original as a renamed 0009, so every environment that had already applied
main's 0008 — including **production D1** — failed with
`duplicate column name: issuer` on deploy, and CI e2e died replaying on a
fresh database. Root cause of the class: two branches generated migrations
independently and no gate detected the collision before merge.

**Decision:**

- **Migrations:** restored `0008_graceful_maggott.sql` (+ snapshot) verbatim
  from the original main commit so remote tracking names match; moved only
  the admin-column deltas (`session.impersonated_by`,
  `user.role/banned/ban_reason/ban_expires`) into new
  `0009_admin_plugin_columns.sql`. Verified by fresh-DB replay and
  `drizzle-kit generate` producing "nothing to migrate".
- **Deployer split:** Cloudflare Pages git integration is the **only** site
  deployer. The GitHub Actions deploy job became a `migrate`-only job
  (`wrangler d1 migrations apply beeking --remote`) gated on `[test, e2e]`
  and `refs/heads/main`, so migrations run _before_ Pages ships new code.
  The Actions build/Pages-deploy steps were deleted (they raced Pages).
- **Migration-replay guard:** the test job now replays the full journal on a
  throwaway SQLite file before building, so a colliding/duplicated migration
  fails CI in seconds instead of surfacing at deploy time.
- **e2e isolation:** the Playwright webServer uses a wiped-every-run
  `--persist-to .wrangler/state/e2e` miniflare directory. Sharing the default
  `.wrangler/state/v3` WAL with a concurrently running dev server crashed
  workerd on the first D1 write ("Network connection lost"); fresh state also
  makes rate-limit budgets start clean (dropped the clear-limits step).
- **Phantom deps declared:** `@threlte/core`, `@threlte/extras`, `three`
  (+ `@types/three`) are imported by the blend-lab scene but were never in
  package.json; a strict reinstall dropped their hoisted symlinks and broke
  svelte-check. Declared with store-resolved versions.

**Consequences:** Production deploys can never apply a migration after code
that needs it within the same push (migrate job runs first; Pages follows).
Two branches generating the same revision still collide — the replay guard
catches it pre-merge instead of post-deploy. Local e2e can now run alongside
`vp dev`. The Actions CLOUDFLARE_API_TOKEN can be narrowed to D1-edit scope
only.

## 2026-08-25: Roadmap reordering — SEO/polish and analytics first, payments last

**Context:** A full completeness audit against a 13-domain e-commerce checklist
found strong engineering foundations (idempotent checkout, guarded stock
decrements, auth, admin, i18n, tests) but zero monetization (checkout writes
`status:"paid"` with no gateway), zero communications (no email/SMS anywhere),
near-zero SEO surface (title tags only; no OG/JSON-LD/sitemap/canonical). The
audit recommended payments first; the owner explicitly overrode: improve and
expose what exists before monetizing.

**Decision:** Strict phase order recorded in `docs/todo.md` Roadmap
(2026-08-25): Phase 1 SEO & polish → Phase 2 PostHog → Phase 3 two-storefront
catalog expansion → Phase 4 transactional email → Phase 5 ops hardening →
Phase 6 payment gateway LAST.

**Consequences:** Orders continue to be created as `status:"paid"` without
collecting money until Phase 6; the store stays non-transactable while traffic,
analytics, and catalog groundwork proceed.

## 2026-08-25: PostHog adopted for product analytics

**Context:** No behavioral analytics exist. Funnel visibility
(view→cart→checkout→purchase) is required before any marketing spend.

**Decision:** Adopt PostHog via posthog-js in SvelteKit with an explicit event
taxonomy (`product_view`, `add_to_cart`, `remove_from_cart`, `begin_checkout`,
`purchase`, `search`); key supplied through Pages env vars; form-input
masking enabled.

**Consequences:** Third-party script on all pages (bundle-size + privacy review
due at implementation); `purchase` events reflect mock payment until Phase 6.

## 2026-08-25: Catalog splits into two storefronts; owner price list is the seed source

**Context:** The business sells retail honey AND beekeeping equipment; the flat
8-category / 43-variant tree cannot express it. Owner supplied the live
203-row pricing list (EGP).

**Decision:** Expand to two departments — honey retail and beekeeping supplies
— under ONE cart/checkout. Raw list preserved verbatim at
`docs/catalog/pricing-list-2026-08-25.md` with flagged data issues: one
negative price (مصنعيه شمع خام −345), two rows missing names, near-duplicate
container names to dedupe, `[1001]`/`[1002]`/`[300]` codes promoted to SKUs,
`XXX` typo prefix, and per-unit "بالكمية" wholesale rows excluded from v1
e-commerce until units are defined.

**Consequences:** Schema migration required (department dimension + sku +
published + optional costPrice/salePrice/weightGrams); bilingual `nameEn` pass
needed for ~200 new lines; admin gains a bulk-import workflow.

## 2026-08-25: Stay on D1 in production; Neon (Postgres) documented as evaluated contingency

**Context:** Owner asked whether free-tier Neon would be better for production.
The codebase leans on SQLite/D1 specifics: FTS5 MATCH search, atomic
`db.batch()` compensation logic (D1 has no interactive transactions), epoch-ms
integer timestamps, and D1-specific limits worked around in code (100-param
cap, ~50-byte LIKE cap).

**Decision:** Remain on D1 (colocated with Workers = lowest latency, zero
migration risk at current scale). Re-evaluate triggers only if: interactive
transactions/reporting SQL become necessary, data outgrows practical D1 size,
or FTS5 proves inadequate for Arabic search even after normalization.

**Consequences:** A Neon move is a sub-project, not a config flip (tsvector
search rewrite, batch→transaction port, timestamp/type migrations, Hyperdrive
pooling latency tradeoff); no effort is spent on it now.

## 2026-08-26: Blends game rebuilt on Phaser 3; Threlte/Three.js removed

**Context:** The `/blends` lab shipped twice as a 3D Threlte scene plus a
separate DOM fallback wizard for no-WebGL devices (`?force2d=1`). Two parallel
experiences doubled maintenance, the 3D path needed a 1.5 MB HDR asset and a
heavy three.js dependency graph, and e2e coverage had to drive raw canvas pixel
coordinates. A rebuild was executed task-by-task on this branch.

**Decision:**

- **One engine for everyone:** Phaser 3.90 with `Phaser.AUTO` — WebGL when
  available, automatic Canvas fallback — replaces both the Threlte scene and
  the fallback wizard. `hasWebGL`, `force2d`, `FallbackBlends.svelte`, the
  Threlte scene tree, and `static/hdr/studio.hdr` are deleted;
  three/@threlte deps removed.
- **Concern split:** Phaser renders the world only (procedural Graphics/canvas
  textures in `src/lib/blend-lab/phaser/textures.ts`; zero canvas text). All
  copy, commerce, and i18n UI stay in Svelte DOM overlays
  (`src/routes/blends/BlendGame.svelte`), keeping RTL Arabic and cart flows
  out of the canvas.
- **Typed bridge over shared mutable state:** Svelte→Phaser via immutable
  snapshots pushed by `$effect` through `BlendsBridge`
  (`phaser/bridge.ts`); Phaser→Svelte via direct typed `BlendsGame` calls +
  inspect events. The bridge is node-safe (type-only imports) so its spec runs
  in the node test project. LabScene applies the current snapshot on create,
  closing the boot race where `createGame()` resolves before the scene's first
  subscription.
- **Accessibility/e2e contract:** every canvas action has an sr-only DOM twin
  in `ActionBar.svelte` (testids `action-*`); e2e drives those instead of
  calibrated pointer coordinates, and `blends-3d.e2e.ts` is deleted.
- **Same commerce spine:** steps, pricing (`blendUnitPrice`), presets, cart
  (`addBlend`), i18n keys, and the orders API are unchanged from the previous
  game.

**Consequences:** One code path to maintain; bundle drops three/threlte and
the HDR asset for phaser (~1.2 MB gzipped total). Art is fully procedural —
hand-drawn sprites are tracked as a todo candidate. E2E was rewritten but not
yet executed locally: this host lacks Playwright's OS libraries
(libicu74/libxml2/libflite1) without passwordless sudo — run
`sudo pnpm exec playwright install-deps && pnpm run test:e2e` before release.

## 2026-08-28: Dedupe catalog to the owner's pricing list

**Context:** After seeding the Phase 3 two-storefront catalog, the owner noticed
the live store showed products that differ from the recently trimmed
`docs/catalog/pricing-list-2026-08-25.md` and asked to re-derive the catalog
from it, remove the duplicates, and "fix everything."

**Root cause:** the seed merged `LEGACY_PRODUCTS` (the old ~43-line catalog)
with `CATALOG_PRODUCTS` (the Phase 3 192-line price-list expansion), keeping any
legacy product whose slug was neither in `CATALOG_PRODUCTS` nor in the
hardcoded `supersededSlugs` set. Twenty-one legacy-only lines leaked through,
and — because the seed only ever `onConflictDoUpdate`'d products and never
deleted stale rows — superseded/superseded-only products lingered orphaned in
the DB even after being dropped from the source. Names in the owner's edited
pricing list also dropped their `[SKU]` bracket prefixes, but one catalog entry
still carried `[300] ` in its display name.

**Decision:**

- Added all **21 legacy-only leak slugs** to the `supersededSlugs` set in
  `scripts/seed.ts` so `keptLegacy` no longer emits them (bee-pollen-125g,
  bee-pollen-box, blackseed-honey-half, citrus-honey-1kg-vib,
  citrus-honey-half-vib, clover-honey-1kg-glass, clover-honey-1kg-plastic,
  clover-honey-1kg-squeeze, clover-honey-1kg-vib, clover-honey-500g-glass,
  clover-honey-half-vib, comb-frame-citrus, comb-frame-clover, ginseng-box,
  honey-spoons-box, marjoram-honey-1kg-glass, nuts-extra-can-500g,
  palm-pollen-box, propolis-box, sidr-honey-500g, six-blend-1kg-plastic).
- **Added stale-product cleanup to the seed**: after stale-category pruning,
  the seed now deletes product rows whose slug is absent from the merged
  `ALL_PRODUCTS` set (FK-safe because order_item/product_variant/product_image
  are truncated at the top of the seed). The seed is now a true reconciliation
  of source → DB, not just an upsert.
- Cleaned `catalog-data.ts` line 1872 display name (stripped `[300] ` prefix;
  kept the `sku: '300'` field). The `honey-clover-1kg-plastic-sku1001` slug is a
  distinct legitimate line and was kept as-is.
- Re-pointed every reference to a removed legacy slug to its surviving catalog
  twin (all verified present in `catalog-data.ts`): `src/lib/blends.ts` base
  honeys (clover/citrus/marjoram/sidr/blackseed half & full) and additives
  (propolis/ginseng/palm-pollen/bee-pollen → `propolis-10g`/`ginseng-10g`/
  `jar-palm-pollen`/`pollen-clover-20g`), and `src/routes/+page.svelte` home
  rails (→ `honey-clover-1kg`, `comb-honey-per-kg-clover`,
  `nuts-honey-500g-can`, `blend-hexagonal-1kg-plastic`, etc.).

**Consequences:** The catalog now reconciles exactly to the owner's pricing
list with **192 products, 0 legacy leaks, 0 duplicate names, 192 unique slugs**
across both `local.db` and the local D1 seed. Backwards-compat: Blend Lab
compositions and homepage rails still resolve to real catalog products via
their twins; the pricing list remains the single source of truth and rows are
still corrected in the seed pipeline, never edited in place.

## 2026-08-28: Remove duplicate local foundation wax line (foundation-local-2kg)

**Context:** The owner flagged that `علبه شمع أساس بلدي عتمان الأصلي تصدير 2ك`
(seed slug `foundation-local-2kg`, listed at EGP 500 in the pricing list) is a
duplicate of the surviving `علبه شمع أساس عتمان الاصلي 2 ك` line and its price
did not match the actual selling price. Unlike the previous dedupe round (whose
leaks were all legacy products filtered by `supersededSlugs`), this line is a
`CATALOG_PRODUCTS` entry, which the seed previously mapped one-for-one with no
exclusion path.

**Decision:**

- Added an `EXCLUDED_CATALOG_SLUGS` set in `scripts/seed.ts` `buildAllProducts()`
  (mirroring the `supersededSlugs` pattern) and dropped `foundation-local-2kg`
  from the `catalogAsSeed` mapping, so the store never lists it. The stale-product
  cleanup then prunes it from the DB. The product record stays in
  `catalog-data.ts` for audit; the source of truth for what is sold lives in the
  seed pipeline.
- Per the owner's explicit request, also removed row 88 from
  `docs/catalog/pricing-list-2026-08-25.md`.
- The surviving `علبه شمع أساس عتمان الاصلي 2 ك` (`foundation-export-2kg`)
  stays in its current section and name, unchanged.

**Consequences:** Catalog is now **191 products, 0 duplicates** across both
`local.db` and the local D1 seed. No code references the removed slug.
`foundation-local` (شمع أساس بلدي) remains defined in the category tree with no
products; the owner confirmed it is left as-is.

## 2026-08-28: Rename `foundation-export` category to "شمع أساس" in the storefront

**Context:** After removing the duplicate `foundation-local-2kg` product (see the
previous entry), the surviving `علبه شمع أساس عتمان الاصلي 2 ك` product lives in
the `foundation-export` category, whose storefront heading read "شمع أساس تصدير"
("Export Foundation"). The owner pointed out the product itself does not say
"تصدير" and asked for the routing/category heading to read "شمع أساس" instead.

**Decision:**

- In `src/lib/server/categories.ts`, renamed the `foundation-export` category
  `name` from "شمع أساس تصدير" to "شمع أساس" and `nameEn` from "Export
  Foundation" to "Foundation Wax". The slug `foundation-export` and its
  `parentSlug: foundation-wax` structure are unchanged.
- The parent `foundation-wax` category is also named "شمع أساس"; the owner
  confirmed this duplicate visible label is acceptable.
- Re-seeded `local.db` and the local D1 state; the seed's
  `onConflictDoUpdate` on `slug` refreshed the stored category name.

**Consequences:** The storefront category page for `foundation-export` now reads
"شمع أساس" (English "Foundation Wax") in both `local.db` and the local D1 seed,
while the parent `foundation-wax` keeps its own "شمع أساس" heading. Catalog
remains 191 products, unchanged.

## 2026-08-31: Blend Lab becomes a light-theme game with juice, unlimited doses, and image-based ingredients

**Context:** The Blend Lab (خلطة) custom-blend game at `/blends` was originally
built dark-themed (`bg-cocoa-950`) while the rest of the storefront uses a light
cream `paper`/`parchment` palette. The owner asked (in Arabic) to (1) restyle the
game to match the site, (2) make it more game-like, (3) remove the per-additive
dose limit so users can add as much of each ingredient as they want, and (4)
present the ingredients as visible image-based game elements. Separately, cart
behaviour for blends was wrong: ordering N jars produced N identical non-editable
rows, and multi-quantity blend totals were not multiplied by quantity.

**Decision:**

- **Light theme:** Rewrote `BlendGame.svelte`, `MixStep.svelte`, and the
  `+page.svelte` shell from dark cocoa to the site's `paper` background,
  `parchment` surfaces, `cocoa` text, and `honey` accents. OrderPanel was
  already light. Purely visual; no logic/test changes.
- **Game juice (feel):** Added `src/lib/blend-lab/ui/sfx.ts` (a small Web Audio
  `SoundFx` singleton — no audio assets — synthesizing a rising-pitch stir
  plink, a C-major completion chime, and a pop thud) and `fx-utils.ts`
  (`sfx` + a cached `prefersReducedMotion()`). Global squash-and-stretch
  (`mix-stir-pulse`) and pop-in (`animate-pop`) keyframes/classes live in
  `layout.css`; the existing global `prefers-reduced-motion` block zeroes them.
  `MixStep` now pulses on every stir, plays a combo/streak readout (×n, decay
  after 1600ms of inactivity) and a perfect-blend state, plus a persisted mute
  toggle (localStorage `honey_blend_muted`). New i18n keys
  `blends.game.stir.combo`/`blends.game.stir.perfect` added in AR and EN.
- **Unlimited additive doses:** `BlendsGame.addDose` no longer clamps to
  `MAX_DOSE`; the `+` stepper is never disabled by a dose cap. Real ingredient
  **stock** (the composite floor in `OrderPanel.maxQty`) remains the inventory
  guard. The now-dead `MAX_DOSE` export was removed from `$lib/blends.ts`.
- **Image-based game elements:** In the additives step, each selected
  ingredient is rendered as an **image token** that pops into a larger jar
  visualization (deterministic pseudo-random position/rotation, staggered pop,
  live ×dose badge re-poping via `{#key}`). Clicking `+` or dropping an
  ingredient onto the jar plays the pop sound; the container is `aria-hidden`
  so tests (text-only) are unaffected.
- **Cart model for blends:** `OrderPanel.orderBlend()` now emits **one** blend
  line carrying `quantity: game.quantity` (previously N lines of qty 1).
  `cart.ts` `lineTotal` multiplies blend totals by `quantity`;
  `addBlendItem` merges by signature **summing** the incoming quantity (capped
  at stock); new `adjustBlendQuantity` + `cart-store.setBlendQuantity(id, q)`
  let a blend line be adjusted freely (capped at stock, removed at 0).
  `CartLineItem` renders the `QuantityPicker` for blend items too, so a user can
  bump a blend to 2, 5, etc. in the cart drawer and totals recalculate.

**Consequences:** The game visually matches the storefront and now feels
game-like without external assets (synthesized audio, reduced-motion safe).
Doses are unlimited while stock stays real. Each jar orders as a single
adjustable cart line and blend totals are correct at any quantity. Verified:
`vp check` 0 errors; 26 server + 7 client blend tests pass; tests assert text
and behaviour only, so the visual changes are safe.

## 2026-09-02: Priority overhaul — Paymob, no COD, hardened CF email, plan-first

**Context:** The owner re-prioritized the 2026-08-25 roadmap in a single Arabic
brief: real payment gateway moved from "LAST by owner decision" to a critical
priority, COD removed everywhere, transactional email made reliable with admin
notifications, plus shipping-by-governorate, inventory, coupons, reviews,
image optimization, Phaser lazy-loading, and multi-admin. The brief asked for a
documented, buildable, decision-gated plan before execution. The full plan
lives at `docs/plan-2026-09-02-priority-overhaul.md`.

**Decision:**

- **Destination this session = produce the plan**, not execute it. Execution
  proceeds phase-by-phase from that document, each with its own spec → plan →
  implementation cycle and quality gate.
- **Paymob is the payment gateway.** Cards + Egyptian wallets (Vodafone Cash,
  Orange Cash, etc.) via Paymob's REST API. HMAC-validated, idempotent webhooks
  keyed on `transaction.id` + `order.id` with a `payments_transaction` ledger;
  a new `payment_status` vs `fulfillment_status` split (currently a single
  `store_order.status` defaulting to `paid`); server-side amount
  computation only; refund support.
- **COD is removed entirely and permanently** from every part of the site —
  UI, i18n, order model, email copy, tests. NO cash-on-delivery option at any
  stage. Until Paymob is live, checkout simulates payment but articulates no
  COD path.
- **Transactional email stays on Cloudflare Email Service** but is hardened
  from fire-and-forget to an **outbox pattern** (durable `emails_outbox` table
  flushed by a Cron Trigger with backoff + dead-letter), plus a new admin
  new-order/payment-confirmation notification loop and Better Auth password
  reset via SMTP.
- **Dev hydration is a blocking repair** and goes first: `vp dev` must serve
  functioning client-side JS so cart/checkout work locally without a
  `build && preview`.
- Operations (governorate shipping using the existing `weight_grams`, archive
  via the existing `published` flag, low-stock + out-of-stock, coupons, reviews
  with admin moderation), performance (Cloudflare Images or resize-on-upload,
  Phaser dynamic-import lazy load on `/blends`, multi-admin from the existing
  `user.role` replacing the single `ADMIN_EMAIL` bootstrap) all follow in phase
  order.

**Consequences:** The previously-decided "payment last" ordering is overturned;
payments are now gated only on owner Paymob onboarding. The two-storefront
expansion and remaining 2026-08-25 roadmap items are re-slotted relative to
these new priority phases in the plan. No code beyond planning was changed this
session.

## 2026-09-02: Admin operations upgrade plan-first

**Context:** The owner filed a bug-by-demo: changing a product image in the
admin panel did not update the storefront. They asked for a complete documented
plan for admin operations covering image preview + drag-drop, search across all
admin sections, full edit/update of every element, complete permissions, and a
confirmation/test gate. The full plan lives at
`docs/plan-2026-09-02-admin-ops.md`; its root-cause diagnosis and phase gating
(destination = produce the plan, not execute) mirror the 2026-09-02 priority
overhaul.

**Decision:**

- **Root cause (locked):** the admin image upload writes only the deprecated
  legacy `store_product.image` column (`admin/products/[id]/+page.server.ts`,
  `product-form.ts`) while the storefront renders `variant.image` and the
  `store_product_image` gallery table — two stores the admin never writes.
  KV `immutable` caching is NOT the cause (fresh UUID keys per upload).
- **Fix direction:** a single shared cover-resolution helper writes the new
  image to variant.image + gallery + legacy cover; admin gains a real gallery
  manager (add/remove/reorder/replace) on the product edit page.
- **Delivery order (Phases A-F):** A image repair + gallery → B upload UX
  (preview + drag-drop via a shared `ImageUpload.svelte`, client validation
  mirroring the server 5MB/jpg/png/webp) → C global admin search (orders,
  categories+dept, audit, users; products gains sku) → D full CRUD including a
  new `/admin/users` page (promote/demote/ban from existing `user.role`) and
  surfacing of `published`/`costPrice`/`weightGrams`/`sku` → E permissions
  (role constant + `isAdmin`, close load-guard gaps, granular roles deferred —
  infra only) → F a confirmation & test gate, including an e2e that edits a
  product image via drag-drop and asserts the storefront card + gallery show the
  new URL.
- **KV image GC:** no hard delete this cycle (immutable cache + permanent
  URLs); replaced/orphaned blobs surface as GC candidates in `/admin/media`.
- **Multi-admin (this plan) folds into the priority-overhaul Phase 4.3.**
  Shipping-address edit and payment semantics stay out of this plan (owned by
  the sales-ops/paymob phases).

**Consequences:** The reported image bug has a confirmed root cause and a
bounded fix. Admin CRUD, search, permissions, and upload UX become
first-class, test-covered surfaces. No code beyond planning was changed this
session.

## 2026-09-02: Governorate shipping + durable email outbox (storefront)

**Context:** The storefront charged a single flat shipping fee and sent
confirmation/status emails by direct best-effort send. The owner-approved
2026-09-02 priority overhaul slotted "Paymob payment + governorate shipping +
email service outbox" as a todo; internal decision 2026-09-02:
**gov shipping + durable outbox NOW (no external secrets), Paymob code-gated
behind `PAYMOB_*` env vars for a later pass** (no webhook/ledger/checkout yet).

**Decision:**

- **Governorate shipping** (`src/lib/shipping.ts`, shared client/server): 7
  zones (cairo/giza/alexandria/delta/canal/upper/remote) at 45/45/55/55/65/85/100
  EGP, free delivery at/above `FREE_SHIPPING_THRESHOLD` = 600 EGP, default zone
  `cairo`. Money kept as integer piasters (×100) throughout.
- Read the zone on the checkout form (`name="governorate"`), revalidate as an
  enum in `checkout-schema`, compute `computeShipping(subtotal, governorate)`
  in `cart.computeTotals`, and persist `store_order.governorate` +
  `store_order.shipping_cost` (migration `drizzle/0015`).
- **Durable email outbox**: the schema-only `store_notification` table doubles
  as a `pending` queue. New `enqueueEmail` + `flushOutbox` in
  `src/lib/server/email.ts` persist `{html,text}` JSON in `body`, mark rows
  `sent`/`failed`, and drain best-effort. Order confirmation, order status
  updates, and admin notifications all go through the outbox.
- **Admin notification**: `ADMIN_NOTIFY_EMAILS` (comma-separated ENV) receives a
  new-order digest (customer + order items + totals + tracking) when present.
- Minor: `USER_ROLES`/role helpers moved to client-safe `src/lib/admin-roles.ts`
  (re-exported by `$lib/server/admin/roles.ts`) to fix a pre-existing
  build-blocking leak guard that refused importing server `roles.ts` into the
  browser on the admin users page.

## 2026-09-09: Order hardening — trigger-owned stock, staged rollout, honest mock payment

**Context:** `createOrder` decremented stock via guarded `UPDATE`s after the
order/items insert in a separate batch; zero affected rows triggered a
post-commit compensation path that could itself crash, and admin cancellation
restocked in a second, separate write. A crash between writes could oversell
or strand stock. Mock checkout also stored `status = 'paid'`, which a future
real gateway would misread as collected money.

**Decision (migration `drizzle/0016_order_hardening.sql` + `stock_version`):**

- `store_order_item` gains `variant_id` (FK) plus `quantity > 0` and
  `unit_price >= 0` CHECKs; `store_order` gains `payment_status`
  (default `simulated`) and `stock_version` (default `legacy`).
- Stock reservation moves into a `BEFORE INSERT` trigger on
  `store_order_item` that aborts the whole batch on shortage
  (`OUT_OF_STOCK`); cancel-restock moves into an `AFTER UPDATE OF status`
  trigger. Both triggers act **only** when the order's `stock_version` is
  `atomic`.
- New orders write `stock_version = 'atomic'` and never touch stock in app
  code. Legacy orders keep `legacy` and are restocked by guarded service SQL
  (`changes() = 1`), so an old app version and a new one can overlap without
  double-adjusting stock. Safe rollout = deploy, drain old instances, then a
  future migration may rewrite `paid` → `placed` and drop the legacy path.
- Legacy `paid` rows are **not** rewritten by the migration (deploy-window
  compatibility); they display as `placed` via `parseOrderStatus`, and the
  admin `placed` filter matches both stored values. Cancellation of a legacy
  order whose items have no resolvable `variant_id` is refused with
  `inventory_reconciliation_required` instead of silently restocking nothing.
- Payment semantics: new orders are `status = 'placed'`,
  `payment_status = 'simulated'`. The dashboard KPI is labeled
  "Gross bookings (simulated payment)". A real gateway can later own
  `payment_status` without touching checkout/orders structure.

**Consequences:** Stock cannot silently go negative; checkout is all-or-
nothing per batch; cancellation is idempotent and race-safe. App code no
longer decrements stock for new orders. Variant deletion now refuses
purchases-referenced variants (typed `referenced` failure) instead of relying
on D1 FK errors. Invoice rendering uses the stored `shipping_cost` snapshot.

## 2026-09-09: Checkout nonce proof cookies

**Context:** The checkout nonce was a server-generated UUID embedded in the
form; possession of the nonce string alone allowed any anonymous caller to
replay a guest order (receiving its access cookie and re-firing the
confirmation email).

**Decision:** `src/lib/server/checkout-nonce.ts` issues a signed, expiring
HttpOnly cookie per nonce (`honey_checkout_<nonce>`, path-scoped, max 8
kept). The submit action verifies the proof before calling `createOrder`,
so a copied nonce is worthless. Replay responses re-mint the order-access
cookie but skip cart clearing, address saving, and the confirmation email.

**Consequences:** Guest checkout becomes session-bound without requiring an
account; duplicate submission remains safe and side-effect-free.

## 2026-09-09: Incremental oRPC adoption (search suggestions first)

**Context:** The task calls for contract-first APIs via oRPC where an explicit
typed boundary has real value, without replacing working SvelteKit server
actions wholesale.

**Decision:** Added `@orpc/server`/`@orpc/contract`/`@orpc/client` and the
first consumed capability: search suggestions
(`src/lib/features/search/` — `contract.ts`, `router.ts`, `context.ts`,
`client.ts`) mounted at `/api/rpc/[...rest]` with a request-scoped context.
The storefront `SearchSuggestions` component consumes the typed client; the
old `/api/search/suggestions` endpoint was deleted after the replacement was
proven.

**Consequences:** One template exists for future contract-first capabilities
(products, cart, checkout, orders); form flows keep using server actions
where they are simpler.

## 2026-09-09: CI as single deploy owner; E2E runs the deployed artifact

**Context:** Cloudflare Pages Git integration races a CI-managed migration,
and an E2E suite that rebuilds independently cannot certify the artifact that
ships.

**Decision:** The workflow is the only production deployer: `test` (check,
unit, migration replay, build, artifact upload) → `e2e` (downloads that exact
artifact) → `migrate-production` (remote D1, `production` environment) →
`deploy-production` (deploys the downloaded build). Concurrency is per-ref;
production jobs run only on pushes to `main` and require environment
reviewers. The E2E setup (`scripts/e2e-setup.mjs`) replays the real
`drizzle-kit migrate` chain (never `push --force`) into an isolated
per-run D1 state directory and never touches developer files
(`.dev.vars`, `local.db`, `d1-seed.sql`). workerd's dev-server crash on
client-disconnect (cloudflare/workers-sdk#14926) is absorbed by a bounded
restart loop and connection-refused-class retry helpers — never by
weakened assertions.

**Consequences:** A production deploy can never precede its migration; the
tested build and the deployed build are byte-identical; flake sources are
fixed at their root (auto-retrying assertions) rather than masked.

## 2026-09-09: Catalog legacy columns — bridge now, drop only after drain

**Context:** `store_product.price/stock/image` are no longer referenced by
runtime code (the earlier cleanup removed the read/write paths), but the app
version that is live in production still reads `product.image` and
`product.price` on storefront queries. CI applies D1 migrations _before_ the
new Pages deploy, so dropping the columns inside the migration chain would
break every storefront request served by the old build during the window
between `migrate-prod` and `deploy-prod`.

**Decision:** Migration `0017_catalog_authority` (in the journal) keeps the
columns and installs a bridge: existing legacy covers are backfilled into
`store_product_image`, and two triggers copy any future old-app cover write
into the gallery. Product-level price/stock values are observably stale —
the app takes price/stock exclusively from variants. The final drop lives
outside the journal at `drizzle/staged/0017_drop_legacy_product_columns.sql`
(drop bridge triggers, then `ALTER TABLE ... DROP COLUMN` ×3) and is applied
manually via `wrangler d1 execute --remote` only after all old instances are
drained. `migration-replay.spec.ts` asserts both facts: the bridge tag is in
the journal and the staged drop is not.

**Consequences:** Old and new builds coexist safely through any deploy
window; the schema drift is bounded and documented; a future
`drizzle-kit generate` must not be blindly committed until after the staged
drop is applied (review generated SQL before merging).

## 2026-09-09: Unshipped feature tables removed from the Drizzle schema

**Context:** `store_return`, `store_review`, and `store_coupon` were declared
in the schema but never had any service, route, or UI — dead weight that
falsely advertised capabilities. The owner chose cleanup over building
unspecified features.

**Decision:** Removed the three table declarations from `schema.ts`. The
physical tables remain in every database (no migration drops them) — any
rows there are preserved, and nothing in the app writes them. When returns,
reviews, or coupons are actually specified, they must be re-added with their
own reviewed migration rather than resurrected silently.

**Consequence:** A future `drizzle-kit generate` may propose dropping these
tables because drizzle no longer tracks them — such statements must be
deleted from generated SQL before applying; the generator never overrides
owner data-retention rules.

## 2026-09-13: Commerce platform program roadmap

**Context:** The storefront is live, bilingual, and holds a real catalog (191
products), but it is pre-production where it matters: checkout simulates payment
(no provider), transactional email silently marks outbox rows `sent` with no
provider binding, order-status/inventory schema carries dual authority and
float-kilogram precision, and ops gaps remain (no enforced CSP, no deploy health
gate, no auth throttling, no restore drill). Six companion design specs drafted
2026-09-13 needed arbitration on migrations, ownership, and ordering.

**Decision:** Complete the platform on the existing SvelteKit 2 + Svelte 5 +
Cloudflare Pages/D1/KV stack; WooCommerce (or any replatform) is rejected. The
program is the master roadmap at
`docs/superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md`, which
freezes the following for all companion specs:

- **Sub-projects:** `2026-09-13-email-delivery-pipeline-design.md` (EM),
  `2026-09-13-order-lifecycle-payments-design.md` (PAY),
  `2026-09-13-data-integrity-hardening-design.md` (DI),
  `2026-09-13-ops-security-hardening-design.md` (OPS),
  `2026-09-13-commerce-parity-design.md` (COM),
  `2026-09-13-i18n-routing-design.md` (I18N) — all under
  `docs/superpowers/specs/`.
- **Migration allocation:** 0018 email delivery (EM, first), 0019 payments
  (PAY, after 0018), 0020 email-verified backfill (OPS, after 0018 and a live
  verification deploy), 0021 order-status default (DI, only if payments are not
  yet applied; otherwise folded into 0019), 0022 inventory integrity (DI D2),
  0023 legacy product-column drop (DI D4, drain-gated); staged
  `drizzle/staged/after_drain_status_backfill.sql` is pre-payments only.
  COM/I18N reserve no numbers.
- **Single-owner arbitration:** EM owns outbox/email Worker; PAY owns
  `runPaymentJobs`, the order-status vocabulary, and `refundOrder`; DI owns the
  single `store_order` rebuild and inventory/constraints; OPS owns CI shape,
  secret preflight, and reset-email rendering; COM owns the commerce features;
  I18N owns routing and page cache. The roadmap outranks companion specs on
  numbering, ownership, sequencing, and phase placement.
- **Phase order:** M0 production correctness (EM + OPS + DI D2) → M1 real
  payments (PAY + the DI D1 fold) → M2 commerce core (COM W0) → M3 commerce
  parity (COM W1/W2) → M4 admin parity → M5 reliability → M6 path-based i18n
  and page cache. Critical path: EM 0018/drain/worker → OPS deploy gates → PAY
  0019/adapter/webhook/refunds → launch verification. One phase in flight.
- **Locked program decisions:** Paymob only, cards + Egyptian wallets, redirect
  Unified Checkout; cash on delivery permanently removed; blends stay
  first-class (server-side expansion, per-component stock deduction); integer
  piasters everywhere; guest checkout with capability cookies stays; private
  routes unprefixed; public pages on a free-tier-cacheable anonymous layout.
  Full owner list (D01–D42) is roadmap §7; defaults unless the owner objects.
- **Business blockers (owner actions, parallel to code):** Paymob onboarding;
  sender domain + SPF/DKIM/DMARC + provider verification; custom-domain
  decision; VAT registration (tax ships `active = 0`); encrypted backup storage.
- **Execution protocol:** spec → plan → TDD → quality gate → commit → ADR/docs.
  Frozen migration numbers; no push to `main` without owner say-so; reversals
  require a new dated entry here.

**Consequences:** The six specs become one ordered program instead of parallel
ambitions. The 2026-09-02 decisions that deferred Paymob and retained the
Cloudflare Email Service pipeline are superseded for direction: Paymob is the
central M1 deliverable, and the delivery pipeline (outbox +
`workers/email-sender/`) must land before payments. Companion specs are amended
only to match roadmap §3. M0's docs truth pass is a defect fix: the Pages Git
integration is already disconnected and `/api/health` already exists, so the ops
work is extension and enforcement, not greenfield.

## 2026-09-13: Cookie namespace rename to `beeking_*` + dead-code cleanup

**Context:** The storefront launched honey-only and named its client state
after the product (`honey_cart` cookie, `honey_cart_v2` localStorage key,
`honey_checkout_*` proof cookies, `honey_order_access`). The catalog now spans
honey, beekeeping equipment, and blend ingredients, so the `honey_` namespace
misleads about scope. A parallel audit of unreferenced code found several
superseded artifacts (the retired cinematic/WebGL direction, a flat-shipping
constant predating zoned pricing, dead helpers, and two orphaned scripts).

**Decision:**

- Rename the runtime names to a brand namespace: `beeking_cart`,
  `beeking_cart_v2`, `beeking_checkout_*`, `beeking_order_access`. The lang
  cookie stays `lang` (no prefix, already generic).
- Keep **read compatibility** for one release so in-flight guest carts and
  emailed order links survive: readers fall back to the legacy name, writers
  set the new name and delete the legacy one (`cart-cookie.ts`,
  `order-access.ts`, `checkout-nonce.ts`, `cart-store.svelte.ts`
  localStorage migration). Compatibility shims are removed after the 30-day
  cookie lifetime elapses (tracked in `docs/todo.md`).
- Delete verified-dead code: `src/lib/actions/countup.svelte.ts`,
  `CinematicStory.svelte`, `SHIPPING_COST`, `blendSignature`, `JAR_LABELS`,
  `LANGS`, `getInvoiceUrl`, `getFeaturedProducts`, `TRANSFER_STATUSES`,
  `STOCK_ALERT_VERSION`, `updateTransferStatus`, `scripts/migrate.mjs`,
  `scripts/topo-seed.mjs`, the stale `EMAIL_API_KEY`/`SMTP_HOST` env warnings,
  and the 2026-09-03 cinematic spec/plan docs it superseded.
- Keep `listAuditLogs` (M4 admin viewer will use it) and
  `store_product.weight_grams` (COM shipping v2 will consume it).

**Consequences:** New code reads `beeking_*` only; the legacy literals exist
solely in the compat paths and their regression tests. Any ad-hoc query or
runbook referencing `honey_cart` is stale after the compat window. Historical
entries above that mention `honey_cart`, `SHIPPING_COST`, or `countup` remain
accurate as history and are not rewritten.

---

## 2026-09-17: V1 settlement pivot — COD + manual transfers, Paymob deferred; blend studio retired

**Context:** The owner restated his real sales workflow: most orders are paid
cash on delivery or by a manual transfer to an InstaPay address or a Vodafone
Cash wallet. Paymob merchant onboarding (KYB, keys, HMAC secret) still gates
any card launch, and cards are not the main channel. Separately, the blend
studio composes blends on the site and expands them into base + additive order
units, while the shop actually mixes ready-made blends and sells them as jars.
Both mismatches block launch more than they add.

**Decision:**

- **V1 settlement is COD plus manual transfers with admin-verified payment**
  (AgDR-0001). Payment methods: `cod`, `instapay`, `wallet`. Payment states:
  `unpaid` → `pending_review` → `paid` → `refunded`, plus `failed`. A customer
  claim or screenshot never sets `paid`; only an authenticated admin action
  does, with a settlement event and an audit row.
- **Paymob is deferred to phase 2** with no date. The 2026-09-13 Paymob spec is
  frozen as raw material and must be rebased on the v1 lifecycle before
  implementation.
- **Fulfillment separates from payment**: `pending_confirmation` → `confirmed`
  → `processing` → `shipped` → `delivered`, plus `cancelled`. Legacy `placed`
  and `paid` read as `confirmed`.
- **Stock is held with a deadline** (recommended 24 hours, env-tunable) and
  released exactly once on cancellation or expiry. Shipped and delivered
  reversals never restock.
- **The blend studio is retired** (AgDR-0002). `/blends` 301-redirects to the
  blends category; blends sell as catalog products with weight variants, jar
  stock, and ingredient descriptions. No recipe accounting and no raw-material
  deduction run at order time.
- **This supersedes** the 2026-09-02 decision "COD is removed entirely and
  permanently" and the 2026-08-17 blends-studio entries. The v1 design and
  migration `0019_settlement.sql` live in
  `docs/superpowers/specs/2026-09-17-manual-settlement-design.md`.

**Consequences:** Roadmap invariants 5 and 6, the M1 milestone, the critical
path, and decisions D08–D14/D24/D41 changed in the same commit. The deferred
Paymob series (P1–P17) moves to the phase-2 backlog. The launch checklist now
waits on the owner's receiving accounts, the WhatsApp number, a COD yes/no, and
the ready-made blend product data. Historical entries above remain history and
are not rewritten.

---

## 2026-09-17: Email outbox rebuild — migration 0018 (EM-1)

**Context:** `store_notification` accumulated rows marked `sent` after a silent
no-op because the Pages project had no email binding; delivery was never
provable. The outbox needs delivery columns, a lease, backoff state, and a
status vocabulary that separates retryable failure from terminal dead.

**Decision:** Rebuild `store_notification` in `drizzle/0018_email_delivery.sql`
with `from_address`, `attempt_count`, `next_attempt_at` (NULL = parked),
`last_error`, `provider_message_id`, `locked_at` lease, `idempotency_key`
(partial unique), a five-value status CHECK
(`pending|sending|sent|failed|dead`), and four indexes. Legacy rows backfill to
terminal `sent` with no provider id: their delivery is unverifiable, and
re-sending them would duplicate messages. The generated migration was
hand-reviewed before commit:

- the generated `store_coupon`/`store_return`/`store_review` drops were removed
  (COM owns their fate; never drop them blindly);
- the data copy maps legacy columns explicitly (`''` sender, `0` attempts,
  `next_attempt_at = created_at`, no lease, terminal `sent`);
- `drizzle/meta/0018_snapshot.json` keeps the three legacy tables so future
  generates do not re-emit the drops.

**Consequences:** Old app instances keep working during the drain (EM §4.2
stage 1); EM-3 adds the claim/lease drain, EM-5 rewires the app enqueues, and
EM-8 deploys the worker. Rows created before this migration can never be
verified as delivered.
