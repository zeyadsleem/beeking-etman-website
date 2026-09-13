# Path-Based i18n Routing & Public Page Cacheability — Design Spec

**Date:** 2026-09-13
**Status:** Proposed (implementation plan input)
**Scope:** `/ar/...` + `/en/...` URLs for public storefront routes, real `hreflang`/canonical/sitemap SEO, an anonymous public layout, and a safe edge/D1-read cache for catalog pages. **Docs only — no code, config, or migration changes are made by this document.**
**Owner context:** Cloudflare Pages Free (100K Function requests/day; static asset requests are unmetered), D1 Free (5M rows read/day), no custom domain yet (`PUBLIC_SITE_URL` falls back to `beeking-etman-website.pages.dev`, `src/lib/site.ts:8`). The owner's stated goal is cacheable/prerenderable public catalog pages with path-based locales as the enabler.
**Repo docs:** English.

---

## 1. Context & current state

### 1.1 Language is cookie-only today

| Concern            | Where                                                                 | Behavior                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolution         | `src/lib/server/lang.ts:28-32`                                        | `getLang(event)` reads the `lang` cookie first, then `Accept-Language` (`parseAcceptLanguage`, lines 7-26, Arabic wins whenever supported).                                                                                                     |
| Preference write   | `src/lib/server/lang.ts:34-40`; `src/routes/api/lang/+server.ts:5-10` | `setLangCookie` writes `lang` with `path: "/"`, `httpOnly`, `sameSite: lax`, 1-year max age. `POST /api/lang?lang=ar                                                                                                                            | en`is the only writer; unknown values fall back to`ar` (`api/lang/+server.ts:7-8`). |
| Layout data        | `src/routes/+layout.server.ts:6-13`                                   | Runs on **every** request: `getLang(event)`, `getCategories(db, lang)` (one D1 read), `event.locals.user`, returns `{ categories, user, lang }`.                                                                                                |
| Shell render       | `src/routes/+layout.svelte:21-31`                                     | Client `$effect` sets `document.documentElement.lang/dir` from `data.lang`; `<html lang="ar" dir="rtl">` is hard-coded in `src/app.html:2` until hydration. `Header` (`+layout.svelte:112`), `Footer` (116), `CartDrawer` (118) receive `lang`. |
| Switcher           | `src/lib/components/Header.svelte:61-80`, `123-132`, `251-258`        | Desktop button and mobile menu item `POST /api/lang` then `invalidateAll()` inside a view transition. No URL change.                                                                                                                            |
| Auth-path messages | `src/hooks.server.ts:24-45`                                           | `getSession` on every request; `getLang(event)` localizes the rate-limit 429 body (line 35).                                                                                                                                                    |
| Message catalogs   | `src/lib/i18n/messages.ts:1-21,1500-1508`                             | `Lang`, `LANGS`, `LANG_COOKIE_NAME`, `isLang`, `getDir`, `getLocale`, `localized`, `t`.                                                                                                                                                         |

Catalog content is already bilingual in D1 (`name`/`name_en`, `description`/`description_en`; normalized via `localized(...)` and `getCategories(db, lang)` / `listProductsPage(..., lang)`).

### 1.2 URL surface today (all unprefixed)

- Public: `/` (`src/routes/+page.server.ts`), `/products` (`products/+page.server.ts`), `/products/[slug]` (301 shim to the canonical path, `products/[slug]/+page.server.ts:12`), `/[department]` = `/honey`,`/equipment` (`[department]/+page.server.ts`), `/[department]/[category]` (`[department]/[category]/+page.server.ts`), `/[department]/[category]/[slug]` (`.../[slug]/+page.server.ts`), `/blends`, `/about`, and the two legacy shims `/store/honey` → `/honey`, `/store/equipment` → `/equipment` (`store/honey/+page.server.ts:4-8`, `store/equipment/+page.server.ts:4-8`).
- Private: `/cart`, `/checkout`, `/checkout/success/[id]`, `/login`, `/register`, `/account/*`, `/admin/*`, `/api/*`, `/media/[...key]`, `/sitemap.xml`, static `/robots.txt`.
- Canonical product path builder is duplicated: `src/lib/server/store.ts:40-45` (`productPath`) and the client-safe `src/lib/storefront.ts:12-22` (`productPath`/`departmentPath`/`categoryPath`). Both return unprefixed paths; every nav/card/breadcrumb/search-suggestion link uses them (`ProductCard.svelte:14`, `SearchSuggestions.svelte:76`, `Header.svelte:13-19,97,240`, `Footer.svelte:27-47`, `Hero.svelte:31-39`, `CartDrawer.svelte:49`).

### 1.3 SEO today

- `Seo.svelte` emits title/description, **one** canonical (`Seo.svelte:27,39`), OG/Twitter tags, and JSON-LD blobs; there is no `hreflang`, no `og:locale`, no per-locale alternate.
- `src/lib/seo.ts` has `websiteJsonLd` with `inLanguage` (line 37), `breadcrumbJsonLd` and `productJsonLd` but all URLs go through `canonicalUrl()` on unprefixed paths.
- `/sitemap.xml` (`src/routes/sitemap.xml/+server.ts`) emits one URL per static path (`STATIC_PATHS`, line 7), category (lines 41-44) and product (45-48); no locale dimension, no alternates; response is `public, max-age=3600` (line 66). It also omits `/products` today.
- `static/robots.txt` disallows unprefixed private paths and points at the sitemap; `Seo` marks query-bearing `/products` and private pages `noindex` (`products/+page.svelte:62`, private pages).
- `docs/todo.md:35-37` records the standing decision: _"hreflang NOT applicable: language is cookie-based, not path-based — revisit only if AR/EN get distinct URLs."_ This spec is that revisit. `docs/todo.md:43-44` records that prerendering was deferred because pages are per-cookie (lang/user) and _"prerender needs an anonymous-layout split first."_

### 1.4 What blocks prerender/caching today

