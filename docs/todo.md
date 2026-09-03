# Todo

Ordered work items with status.

## Roadmap (2026-08-25) — SUPERSEDED ORDERING 2026-09-02

Owner-approved reordering after the full store-completeness audit (2026-08-25):
polish + SEO of what already exists comes first, PostHog analytics lands early,
the catalog expands into TWO storefronts (honey retail + beekeeping supplies,
203-item owner price list captured at
`docs/catalog/pricing-list-2026-08-25.md`), and the real payment gateway moves
to LAST by explicit owner decision. Work phases strictly top to bottom; each
phase keeps its own spec → plan → implementation cycle.

> **2026-09-02:** This ordering is **superseded** for the items below by the
> owner-approved priority overhaul — see `docs/plan-2026-09-02-priority-overhaul.md`
> and the `docs/decisions.md` entry of the same date. Payments move from LAST to
> a critical priority (Phase 1 of the new plan), COD is removed permanently,
> email is hardened, and dev hydration is a blocking Phase 0. The phases below
> remain valid as the components of the new plan's Phase 5 reconciliation; the
> two-storefront expansion and remaining items are re-slotted relative to the
> new priority phases there.

### Phase 1 — SEO & polish of what exists (top priority) — SHIPPED 2026-08-26

1. [x] Meta description (AR/EN): home + store via `meta.*.description` i18n
       keys; product detail derives from the description (`metaDescription()`).
2. [x] Open Graph + Twitter card tags via shared `Seo.svelte`
       (home, store, detail, blends; private routes get `noindex` instead).
3. [x] JSON-LD: Product/Offer + BreadcrumbList on detail pages,
       Organization + WebSite on home. SearchAction deferred until site
       search is a first-class landing page.
4. [x] Dynamic `/sitemap.xml` (static entries + all products, lastmod from
       createdAt) + robots.txt sitemap pointer and private-path disallows.
5. [x] Canonical URLs via `PUBLIC_SITE_URL` (defaults to pages.dev origin).
       hreflang NOT applicable: language is cookie-based, not path-based —
       revisit only if AR/EN get distinct URLs.
6. [x] Arabic FTS normalization: `arabic.ts` (TS + SQL REPLACE mirror),
       migration 0010 rebuilds index with normalized triggers, query path
       normalizes tokens + category LIKE; sync tests prove TS/SQL/migration
       never drift.
7. [x] Media route already emitted `Cache-Control: immutable` (verified;
       audit item was stale). Prerendering deferred — pages are per-cookie
       (lang/user), so prerender needs an anonymous-layout split first.
8. [x] No stray test DBs remained in git (audit item was stale);
       `.gitignore` now blocks `*.db` / `*.sqlite` / `*.db-journal`.

Quality gate: `vp check` 0 errors, `vp test` 438/438, `vp build` clean.

### Phase 2 — PostHog product analytics

1. [ ] posthog-js wired through SvelteKit, key from Pages env; input masking
       on; `lang` recorded as a person property.
2. [ ] Event taxonomy: `product_view`, `add_to_cart`, `remove_from_cart`,
       `begin_checkout`, `purchase` (total + item count), `search`
       (query length + result count). Purchase capture stays mock-aware until
       Phase 6.
3. [ ] Funnel dashboard (view → cart → checkout → success) as the baseline
       before any marketing spend.

### Phase 3 — Catalog expansion: honey store + beekeeping-tools store

Seed source of truth: `docs/catalog/pricing-list-2026-08-25.md`. Cleanup pass
FIRST (issues flagged in that file): fix the negative price, park wholesale
"بالكمية" per-unit rows, resolve near-duplicate jar/container names, promote
`[1001]`/`[1002]`/`[300]` codes to real SKUs, drop the `XXX` typo prefix.

1. [ ] Schema migration: department dimension on category (`honey` |
       `equipment`) or parentId; `product.sku` unique-nullable;
       `product.published` flag; optional `costPrice`/`salePrice`; optional
       `weightGrams` (future zone shipping depends on it).
2. [ ] Category tree: عسل (برسيم/موالح/سدر/حبة البركة/بردقوش/خلطات
       ومكسرات/منتجات الخلية) + أدوات النحالين (خلايا وأجزاؤها/فرازات
       واستخراج/ملابس وقاية/أدوات تشغيل/تعبئة وتغليف/شمع أساس/علاج فاروا).
