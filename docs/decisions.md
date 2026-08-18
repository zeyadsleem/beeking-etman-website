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