1. **Every public request reads cookies** through `getLayout.server.ts:7` (`getLang` → `event.cookies.get`) and `locals.user` (line 11) → responses cannot be identical for anonymous and signed-in visitors, and SvelteKit refuses to prerender routes whose loads read cookies (page options: prerender requires identical output for all users).
2. **Header is personalized server-side** (`Header.svelte:134-163`) from `data.user`, so HTML differs per session; cart count is already client-side (`Header.svelte:36-38`).
3. **Cache headers are private**: `products/+page.server.ts:21` (`private, max-age=60`), `[department]/+page.server.ts:9` (`private, max-age=60`), `[department]/[category]/[slug]/+page.server.ts:19` (`private, max-age=120`), `blends/+page.server.ts:47` (`private, max-age=120`); checkout/success are `private, no-store` (`checkout/+page.server.ts:28`, `checkout/success/[id]/+page.server.ts:13`).
4. **Root layout does an unnecessary D1 read**: `getCategories(db, lang)` (`+layout.server.ts:8`) is consumed by nobody — home builds a static category array (`+page.svelte:16-24`) and `/products` returns its own `categories` from its page load (`products/+page.server.ts:66-68`), which shadows layout data.
5. **`/about` is the only public page with no D1 load**, yet is server-rendered on every visit.
6. **`<html lang>` is only correct after hydration** for English pages (`src/app.html:2` vs `+layout.svelte:22`). SvelteKit 2.70.2 does **not** support a `%sveltekit.lang%` app.html placeholder (verified: the template parser expects only `%sveltekit.head%`, `%sveltekit.body%`, `%sveltekit.assets%`, `%sveltekit.nonce%`), so this needs an explicit fix (see §3.2).

### 1.5 Private-route cookie scopes that constrain the design

- Order-access capability cookie is path-scoped to `/checkout/success` (`src/lib/server/order-access.ts:56`).
- Checkout nonce proof cookies are path-scoped to `/checkout` (`src/lib/server/checkout-nonce.ts:14,19`).
- Cart cookie is `path: "/"` and host-scoped (`src/lib/server/cart-cookie.ts:86`); the lang cookie is the same (`src/lib/server/lang.ts:36`).
- Order-confirmation/status emails hard-link `${origin}/checkout/success/${row.id}` (`src/lib/server/email.ts:225,546`).

**Consequence:** prefixing checkout would break both path-scoped cookies and every email link, and would force coordination with the email-pipeline spec. This is the main reason private routes stay unprefixed (§3.1).

---

## 2. Goals / Non-goals

### Goals

1. Every public page has exactly one indexable URL per locale (`/ar/...`, `/en/...`), self-canonical, with `hreflang` alternates (`ar`, `en`, `x-default`) in both the HTML head and the sitemap.
2. All existing public URLs keep working: deterministic **301** to the prefixed equivalent; no user-visible 404s, no dead links in emails or bookmarks.
3. Public HTML is anonymous and identical for every visitor, so it can be cached and (for the static subset) prerendered. `lang` comes from the URL, never from a cookie, on public routes.
4. Reduce D1 rows read on public pages via an edge cache with bounded staleness and explicit invalidation on admin catalog writes.
5. Reduce Function invocations where it is free to do so: prerender static public pages; document the custom-domain Cache Rule as the step that removes invocations for cached D1 pages.
6. Keep private flows byte-for-byte unchanged: checkout, cart, account, admin, auth, cookie scopes, email links, rate limits.
7. Keep the URL-language state usable for private pages (cookie preference written by the switcher), so `/checkout` follows the user's chosen language.

### Non-goals

- Translating catalog content (already bilingual via `name_en`/`description_en`).
- Arabic (non-Latin) URL slugs — see §8.2.
- Prefixing private/API routes — see §8.4.
- Changing `formatEGP`/RTL behavior (already locale-aware).
- Paymob/payment work, email pipeline changes, or domain acquisition itself (the domain is an external prerequisite, §3.4).
- Enabling Cloudflare Workers Cache — it still meters cache hits as Worker requests and would start metering currently-free static assets, so it cannot reduce the Free daily request cap (see §3.4).
- A full headless CMS, routing framework (Paraglide), or runtime translation service — the existing `messages.ts` catalogs stay.

---

## 3. Proposed design

### 3.1 Route structure

#### Recommended tree (Option A — required `[lang=lang]` param + legacy 301 map)

```
src/params/lang.ts                          # matcher: "ar" | "en"
src/routes/
├── +layout.server.ts                       # branch: public (params.lang) vs private (cookie)
├── +layout.svelte                          # unchanged shell (Header/Footer/CartDrawer)
├── [lang=lang]/
│   ├── +layout.server.ts                   # { lang: params.lang, user: null }  (no cookies)
│   ├── +page.server.ts / +page.svelte      # home (moved)
│   ├── products/+page.*, products/[slug]/+page.server.ts   # moved
│   ├── [department]/…, [department]/[category]/…, [department]/[category]/[slug]/…  # moved
│   ├── blends/+page.server.ts / +page.svelte               # moved
│   └── about/+page.ts (+page.svelte)       # moved; prerender = true + entries()
├── cart/ checkout/ account/ admin/ login/ register/
├── api/ media/ sitemap.xml/
└── store/honey|equipment                  # delete; covered by the legacy redirect map
```

`/products` (static) outranks `/[department]` (dynamic) in SvelteKit's sort order, so `/ar/products` keeps resolving to the catalog and `/ar/honey` to the department page; the `lang` matcher prevents `/honey` from ever matching `[lang=lang]` (SvelteKit matchers run on server and client; optional/required dynamic sorting rules are documented in the advanced-routing section fetched for this spec).

#### Options evaluated

| Option              | Shape                                                                                                            | Pros                                                                                                                                              | Cons                                                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A (recommended)** | Required `[lang=lang]` on public routes; unprefixed public URLs 301 in `hooks.server.ts` from an allowlisted map | One URL per locale; no ambiguity; `params.lang` is always a valid `Lang`; prerender and cache logic can assume a locale; private routes untouched | One big file move; a redirect hook runs on every legacy hit (transient); new public roots must be added to the redirect map                                                                                                                                                                                     |
| B (rejected)        | Optional `[[lang=lang]]` wrapping the same public tree, no redirects needed to keep old URLs alive               | Smaller behavioral diff on day 1; old URLs still render                                                                                           | Two URLs serve the same content until redirects land (duplicate content; canonical + redirects still required for SEO); `params.lang` is `string \| undefined` everywhere, weakening the invariant; optional-param ranking adds subtle conflicts with `[department]`; forward-compatible matcher still required |
| C (rejected)        | Duplicated `ar/` + `en/` route trees (or `(ar)`/`(en)` route groups)                                             | No matcher; explicit                                                                                                                              | Route groups cannot add URL segments, so real duplication is required: ~15 route files × loads duplicated, two places to fix every bug; tests double; no shared load logic without extracting it anyway                                                                                                         |

**Decision: Option A.** The redirect map lives in one client-safe module (`src/lib/i18n/routes.ts`, new):

