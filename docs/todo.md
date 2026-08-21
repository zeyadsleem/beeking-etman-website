# Todo

Ordered work items with status. The original storefront shipped under
`docs/superpowers/plans/2026-08-12-honey-store.md`; the مملكة النحل redesign ran
under `docs/superpowers/plans/2026-08-14-mamlakat-alnahl.md` (spec
`docs/superpowers/specs/2026-08-14-mamlakat-alnahl-design.md`).

## Shipped

### Honey storefront (`2026-08-12-honey-store.md`)

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

### مملكة النحل redesign (`2026-08-14-mamlakat-alnahl.md`)

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

### Discovered

- [ ] Investigate dev-mode hydration: `vp dev` serves HTML without client
      entry scripts (no hydration, clicks dead) in this environment; `vp
preview` works. `vp env doctor` passes. Likely a Vite+ dev integration
      issue — confirm root cause before relying on dev-mode smoke tests.
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
- [ ] `store_product.price` / `store_product.stock` column drop deferred: dead
      columns kept for now; removal needs a reviewed hand-written SQLite
      migration (table-recreate risk across three FK relationships).
- [ ] E2E/unit gap noted in review: e2e covers the guest happy path and
      validation errors; unit coverage exists for cart/cookie/orders/currency
      helpers but not for page components (e.g. checkout form behavior).
- [x] Third-party product imagery: all catalog photos now self-hosted under
      `static/images/Beeking Etman/` and served from Pages' unmetered CDN;
      seed + live D1 fully synced (2026-08-21, see cutover record below).
- [ ] `pnpm audit` flags 5 vulnerabilities (lodash ×3, esbuild) in transitive
      dev tooling (drizzle-kit/tsx/vite); pre-existing, dev-only — revisit
      when updating the toolchain. `pnpm audit --prod` is clean.
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