3. [ ] Seed pipeline importing the ~200 new sellable lines as products +
       variants; bilingual `nameEn` pass (currently empty for seeds).
4. [ ] Storefront split UX: department switcher + landing routes sharing ONE
       cart/checkout; blends studio untouched.
5. [ ] Admin: department filter + bulk-import review screen.

### Phase 4 — Transactional email (support flows unblocked)

Order confirmation + status-change emails (Cloudflare Email Service or
Resend), password reset via Better Auth SMTP (reset is currently impossible),
and a Cron Trigger skeleton reserved for abandoned-cart recovery.

> **2026-09-02:** Absorbed into `docs/plan-2026-09-02-priority-overhaul.md`
> Phase 2 (critical). Decided: **keep Cloudflare Email Service + harden it** —
> durable outbox + retry Cron, admin new-order/payment notifications, Better Auth
> password reset. NOT moving to Resend/SendGrid unless a real deliverability
> failure is proven in production.

### Phase 5 — Operations hardening

Invoice PDF (basic), admin CSV export, Cairo-timezone reporting buckets (the
dashboard's UTC day bucketing splits the business day), admin audit log,
KV media guardrails (cache headers + usage alerts against free-tier caps).

### Phase 6 — Real payment gateway — SUPERSEDED 2026-09-02 (see new Phase 1)

~~Paymob/Fawry evaluation for EGP, COD toggle, separate `paymentStatus` vs
`fulfillmentStatus`, idempotent webhook handling, refund policy. Revisit
stock-decrement semantics (at-order vs at-payment) during spec.~~

Superseded by `docs/plan-2026-09-02-priority-overhaul.md` Phase 1: **Paymob
committed** (cards + Egyptian wallets), **COD removed permanently** (no toggle),
the `paymentStatus`/`fulfillmentStatus` split and idempotent HMAC webhooks and
refunds are specified there, and the stock-decrement at-order-vs-at-payment
decision is reopened there. No separate evaluation needed.

### Superseded

- ~~Roadmap (2026-08-22)~~: items 1 (customer account area) and 2 (admin
  dashboard) shipped; items 3 (email) and 4 (payments) are absorbed above as
  Phases 4 and 6 respectively.

## Post-merge follow-ups (admin dashboard, 2026-08-23)

Agreed at the `feat/admin-dashboard` final review; none block the merge.

### Before production deploy

Nothing remains in this section — merge is the only step left.

- [x] Pre-check duplicate `(issuer, account_id)` pairs before migration 0008
      runs against production data — **passed 2026-08-24**: prod D1 is still at
      migration 0006, `user`/`account` tables are empty (0 rows each), so 0007 + 0008 apply cleanly with zero collision risk. Note: `issuer` itself is
      added by 0008 (`DEFAULT 'local:credential'` backfill); the pre-0008
      collision surface is duplicate `account_id` values, of which there are
      none.
- [x] Media storage enablement — **superseded 2026-08-24 by the R2→KV pivot**
      (see `docs/decisions.md`): R2 ToS acceptance needed a payment card the
      owner does not have, so product media moved to Workers KV instead. The
      free-tier KV namespace `beeking-media`
      (`8b48e8ac78804d37bd07d229de466821`) was created via API and is bound as
      `MEDIA` in `wrangler.jsonc`; no `MEDIA_PUBLIC_BASE_URL` exists anymore —
      images are served by the first-party `/media/[...key]` route.

### One-liner batch

- [ ] `.finite()` + `MAX_SAFE_INTEGER` cap on the `?page` schemas in the admin
      orders/products loaders.
- [ ] Vanished-product image upload returns `fail(404)` instead of a false
      success.
- [ ] Corrupt stored order status logs `console.error` on the write path.
- [x] `not_found` transition results map to 404 (see decisions 2026-08-23 #5).
- [ ] Slug-issue mapping exact-matches both constants.
- [ ] Pasted image URLs restricted to `https:`.
- [ ] `deleteVariant` scoped by `productId`.

### Named follow-ups

- [ ] Native-speaker pass on new Arabic copy.
- [ ] E2E cases: authenticated-non-admin guard + dashboard KPI render.
- [ ] Shared client-side `STATUS_ORDER` constant.
- [ ] `lowStock` query LIMIT.
- [ ] Move the third copy of `retryOnBusy` into `$lib/server/sqlite`.
- [ ] Surface form failure messages inside dialog content (house-wide).

Incident note (2026-08-22): production outage (Error 1101) — security commit
`6749196` added fail-hard `ORDER_ACCESS_SECRET` validation while the Pages
secret held an invalid value; fixed by rotating the secret via API and
redeploying (run 32549189649). Lesson: validate secrets in CI before deploy.

## Shipped

### Honey storefront

- [x] Task 1 — Schema, auth tables, seed, DB scripts (`94bc959`)
- [x] Task 2 — Currency + cart + checkout helpers (`e2b038d`)
- [x] Task 3 — Signed cart cookie + API endpoint (`7d7006a`)
- [x] Task 4 — Store queries + transactional order service (`0634ae6`)
- [x] Task 5 — Design system, components, cart store, RTL shell
- [x] Task 6 — Home page (`d879381`)
- [x] Task 7 — Catalog listing + product detail (`bc0c332`, `000ce92`)
- [x] Task 8 — Cart page (`301d697`)
- [x] Task 9 — Checkout flow, mock payment, success page (`845c211`)
- [x] Task 9 review fixes — double-submit + card-echo hardening,
      cache/ordering, `CheckoutFail` type (`9615469`)
- [x] Task 10 — Auth pages + account orders (`22dd284`)
- [x] Task 11 — E2E tests, docs, quality gate

### مملكة النحل redesign

- [x] Task 1 — Variant schema migration (`2003fe9`)
- [x] Task 2 — Variant-keyed cart core, cookie, store (`421c7c9`)
- [x] Task 3 — Store queries with variants + minPrice (`568bb9c`)
- [x] Task 4 — Variant order service + checkout server (`cfd5828`)
- [x] Task 5 — Product detail variant selector (`0f387c6`)
- [x] Task 6 — Variant-aware product cards (`193486d`)
- [x] Task 7 — Variant display in cart/checkout/success (`9f43f9b`)
- [x] Task 8 — Real catalog: 6 categories, 21 products, 43 variants,
      researched EGP prices, verified real photos (`fdc2f89`)
- [x] Task 9 — مملكة النحل brand + view transitions (`342f388`)
- [x] Task 10 — Royal Kingdom design tokens + animations (`d993192`)
- [x] Task 11 — Hero, marquee, stats, reveals, benefit rails (`5894e5a`)
- [x] Task 12 — E2E variant checkout flow (`ade1bcb`)
- [x] Task 13 — Quality gate + docs
- [x] Catalog flattening: 43 sellable lines → one product each with
      per-container expressive imagery (glass/plastic/squeeze/comb/can/nuts),
      renamed مكسرات بالعسل, rails + hero + e2e updated

### bits-ui adoption + RTL/flash fixes (`2026-08-16`)

- [x] Flash fix: `::view-transition-old(root)` frozen, `new(root)` fades in
      over it (no white background spike); verified via luminance sampling.
- [x] Entrance animations gated to first load: `html.has-nav` kills
      `animate-fade-up/float/spin-slow` replays on client-side navigation.
- [x] RTL search dropdown: `Combobox.Content` gets explicit `dir="rtl"`
      (bits-ui floating layers default to `ltr` and don't auto-detect).
- [x] `CartDrawer` rewritten with bits-ui `Dialog` (bind:open + Portal/
      Overlay/Content/Title/Description/Close), replacing ~60 lines of
      hand-rolled focus-trap/Escape/scroll-lock a11y code.
- [x] `ToggleGroup` variant selector (product detail) + sort/category chips
      (products page); "الكل" uses an explicit `"all"` sentinel so an empty
      selection still highlights the default item.
- [x] `AspectRatio.Root` for product images (ProductCard, product detail, Hero
      desktop main + secondary + mobile main).
- [x] Shared `Breadcrumb` component (uses `Separator.Root` for dividers)
      replacing duplicated breadcrumb markup.
- [x] Shared `Button` wrapper over bits-ui `Button.Root` mapping
      variant→`.btn-primary/outline/ghost`; adopted site-wide.
- [x] Dead CSS removed (`wordmark`, `rule-flourish`); `@utility chip-active`
      moved out of `@layer components` (Tailwind v4 forbids nesting).
- [x] Fixed pre-existing `vp check` warning: `withVariants` is sync, dropped
      the redundant `await` in `getProductWithVariants`.
- [x] Hardened `verify.e2e.ts` cross-page test: waits for the initial `load`
      event before capturing `fullLoads` (was racy under slow preview start).

### Review fixes + scalability (2026-08-16)

- [x] Checkout rate limit: `createDbRateLimiter` (10/60s, keyed `checkout:${ip}`)
      guards the submit action before order creation.
- [x] Order-number collision retry: `generateOrderNumber()` regenerated inside
      the retry loop; `isOrderNumberConflict` retries with a fresh number;
      `isNonceConflict` tightened to require the `store_order.nonce` message.
- [x] Cart HMAC secret hardening: `getCartSecret` throws in production when
      `BETTER_AUTH_SECRET` is unset (no silent `dev-secret`).
- [x] Rate limiter resilience: `SQLITE_BUSY` retry on `allow()` + opportunistic
      global pruning of abandoned buckets (2h window, ~1% per call).
- [x] Cross-tab cart sync via the `storage` event.
- [x] `resolveCartItems` returns `{ items, missing }`; checkout prunes missing
      variants from the client cart so deleted variants don't linger silently.
- [x] Server-side pagination + sort for `/products` (`listProductsPage`,
      `MIN(price)` variant subquery for price sort); TanStack table removed.
- [x] SQLite FTS5 search (migration `0003_fts_search.sql`: virtual table +
      sync triggers + backfill) powering product listing and suggestions.
- [x] Bilingual i18n layer (`src/lib/i18n/messages.ts`, `lang` cookie, language
      switcher in header, `dir`/`lang` on `<html>`, localized server messages).
      Default Arabic; DB catalog content stays Arabic-only (documented follow-up).
- [x] Removed `@tanstack/svelte-table` dependency.

### Blends custom blend studio (2026-08-17)

- [x] `/blends` game page: 4 steps (هدف → عسل+حجم → خلط → نجاح) with step
      indicator, native HTML5 drag-and-drop onto the jar + tap-to-add fallback,
      live price bar, confetti success screen with the chosen honey's jar image.
- [x] 5 goal presets (قوة وحيوية/مناعة/أطفال/معدة وأمعاء/طاقة وتركيز) auto-fill
      recommended additive doses, editable up to `MAX_DOSE` (3).
- [x] Blend sold as ONE cart line (`BlendLine`/`BlendCartItem` union in the cart
      model); server re-derives every price from the DB at resolve/order time.
- [x] `orders.ts` expands a blend into base-honey + additive order units with
      per-variant stock decrement.
- [x] Cart drawer, cart page, and checkout render blends with their additive
      composition; Header/Footer gained a "الخلطات" nav link.
- [x] i18n: ~40 `blends.*` keys in ar + en.
- [x] Unit + e2e coverage: cart/cookie/store/orders blend tests; `blends.e2e.ts`
      composes a blend end-to-end (goal → honey → mix → success → cart).

### Customer account area

- [x] Task 1 — `store_address` table + migration 0007, no-FK per spec (`93e21f2`)
- [x] Task 2 — Address service: 10-address cap, single default with atomic
      batch promotion, ownership-scoped queries (`c84ced1`)
- [x] Task 3 — Profile hub: name change, password change, sign-out (`219b6b3`)
- [x] Task 4 — Saved-address CRUD page (`4f0cd93`)
- [x] Task 5 — Order detail page, ownership-gated (404 on cross-user) (`d12333e`)
- [x] Task 6 — Checkout saved-address picker + optional save-after-order (`69cac95`)
- [x] Task 7 — E2E journey incl. IDOR negative; clean-run webServer chain (`e97fe7b`)

### Blends game engine migration

- [x] Threlte/Three.js 3D lab replaced by a single Phaser 3 game for every
      device (`Phaser.AUTO`: WebGL with automatic Canvas fallback) — no more
      `?force2d` wizard fork.
- [x] Procedural art only (Graphics + canvas textures); Threlte scene,
      fallback wizard, WebGL probe, and `static/hdr/studio.hdr` deleted;
      three/@threlte deps removed.
- [x] Typed Svelte↔Phaser bridge: snapshots pushed Svelte→Phaser via `$effect`,
      Phaser→Svelte via direct `BlendsGame` calls + inspect events; initial
      snapshot applied on scene create (boot race fixed).
- [x] Accessible DOM action bar (`ActionBar.svelte`) mirrors every canvas
      action for keyboard + e2e; `blends.e2e.ts` rewritten against it,
      `blends-3d.e2e.ts` deleted.
- [ ] Art pack candidate: procedural Graphics read fine but hand-drawn
      sprite sheets (jars, cups, spoon) would lift visual quality — needs an
      artist pass before swapping `textures.ts`.

### Discovered

- [ ] SEO: `/blends` is SSR spinner-only (the Phaser game boots client-side),
      so crawlers see just the loading shell — acceptable
      tradeoff for now; revisit with static fallback content if /blends
      becomes a search entry point.
- [ ] Multi-jar cart epic: the order panel adds N identical quantity-1 blend
      lines because `addBlend`'s schema keys a line by its composition;
      merging into one line with quantity N needs a store/schema change
      (`cart-store.svelte.ts` + `sanitizeCartLines`) — deliberate scope cut.
- [ ] Owner-editable benefit texts: goal/benefit copy lives in
      `src/lib/blend-lab/benefits.ts`; move to DB/CMS if non-devs must edit it
      without a deploy.
- [ ] Investigate dev-mode hydration: `vp dev` serves HTML without client
      entry scripts (no hydration, clicks dead) in this environment; `vp
preview` works. `vp env doctor` passes. **Investigation (2026-08-27)**:
      Config chain is `vite.config.ts` → `lazyPlugins(() => [tailwindcss(),
sveltekit({ adapter: adapter(), ... })])`. No `svelte.config.js` exists;
      Vite+ handles SvelteKit config inline. `package.json` "preview" runs
      `wrangler pages dev .svelte-kit/cloudflare` (bypasses Vite entirely),
      while `vp dev` starts Vite's dev server with the SvelteKit plugin.
      Likely root cause: Cloudflare adapter (`@sveltejs/adapter-cloudflare`)
      may inject page scripts differently in Vite dev mode vs production
      build; or `lazyPlugins` defers plugin init past Vite's HMR setup window.
      Confirm root cause before relying on dev-mode smoke tests.
- [x] Production rate-limit persistence: rate limiting is now DB-backed —
      fixed-window buckets in `store_rate_limit` via `createDbRateLimiter`;
      counts survive restarts and scale to multi-instance.
- [x] Idempotency nonce for order creation: checkout issues a per-load
      `crypto.randomUUID()` nonce (hidden form field, UUID-validated);
      `createOrder` pre-checks the nonce and re-checks on a UNIQUE violation,
      so a replayed submit returns the existing order instead of duplicating.
- [x] Card expiry past-date check: `checkoutSchema` refines `MM/YY` to reject
      dates before the end of the expiry month.
- [x] Cloudflare Pages + D1: adapter-cloudflare, lazy D1/libsql driver,
      wrangler.jsonc, d1 migrations/seed, CI deploy via wrangler-action,
      `.dev.vars` for local Pages dev (2026-08-19).
- [x] Env boot validation: `src/lib/server/env.ts` fails fast in production on
      missing/short `BETTER_AUTH_SECRET` or missing `ORIGIN`.
- [x] Auth JSON-API rate limiting: `src/hooks.server.ts` limits
      `/api/auth/sign-in/email` (10/60s) and `/api/auth/sign-up/email`
      (5/hour), matching the form-action limits.
- [ ] `store_product.price` / `store_product.stock` / `store_product.image`
      column drop deferred: columns marked `@deprecated` in schema.ts; kept for
      migration safety. **Write paths still active**: `admin/product-form.ts`
      L167 writes `image` when admin uploads/pastes a product cover (reads the
      existing value as fallback at L152). **Read paths**: `store.ts`
      `productListColumns.image` (L111), search-suggestion `price`/`image`
      (L415–416), admin list `price` (L107). Removal needs a reviewed
      hand-written SQLite migration that first rewires all writes to
      `store_product_variant.image` / variant price, then drops the columns
      (table-recreate risk across three FK relationships).
- [ ] E2E/unit gap noted in review: e2e covers the guest happy path and
      validation errors; unit coverage exists for cart/cookie/orders/currency
      helpers but not for page components (e.g. checkout form behavior).
- [x] Third-party product imagery: all catalog photos now self-hosted under
      `static/images/Beeking Etman/` and served from Pages' unmetered CDN;
      seed + live D1 fully synced (2026-08-21, see cutover record below).
- [ ] `pnpm audit` flags 5 vulnerabilities (lodash ×3, esbuild) in transitive
      dev tooling (drizzle-kit/tsx/vite); pre-existing, dev-only — revisit
      when updating the toolchain. `pnpm audit --prod` is clean.
  - [x] Resolved (2026-08-21): better-auth ^1.7.1 killed the lodash chain;
        pnpm-workspace overrides pin cookie/lodash/esbuild; `pnpm audit` clean.
- [x] SQLITE_BUSY hardening: `createDbRateLimiter.allow()` now retries on
      `SQLITE_BUSY` via the shared `src/lib/server/sqlite.ts` helpers.
- [x] `store_rate_limit` rows for abandoned keys are now opportunistically
      pruned globally (2h window, ~1% per `allow()` call, best-effort).
- [x] Catalog content i18n: bilingual `name_en`/`description_en` columns on
      category/product/variant, rebuilt FTS for English search, `lang`-aware
      store queries, and cart-name refresh — English mode is now fully
      translated (2026-08-17).
- [x] Container data persistence resolved: D1 is a managed Cloudflare
      database; no volume mounts needed. Local dev uses `.wrangler/state`
      persistence.

## Done: post-audit hardening (2026-08-21)

Full security/performance pass closing every finding from the post-vibe-coding
audit (security review: 0 blockers; code review majors fixed):

- [x] IDOR on guest order success page closed (HMAC capability cookie +
      owner-session gate, uniform 404s, minimal column projection).
- [x] Checkout card fields removed (PCI scope dropped); dead i18n keys deleted.
- [x] `ORDER_ACCESS_SECRET` env validation (fail-hard in prod); examples +
      `.dev.vars` updated — set it in Cloudflare Pages settings before deploy.
- [x] Atomic checkout via single `db.batch` + post-commit affected-row
      verification with compensating batch on lost stock races (+ BUSY retries).
- [x] Search hardened: 40-byte query cap, FTS ids ≤ 64, clamped limits,
      parallel variant/image loads, list-path projection (no description TEXT).
- [x] Rate limits: `/api/search/suggestions` and `/api/cart` GET+POST.
- [x] Migration 0006: order FK + `(user_id, created_at)` index, four FK
      indexes, UNIQUE(product_id, name) after dedup; dead `task` table gone.
- [x] Account orders paginated server-side (12/page).
- [x] `minPasswordLength: 8`; better-auth ^1.7.1; audit-clean deps.

## Admin operations upgrade (2026-09-02) — PLAN APPROVED-PENDING

Owner asked for a complete documented plan for admin operations after a
product-image change failed to reflect on the storefront: image preview +
drag-drop, search across all admin sections, full edit/update of every element,
complete permissions, and confirmation + tests that everything works. Full plan:
`docs/plan-2026-09-02-admin-ops.md` (Parts 1-4, Phases A-F, decision points
D1-D4). ADR: `docs/decisions.md` 2026-09-02 entry. Ticket breakout lives in the
plan's Part 4; open items are moved here when the owner approves the phases.

Root cause (locked): admin image upload writes only the deprecated
`store_product.image` column while the storefront renders `variant.image` +
`store_product_image` gallery — see plan §1.1.

Phase order: A image repair+gallery → B upload UX → C global search →
D full CRUD (+`/admin/users`) → E permissions → F confirmation & tests.

## Done: free-tier image cutover (2026-08-21)

Executed after user approval, in the planned order:

1. Commit `6e32f59` (`feat(store): self-host catalog imagery & document
free-tier cost posture`) pushed to `main`; CI run 32490427853 green
   (test + e2e + deploy).
2. New image URLs confirmed 200 on production Pages.
3. Live D1 re-seeded via the D1 HTTP import API (`init` → R2 upload →
   `ingest`, MD5-verified): 246 statements, 760 rows written.
4. Verified: 0 external URLs across `store_product`,
   `store_product_variant`, `store_product_image`; counts match seed
   (43 products / 43 variants / 8 categories); live product page HTML
   references only first-party paths and returns 200.

The site now runs entirely on Cloudflare Free with no third-party image
dependencies; monitoring guidance is in `docs/architecture.md`.