```ts
export const DEFAULT_LANG: Lang = "ar";
/** First path segments that must never be locale-redirected. */
export const RESERVED_ROOTS = new Set([
  "ar",
  "en",
  "api",
  "media",
  "admin",
  "account",
  "cart",
  "checkout",
  "login",
  "register",
  "sitemap.xml",
  "robots.txt",
  "_app",
  "fonts",
  "images",
]);
/** Public roots that get a locale prefix (order matters; exact entries first). */
const LEGACY_EXACT: Record<string, string> = {
  "/store/honey": "/honey",
  "/store/equipment": "/equipment",
};
const PUBLIC_ROOTS = ["/", "/products", "/honey", "/equipment", "/blends", "/about"] as const;

export function legacyRedirectTarget(pathname: string, search = ""): string | null;
export function localizedPath(lang: Lang, path: string): string; // "/products" -> "/ar/products"
export function stripLocale(pathname: string): string; // "/ar/products" -> "/products"
export function switchLocalePath(pathname: string, target: Lang): string | null; // null on private routes
```

`legacyRedirectTarget` rules (unit-testable pure function):

1. Only `GET`/`HEAD` (the hook checks the method; non-idempotent methods are never redirected).
2. If the first segment is `ar`/`en` or in `RESERVED_ROOTS` → `null` (SvelteKit/route resolves normally).
3. Exact legacy entries (`/store/honey`, `/store/equipment`) map to their department equivalents under `DEFAULT_LANG`.
4. Otherwise match `PUBLIC_ROOTS` by exact equality or `root + "/"` prefix; unknown roots → `null` so junk paths keep returning 404 instead of redirecting to a prefixed 404. This deliberately trades catch-all convenience for 404 hygiene and a smaller cache surface.

#### Slugs

**Decision: keep the existing shared Latin slugs for both locales** (`honey-sidr-1kg`, `clover`, `sidr` — all current values are ASCII-safe, see `catalog-data.ts`). Arabic slugs were rejected: they would need a second slug column (or transliteration), collision handling, 301s for every URL that exists today, percent-encoding edge cases in SvelteKit paths, and they buy no proven ranking advantage for this audience. If Arabic slugs are ever wanted, that is its own ADR + migration.

#### Private routes stay unprefixed (recommended)

`/cart`, `/checkout`, `/checkout/success/[id]`, `/login`, `/register`, `/account/*`, `/admin/*`, `/api/*`, `/media/*` keep today's URLs. They resolve language exactly as today (cookie → `Accept-Language` → `ar`) and are `noindex`/disallowed where applicable. This preserves `order-access.ts:56` (`/checkout/success` scope), `checkout-nonce.ts:14,19` (`/checkout` scope), cart cookie host scope, email links (`email.ts:225,546`), and every admin/account test. Private pages are never cached.

### 3.2 Language resolution

**Precedence: URL param (public) > cookie (private) > `Accept-Language` > `ar`.**

- `src/lib/server/lang.ts` keeps `parseAcceptLanguage` (7-26) and gains:
  - `resolveLang(routeLang: string | null | undefined, cookie: string | null, acceptLanguage: string | null): Lang` — pure, unit-testable; `isLang(routeLang)` short-circuits.
  - `getLang(event)` becomes a thin wrapper: `resolveLang((event.params as { lang?: string }).lang, event.cookies.get(LANG_COOKIE_NAME), event.request.headers.get("accept-language"))`. Existing call sites (29 server loads; see §3.6) keep working, but only public routes now receive a param.
  - `getLangFromPathname(pathname: string): Lang | null` for the hook/transform (does not depend on `event.params` being typed).
- New `src/routes/[lang=lang]/+layout.server.ts`:
  ```ts
  import { error } from "@sveltejs/kit";
  import { isLang } from "$lib/i18n/messages";
  import type { LayoutServerLoad } from "./$types";

  export const load: LayoutServerLoad = ({ params }) => {
    if (!isLang(params.lang)) error(404, "Not found"); // matcher already enforces this
    return { lang: params.lang, user: null };
  };
  ```
  It reads **no cookies** — this is the anonymous split, and it is what makes prerendering and caching possible.
- `src/routes/+layout.server.ts` branches so public routes never touch a cookie or a session:
  ```ts
  const paramLang = (event.params as { lang?: string }).lang;
  if (paramLang === "ar" || paramLang === "en") return { user: null }; // lang comes from the nested layout
  return { lang: getLang(event), user: event.locals.user ?? null };
  ```
  The root layout's `getCategories` call is deleted (§1.4 item 4); no consumer reads it.
- `setLangCookie` and `POST /api/lang` are unchanged and remain the preference writer for private pages and as the switcher's persistence call.
- `document.documentElement.lang/dir`: `src/app.html:2` cannot be parameterized per route in SvelteKit 2.70.2, so `hooks.server.ts` uses `resolve(event, { transformPageChunk })` to replace the exact opening tag:
  ```ts
  const lang = getLangFromPathname(event.url.pathname) ?? getLang(event);
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('<html lang="ar" dir="rtl">', `<html lang="${lang}" dir="${getDir(lang)}">`),
  });
  ```
  `handle` also runs during prerendering, so `/ar/about` and `/en/about` ship the correct tag. The client `$effect` (`+layout.svelte:21-31`) stays as a no-op safety net for client-side navigations.

**Redirect policy (decided):**

- Unprefixed public URL → **301** to `/${DEFAULT_LANG}${pathname}${search}` via `hooks.server.ts` (before `handleBetterAuth` so no session work happens for a redirect). Deterministic: the target never depends on cookie/header, so a browser-cached 301 is always correct and Googlebot (which sends no cookies) sees the same mapping as users.
- `Accept-Language` negotiation is **not** applied to the redirect. Rationale: a cookie/header-dependent 301 is cached by the browser and can pin a user to the wrong locale after they switch; a 307/302 would avoid caching but permanently demotes the mapping in SEO terms and adds a Function invocation on every visit.
- Private routes keep negotiation through `getLang` (cookie + header) exactly as today.
- During the first deploy window the redirect code can ship as 302 for one release and flip to 301 in the next commit if the owner wants extra rollback safety (browser-cached 301s can outlive a revert). **Recommendation: ship 301 directly** — the mapping is final and the rollback path keeps the prefixed routes available in the previous artifact only if routing is reverted; if the owner prefers the soak, it is a one-constant change, tracked as task 3 in §9.

### 3.3 SEO

**`Seo.svelte` (new props: `lang`, keep logical `path`):**

- canonical = `canonicalUrl(localizedPath(lang, path))` (e.g. `path="/products"` + `lang="en"` → `.../en/products`; `path="/"` → `.../ar`).
- Emit self-referencing alternates for both locales plus `x-default` → the `ar` URL:
  ```html
  <link rel="alternate" hreflang="ar" href="https://…/ar/products" />
  <link rel="alternate" hreflang="en" href="https://…/en/products" />
  <link rel="alternate" hreflang="x-default" href="https://…/ar/products" />
  ```
- `og:locale` (`ar_EG`/`en_US` via `getLocale(lang).replace("-", "_")`) and `og:locale:alternate`.
- `noindex` behavior is unchanged (`products` search pages stay `noindex`, private pages stay `noindex`).
- Call sites update to pass `lang` (all already have it): `+page.svelte:31`, `products/+page.svelte:59-65`, `[department]/+page.svelte:33-36`, `[department]/[category]/+page.svelte:46-50`, `[department]/[category]/[slug]/+page.svelte:78-82`, `blends/+page.svelte:11-15`, `about/+page.svelte:87-91`.

**`src/lib/seo.ts`:**

- `websiteJsonLd(lang)` already has `inLanguage`; set `url` to `canonicalUrl('/' + lang)` and keep `@id` `${siteOrigin()}/#website` (one entity across locales). Add a `webPageJsonLd(lang, path, name)` helper (`WebPage` + `inLanguage` + localized `url`) emitted on product/category/department pages so structured data carries the locale explicitly.
- Breadcrumb `item.path` values passed to `breadcrumbJsonLd` must be localized before building (`localizedPath(lang, …)`), because `breadcrumbJsonLd` calls `canonicalUrl()` (lines 47-58); product `offers.url` likewise (`productJsonLd` line 78).
- `organizationJsonLd` stays locale-independent (single legal entity); if desired, the `name` can switch per locale — keep one `@id`.

**Sitemap (`src/routes/sitemap.xml/+server.ts`):** emit both locales for every URL with `xmlns:xhtml="http://www.w3.org/1999/xhtml"` and `<xhtml:link rel="alternate" hreflang="…" href="…"/>` for `ar`, `en`, `x-default`. Add `/products` to `STATIC_PATHS` (line 7). Keep `lastmod` for products and `Cache-Control: public, max-age=3600` (line 66); consider adding `s-maxage=3600` when the domain work lands. Number of `<url>` entries ≈ 2 × (6 static + ~8 categories + N products).

**robots.txt:** unchanged. It already disallows the unprefixed private paths; the public legacy paths are redirected, and the sitemap lists only canonical prefixed URLs. `PUBLIC_SITE_URL` remains the single origin source (`src/lib/site.ts:19-26`); when a custom domain is purchased, set it there so hreflang/sitemap/canonical all move together.

### 3.4 Caching & prerender

**Platform facts this design relies on (verified 2026-09-13):**

1. Cloudflare Pages static-asset requests are unmetered; Function requests cap at 100K/day (`docs/architecture.md:244-263`).
2. The Cache API (`caches.default.match/put/delete`) **works on Pages Functions with or without a custom domain**, including `*.pages.dev`. It is data-center-local (no replication, no request collapsing) and does not itself stop the Function from running — it removes D1 work, not the invocation count.
3. **Workers Cache** is zoneless and would return cached responses without running the Worker, but it explicitly bills every cache hit as a Worker request and warns that enabling it starts metering normally-free static-asset requests; on Free that consumes the same 100K/day cap, and `cache: { enabled: true }` is a Worker config key not supported by Pages' Wrangler configuration. **Rejected.**
4. **Cache Rules** are zone-level. The project owns no zone today, so rules cannot be attached to `*.pages.dev`; they become available when a custom domain is added to the account. The domain is already recorded as a hard dependency for deliverable email (`docs/superpowers/specs/2026-09-13-email-delivery-pipeline-design.md` §3.6); it is the same external prerequisite here. Purge-by-URL on Free is available (800 URLs/s, ≤100 ops/request) once a zone exists.
5. SvelteKit hooks do not run for prerendered pages (they are static assets), so a prerendered page also exits the Function/redirect path entirely.

**Recommended strategy (hybrid):**

| Layer                  | Applies to                                                                                     | Mechanism                                                                                                                                   | Effect                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Prerender              | `/about` (both locales); `robots.txt` already static                                           | `export const prerender = true` + `entries() => [{lang:'ar'},{lang:'en'}]` in `[lang]/about/+page.ts`                                       | 0 Function invocations, 0 D1 reads for that page                |
| Edge page cache        | All `/[lang]/...` HTML pages (home, products, departments, categories, product detail, blends) | `caches.default` wrapper in `hooks.server.ts` (new `src/lib/server/page-cache.ts`) with timestamp TTL                                       | On hit: 0 D1 reads; invocation still counted                    |
| HTTP headers           | Same pages                                                                                     | Replace `private, max-age=…` with `public, max-age=60, s-maxage=300, stale-while-revalidate=600`                                            | Correct browser + intermediary semantics; ready for Cache Rules |
| Cache Rules (deferred) | Same pages, once a custom domain exists                                                        | Zone rule: cache eligible, edge TTL 5–15 min, bypass when session cookie present, bypass `/api`, `/admin`, `/account`, `/checkout`, `/cart` | On hit: 0 Function invocations                                  |

**Do not prerender D1 pages at build time.** CI builds without a seeded local database or remote D1 credentials tied to the build (`ci.yml:38-50` runs `drizzle-kit migrate` against a throwaway SQLite for schema replay only), and admin catalog edits are runtime D1 writes that would not be reflected until the next deploy. The "ISR-like" behavior is instead: runtime SSR + edge cache + explicit invalidation. Pages has no ISR primitive; Workers Cache is the only platform-level ISR analogue and is rejected above.

**Page cache design (`src/lib/server/page-cache.ts`):**

- Structural `caches.default` access exactly like `src/routes/media/[...key]/+server.ts:22-29` (keeps unit tests runnable where `globalThis.caches` is absent and avoids leaking Workers globals).
- Eligibility (all must hold): `GET`/`HEAD`; pathname is `/ar`/`/en` or starts with `/ar/`/`/en/`; response status 200; response `Content-Type` starts with `text/html`; response has **no** `Set-Cookie`; request has **no** Better Auth session cookie (`better-auth.session_token` / `__Secure-better-auth.session_token`); request URL has **no query string** in v1 (bounds cache cardinality from `?q=`, `?page=`, `?sort=` and prevents cache-fill abuse). Query-bearing catalog URLs stay uncached and simply read D1 as today.
- Key: `new Request(event.url, { method: "GET" })` (locale is in the path, so no extra partitioning is needed).
- TTL: store `X-Page-Cache-At: <epoch-ms>` when writing; on read, `Date.now() - at > 300_000` is a miss (overwrite). The Cache API does not expire by `Cache-Control`, so the timestamp is the TTL enforcement.
- Debug header `X-Page-Cache: HIT|MISS|BYPASS` on public HTML responses (safe, no PII) for tests and observability.
- Hook composition: `export const handle = sequence(handleI18nRedirect, handlePageCache, handleBetterAuth)` — a cache hit returns before session verification, which is safe because session-bearing requests are bypassed.
- Streaming note: cache the response body via `await response.clone().arrayBuffer()` and re-serve with the stored status/headers; SvelteKit pages here do not depend on streaming for first paint.

**Invalidation on admin catalog writes:**

- After a successful product create/update/delete or category mutation (`src/lib/server/admin/products.ts`, `product-form.ts`, `categories.ts` — the services listed in `docs/architecture.md`), call `purgePageCache(urls, ctx)` with the affected set:
  - both locales of the product path (`productPath(product, lang)`),
  - both locales of its department and category pages,
  - both locale home pages (featured products),
  - optionally both `/products` listing pages.
    ≈ 10–14 URLs, well inside Cache API limits. Use `ctx.waitUntil` (available on `event.platform.ctx`, `src/app.d.ts:73`) so admin latency is unaffected; failures are logged, never surfaced (TTL remains the backstop).
- `caches.default.delete()` removes the entry in the colo handling the admin request; other colos keep the entry until the 5-minute timestamp TTL elapses. Accepted trade-off: bounded 5-minute staleness after an edit in the worst colo vs. a purge API that requires a zone. When the custom domain lands, replace/augment with purge-by-URL for global invalidation.

**Expected impact (estimate — baseline must be measured first, §6):**

- Query inventory today (approximate SQL statements per public page view, all D1):
  - home: root-layout categories 1 + `listProducts` ×2 (rows + variants + images + category slugs each) ≈ 7–9;
  - department/category listing: layout 1 + `getCategories` 1 + `departmentCounts` 1 + total 1 + rows 1 + variants/images/slugs 3 ≈ 7–9 (`store.ts:428-458` shows the four post-row queries);
  - product detail: product/variants/images 2–3 + related 1–2 + category 1 + layout 1 ≈ 5–8.
- Removing the unused root-layout `getCategories` saves exactly 1 statement on **every** request immediately.
- With a 5-minute TTL and typical revisit/crawler mix, a 70–85% page-cache hit rate on public HTML reduces D1 statements on those routes by the same proportion (worked example: 10,000 public page views/day × ~8 statements = ~80,000 statements/day → ~12,000–24,000 with caching, before row-count weighting).
- Function invocations are **not** reduced by the Cache API (the wrapper runs). Prerendering removes `/about` entirely; the invocation win for catalog pages arrives only with Cache Rules on a custom domain (then a hit is served at the edge without invoking the Function). Track both separately in §6; do not promise invocation reduction earlier.

### 3.5 Language switcher UX

- **Public routes:** the switcher becomes an `<a href={switchLocalePath(page.url.pathname, target)} hreflang={target}>` — crawlable and works without JS. On click it also persists the preference by `fetch("/api/lang?lang=" + target, { method: "POST", keepalive: true })` (fire-and-forget; a `Set-Cookie` on a POST doesn't affect cacheability of the next GET). SvelteKit's router handles the navigation; no `invalidateAll` is needed because the URL changes. Path mapping preserves the logical path and query: `/ar/honey/sidr/x?sort=…` → `/en/honey/sidr/x?sort=…`; on private routes `switchLocalePath` returns `null`.
- **Private routes (`/checkout`, `/account`, …):** keep today's behavior (`Header.svelte:61-80`: POST then `invalidateAll()`), since the URL does not change there.
- **Preference propagation to private pages (open decision §8.6):** a visitor who lands directly on `/en/...` from search has no cookie, so `/checkout` would render Arabic. The recommended v1 is to leave this to the switcher plus `Accept-Language` (Arabic-default audience); if data shows pain, add a one-shot client sync in the public layout (`sessionStorage`-guarded `POST /api/lang?lang=<current URL locale>`) — it adds one request per new visitor and does not touch server-cached HTML.

### 3.6 Impact inventory

**Resolution & routing (new/changed):**

| File                                           | Change                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/params/lang.ts`                           | New matcher `match: (v) => v === "ar" \|\| v === "en"`.                                                                                                                                                                       |
| `src/lib/i18n/routes.ts`                       | New client-safe path helpers + legacy redirect map (§3.1).                                                                                                                                                                    |
| `src/lib/server/lang.ts`                       | Add `resolveLang`, `getLangFromPathname`; `getLang` reads `params.lang` first. Existing specs `src/lib/server/lang.spec.ts:10-60` extended.                                                                                   |
| `src/routes/+layout.server.ts`                 | Public/private branch; delete the unused `getCategories` read.                                                                                                                                                                |
| `src/routes/[lang=lang]/+layout.server.ts`     | New: `{ lang, user: null }`, no cookie access.                                                                                                                                                                                |
| `src/hooks.server.ts`                          | Add `handleI18nRedirect` (301 map), `handlePageCache`, and the `transformPageChunk` `<html lang dir>` fix; compose with `sequence` around `handleBetterAuth`.                                                                 |
| `src/routes/api/lang/+server.ts`               | Unchanged (POST-only preference writer).                                                                                                                                                                                      |
| All 15 public route files under `[lang=lang]/` | Moved; keep their loads, swap `getLang` usage where necessary; `productPath` redirects gain the locale (`products/[slug]/+page.server.ts:12`; `[department]/[category]/[slug]/+page.server.ts:37-41` compares logical paths). |
| `src/routes/store/honey`, `store/equipment`    | Delete after the redirect map covers them (or keep and update targets; map preferred).                                                                                                                                        |
| `src/routes/sitemap.xml/+server.ts`            | Locale × URLs + `xhtml:link` alternates; add `/products`.                                                                                                                                                                     |

**Client components / URL builders:**

| File                                                                                                                                                                                                        | Change                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/storefront.ts`                                                                                                                                                                                     | `productPath`/`departmentPath`/`categoryPath` take `lang` and return localized paths. Consolidate the duplicate builder from `src/lib/server/store.ts:40-45` here (server-safe module) to avoid drift.                  |
| `src/lib/components/ProductCard.svelte:14`                                                                                                                                                                  | `productPath(product, lang)` (prop already exists).                                                                                                                                                                     |
| `src/lib/components/SearchSuggestions.svelte:76`                                                                                                                                                            | Localized suggestion values (prop already exists); `Header`'s `search()` goto also prefixes (`Header.svelte:40-42`).                                                                                                    |
| `src/lib/components/Header.svelte:13-19,91,97,123-132,138-163,211,240-258`                                                                                                                                  | `NAV_ITEMS` prefixed at render time; active-state compares `stripLocale(pathname)`; logo/mobile links prefixed for public, account/admin/login links stay unprefixed; switcher as link on public routes.                |
| `src/lib/components/Footer.svelte:14-47`                                                                                                                                                                    | Public links prefixed; `/cart` stays.                                                                                                                                                                                   |
| `src/lib/components/Hero.svelte:31-39`, `CartDrawer.svelte:49`, `CinematicStory.svelte:166,201`, `+error.svelte:64`, `+page.svelte:40,50,62,69`, `[department]/*`, `[category]/*`, `about/+page.svelte:216` | Prefix public hrefs.                                                                                                                                                                                                    |
| `src/routes/account/orders/+page.svelte:27`, `checkout/success/[id]/+page.svelte:60`                                                                                                                        | "Browse store" links: prefix with `data.lang` (private pages keep their lang from the cookie).                                                                                                                          |
| `Header.svelte` (session)                                                                                                                                                                                   | Public pages: `user={null}` (anonymous split); add a client-side Better Auth Svelte client session fetch so account/admin links appear after hydration for signed-in visitors. No server session read on public routes. |

**SEO/tests/config/docs:**

| Area         | Files                                                                                                                                                                                                                                                                               | Note                                                                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEO          | `src/lib/components/Seo.svelte`, `src/lib/seo.ts`                                                                                                                                                                                                                                   | §3.3.                                                                                                                                                                                                                                                |
| Tests (e2e)  | `src/routes/store.e2e.ts`, `verify.e2e.ts`, `account.e2e.ts`, `blends.e2e.ts`, `tests/storefront-ux.e2e.ts`, `tests/checkout.e2e.ts`, `tests/departments.e2e.ts`, `tests/product-detail.e2e.ts`, `tests/blends.e2e.ts`, `tests/admin-operations.e2e.ts`, `tests/admin-guard.e2e.ts` | Public `page.goto`/link assertions get locale prefixes via a helper; one dedicated legacy-redirect spec keeps testing unprefixed inputs. `tests/storefront-ux.e2e.ts:3-6` currently POSTs `/api/lang` and visits `/`; change to prefixed navigation. |
| Tests (unit) | `src/lib/server/lang.spec.ts`, new `src/lib/i18n/routes.spec.ts`, `src/lib/server/page-cache.spec.ts`, `src/lib/components/Seo`-adjacent snapshot test                                                                                                                              | §5.                                                                                                                                                                                                                                                  |
| Config       | `vite.config.ts`, `wrangler.jsonc`, `.github/workflows/ci.yml`                                                                                                                                                                                                                      | No changes required: matcher auto-registers; prerender is an export, not config; adapter default `routes.exclude: ["<all>"]` already excludes prerendered pages.                                                                                     |
| Emails       | `src/lib/server/email.ts:225,546`                                                                                                                                                                                                                                                   | Unchanged (private unprefixed URLs). Coordinate only if the email spec changes success URLs; the order-access cookie scope at `order-access.ts:56` must remain `/checkout/success`.                                                                  |
| Docs         | `docs/decisions.md`, `docs/architecture.md`, `docs/todo.md:35-37,43-44`                                                                                                                                                                                                             | ADR + doc updates are implementation tasks (§9), not part of this spec.                                                                                                                                                                              |

---

## 4. Migration & rollout

No database migrations, no schema changes, no data backfill. All changes are code + route moves; rollback is a redeploy.

**Ship in two PRs (recommended over one):**

- **PR 1 — URLs & SEO (behavioral risk, fully test-covered).** Matcher + `routes.ts` + `lang.ts` + route move + public/private layout branch + redirect hook + `<html lang>` transform + `Seo`/JSON-LD/sitemap + switcher + component link localization + e2e migration in the same PR. Exit: all existing e2e green (updated), new redirect/hreflang/sitemap specs green, no URL 404 regression.
- **PR 2 — Cache & anonymous split completion (perf risk, guarded).** Client session enhancement in `Header`, page-cache wrapper + headers + `X-Page-Cache`, admin purge hooks, cache unit specs, `/about` prerender. Exit: D1/Function metrics recorded, cache headers verified, admin edit reflected within TTL.

Rejected: a single PR (too large to review/revert; mixes URL correctness with cache correctness); per-route phased prefixing (mixed canonical states, sitemap churn, two migration stories). PR 1 is independently deployable and PR 2 can slip without leaving the site inconsistent.

**Step order inside PR 1:**

1. Land `src/params/lang.ts` + `src/lib/i18n/routes.ts` + unit specs (no behavior change).
2. Move public route directories under `src/routes/[lang=lang]/`; add the public layout; branch the root layout; add the redirect hook and `<html>` transform in the **same commit** so no URL is ever broken. Delete `store/*` shims (covered by the map).
3. Update path builders/components/sitemap/SEO; migrate e2e route strings.
4. Deploy through CI (`ci.yml:38-50`: check → unit → migration replay → build → Playwright against the built artifact → migrate-production (no-op here) → Pages deploy).

**Legacy URL map (301 → `DEFAULT_LANG`):**

| Legacy input                                                         | Target                                                                                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                                                  | `/ar`                                                                                                                                |
| `/products`, `/products/*`                                           | `/ar/products`, `/ar/products/*` (then the existing `[slug]` shim may 301 again to the canonical product path — accepted double hop) |
| `/honey`, `/honey/*`                                                 | `/ar/honey`, `/ar/honey/*`                                                                                                           |
| `/equipment`, `/equipment/*`                                         | `/ar/equipment`, `/ar/equipment/*`                                                                                                   |
| `/blends`                                                            | `/ar/blends`                                                                                                                         |
| `/about`                                                             | `/ar/about`                                                                                                                          |
| `/store/honey`                                                       | `/ar/honey`                                                                                                                          |
| `/store/equipment`                                                   | `/ar/equipment`                                                                                                                      |
| unknown first segment / reserved roots (`/api/...`, `/admin/...`, …) | no redirect (404 / normal route)                                                                                                     |

**Rollback:** redeploy the previous Pages build (or `wrangler pages` rollback). No data state changes. Caveat: any 301 already cached by a browser will keep pointing at `/ar/...`; after a rollback those prefixed routes 404 until the forwarding code is restored. If the owner wants rollback-proofing, ship the map as 302 for one release (§3.2) — recommendation stays 301.

**Maintenance:** `PUBLIC_ROOTS` in `routes.ts` is the single place to register a new public root; add a unit test that asserts every directory immediately under `src/routes/[lang=lang]/` is either a known root or a dynamic `[department]` so the guard fails loudly when someone adds `/faq` without redirect coverage.

---

## 5. Testing strategy

Commands are the repo's declared ones (`package.json` scripts; CI order at `.github/workflows/ci.yml:38-50`):

```
pnpm run check                                   # svelte-check
pnpm exec vp check                               # lint/format/type-aware
pnpm run test:unit -- --run                      # vp test
pnpm exec drizzle-kit migrate                    # schema replay canary
pnpm run build                                   # vp build
pnpm exec playwright test                        # E2E (CI sets E2E_USE_BUILD=1)
```

**Unit (server project, `*.spec.ts`, `vite-plus/test`):**

- `src/lib/i18n/routes.spec.ts`: `localizedPath`/`stripLocale`/`switchLocalePath`; `legacyRedirectTarget` allowlist — each table row above, reserved roots return `null`, unknown roots return `null`; `switchLocalePath` returns `null` for private prefixes; the route-inventory guard test from §4.
- `src/lib/server/lang.spec.ts` (extend): `resolveLang` precedence (param beats cookie, cookie beats header, header beats default), invalid param ignored, `getLangFromPathname`.
- `src/lib/server/page-cache.spec.ts`: with a fake `{ match, put, delete }` cache — miss writes with `X-Page-Cache-At`; fresh entry hits; expired entry is a miss; `Set-Cookie` responses are not stored; session-cookie requests bypass; non-HTML (`application/json` `__data.json`) is not stored; query-string requests bypass; `purgePageCache` deletes exactly the computed URLs. Include tests where `globalThis.caches` is absent (no-throw, direct render).
- SEO snapshot: render/instantiate the alternates/canonical/`og:locale` derivation from `Seo`'s inputs (or assert the pure helpers) for `path="/"`, `"/products"`, `"/honey/sidr/x"` → exact `hreflang` hrefs and canonical.
- Sitemap: a server test drives `GET` against a seeded temp DB (pattern of the existing admin/store specs) and asserts: two `<url>` per entity, `xhtml:link` `ar`/`en`/`x-default`, `lastmod` preserved, `/products` present.

**E2E (Playwright, `tests/` + `src/routes/*.e2e.ts`):**

- New `tests/i18n-routing.e2e.ts`:
  - `GET /` → 301 (Playwright `request.get` with `maxRedirects: 0` or `page.goto` final URL `/ar`);
  - `/honey`, `/products?dept=honey`, `/blends`, `/about`, `/store/honey` → final URL starts `/ar/`;
  - `/en/honey/sidr/honey-sidr-1kg` renders English chrome and `<html lang="en" dir="ltr">` before JS (`page.locator("html")` attribute);
  - `<link rel="alternate" hreflang="ar|en|x-default">` values on `/ar/...` and `/en/...`;
  - canonical equals the current locale URL; `og:locale` differs per locale;
  - switcher: from `/en/honey?q=سدر` click switch → URL `/ar/honey?q=سدر`, query preserved, then `/api/lang` persisted (assert cookie via `context.cookies()`);
  - private flow untouched: `/checkout` still works after visiting `/en/...`; success URL still `/checkout/success/<id>`;
  - sitemap: `GET /sitemap.xml` contains both locales and alternates for one product.
- Update existing specs: public route strings get a small helper (`storeUrl(lang, path)`) in `src/routes/e2e-utils.ts` or `tests/`; `tests/storefront-ux.e2e.ts:3-6` stops relying on the lang cookie for public pages; `tests/departments.e2e.ts` keeps `/products?dept=…` assertions but expects `/ar` prefix in final URLs; one spec keeps hitting legacy URLs to pin the redirect map.
- Cache assertions (PR 2): fetch a public page twice in preview (`wrangler pages dev`, platform present) and expect `X-Page-Cache: MISS` then `HIT`; assert private/API paths never carry the header. Miniflare's Cache API support is exercised here — if it proves flaky in CI, keep the cache behavior covered by the unit wrapper tests and a manual runbook check (documented, not silently skipped).

**Post-deploy manual checks (runbook):** legacy URL spot-check list, `curl -I` for `cf-cache-status` after Cache Rules exist, sitemap URL count, Search Console hreflang validation.

---

## 6. Observability

**Baseline before PR 1 (record in `docs/architecture.md` / runbook):**

- Workers & Pages → `beeking-etman-website` → requests/day, Function invocations, status mix (301/404/5xx), top paths.
- D1 → `beeking` → Metrics → rows read/written per day (`docs/architecture.md:261-262`).

**After PR 1:** 301 rate should spike then decay; 404 rate must not rise above baseline. Watch top paths for stray `/ar/ar/...` double-prefixing (a bug signature) and for redirect loops.

**After PR 2 (cache):**

| Metric                                   | Target                                                               | Source                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| D1 rows read/day on public paths         | 60–85% below baseline at flat traffic                                | D1 Row Metrics + request counts                                                      |
| `X-Page-Cache: HIT` share on public HTML | ≥ 70% after warm-up                                                  | sampled structured log (`{ evt: "page_cache", lang, path, result }`, no cookies/PII) |
| Function invocations                     | flat vs baseline initially; drop to hit-rate share after Cache Rules | Pages analytics                                                                      |
| 404 / redirect-loop errors               | ≤ baseline                                                           | Pages analytics + Playwright canary                                                  |
| Catalog edit freshness                   | ≤ 5 min in worst colo                                                | manual admin edit → curl both locales                                                |

Add a lightweight scheduled canary (GitHub Actions cron, consistent with the existing CI ownership model) that asserts `/` → `/ar` 301, both locale homes 200, and sitemap contains `hreflang="en"` — failures are loud instead of silent. Purge failures are logged with the URL list; a purge outage is bounded by the TTL and does not page anyone.

---

## 7. Security / abuse

- **Open-redirect guard:** the only redirect target the hook can produce is `${DEFAULT_LANG}${pathname}${search}` from the allowlisted map; the host/origin is never taken from the request. Path handling rejects `//`-prefixed and backslash-containing targets (same rules as `safeRedirectTarget`, `login-redirect.ts:22-27`), and only `GET`/`HEAD` are redirected. Locale switching validates the target against `ar|en` and preserves only `pathname + search` on the same origin.
- **Cache poisoning:** only allowlisted public GET/HEAD, status 200, `text/html`, no `Set-Cookie`, no session cookie, and no query string are cached. No user-supplied header participates in the cache key. Private/API/admin paths are never cached. `Vary` is not used for caching (the anonymous layout removes the variance).
- **No PII in cache or logs:** cached HTML is the anonymous storefront only; the debug/log fields are path, locale, and hit/miss.
- **Cookie scope unchanged:** cart `path: "/"`, lang `path: "/"`, order access `/checkout/success` (`order-access.ts:56`), checkout nonces `/checkout` (`checkout-nonce.ts:14,19`). Private routes are not prefixed, so no scope rewrite and no auth regression.
- **No new attack surface:** no new endpoint; `/api/lang` keeps its POST-only shape and unknown-value fallback; admin purge runs only inside already role-gated, audit-logged mutations.
- **Admin authorization unchanged:** purge calls happen after `isAdminRole` checks in the existing services; no purge endpoint is exposed.

---

## 8. Open decisions

| #   | Decision                                               | Recommendation                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | Default-locale redirect: negotiate or not; 301 or 302? | Deterministic **301 → `/ar`** for `/` and every legacy public URL; no negotiation on redirects (browser-cached 301 correctness, Googlebot consistency). Private routes keep negotiation. Optional 302 soak only if the owner wants rollback-proofing. |
| 8.2 | Slug strategy                                          | **Shared Latin slugs** for both locales (current values). Arabic slugs are a separate ADR with a migration + 301 plan if ever needed.                                                                                                                 |
| 8.3 | Prerender vs cache                                     | **Hybrid:** prerender `/about` (static, both locales); Cache API + public `Cache-Control` for D1 pages; Cache Rules once a custom domain exists. Full build-time prerender of catalog pages is rejected (no seeded DB in CI; runtime admin edits).    |
| 8.4 | Private-route prefixing                                | **Keep private routes unprefixed.** Prefixing checkout would break order-access/nonce cookie scopes and email links for zero SEO value (they are `noindex`).                                                                                          |
| 8.5 | Negotiation for public first visits                    | **None in v1.** Language is chosen by URL; the switcher persists the cookie for private pages. Revisit only with real user complaints.                                                                                                                |
| 8.6 | Preference sync for direct `/en/...` arrivals          | **Defer.** If tracked, add a `sessionStorage`-guarded one-shot `POST /api/lang` from the public layout (no effect on cached HTML).                                                                                                                    |
| 8.7 | Workers Cache / Cache Rules                            | **Workers Cache: no** (hits still count as Worker requests; would meter static assets). **Cache Rules: yes, later** — requires the custom domain (business dependency); purge-by-URL is free and available then.                                      |
| 8.8 | Query-string caching (`?q=`, `?page=`, `?sort=`)       | **Exclude in v1** (cardinality + abuse bound). Revisit for `?page=1..N` after measuring traffic.                                                                                                                                                      |

---

## 9. Ordered task breakdown

Sizes are half-day implementation estimates. Dependencies are hard prerequisites; parallelizable work is listed under the table.

| #   | Task                                                                                                                                            | Size               | Deps    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------- |
| 1   | Baseline metrics snapshot (Pages requests/status, D1 rows read) + `src/lib/i18n/routes.ts` + `src/params/lang.ts` + unit specs                  | 1 d                | —       |
| 2   | Move public routes under `[lang=lang]`; public layout (no cookies); root layout branch + delete unused `getCategories`; `<html lang>` transform | 2 d                | 1       |
| 3   | Legacy 301 redirect hook + map + specs (302-vs-301 flag documented)                                                                             | 0.5 d              | 1       |
| 4   | Localize URL builders (`storefront.ts` dedupe) + Header/Footer/Hero/CartDrawer/error/account/success links + switcher link                      | 1 d                | 1       |
| 5   | SEO: `Seo.svelte` alternates/canonical/`og:locale`; `seo.ts` localized JSON-LD; sitemap locale × urls + alternates                              | 1 d                | 2       |
| 6   | E2E migration: helper + updated specs + new `tests/i18n-routing.e2e.ts` (redirects, hreflang, switcher, sitemap, private unaffected)            | 2 d                | 2,3,4,5 |
| 7   | Anonymous split completion: client session enhancement in `Header` + public-layout no-session test                                              | 1 d                | 2       |
| 8   | `page-cache.ts` + hook wiring + public `Cache-Control` headers + `X-Page-Cache` + unit specs                                                    | 1.5 d              | 7       |
| 9   | Admin purge hooks (products/categories) + unit/E2E verification within TTL                                                                      | 0.5 d              | 8       |
| 10  | Prerender `[lang]/about` (`prerender = true` + `entries()`) + build assertion                                                                   | 0.5 d              | 2       |
| 11  | Observability after-metrics + docs: `docs/decisions.md` ADR, `docs/architecture.md` routing/cost sections, `docs/todo.md:35-37,43-44` status    | 0.5 d              | 6,9     |
| 12  | (Conditional) custom domain: `PUBLIC_SITE_URL`, Search Console verification, Cache Rules + purge-by-URL                                         | 1 d + business dep | 11      |

**Parallelization:** 1 → {2,3,4}; 5 after 2; 6 after 2–5; 7 after 2; {8,10} after 7; 9 after 8; 11 after 6+9. **External dependencies (not tasks):** domain purchase + DNS (gates task 12 and the invocation-reduction half of the cost goal); Search Console access for hreflang validation.

**Documentation follow-ups (implementation tasks, not this spec):** ADR in `docs/decisions.md` recording option A + the cache/Workers-Cache rejections; `docs/architecture.md` module map (matcher, `routes.ts`, `page-cache.ts`) and cost posture (cache layer + measured numbers); `docs/todo.md` closes the "hreflang not applicable" and "prerender needs anonymous split" notes with links here.
