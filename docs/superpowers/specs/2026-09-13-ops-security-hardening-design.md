# Ops & Security Hardening — Design Spec

**Date:** 2026-09-13
**Status:** Proposed (implementation plan input)
**Scope:** Security headers/CSP, auth abuse controls, email escaping, email verification, CI/deploy
safety (version + health + post-deploy verification + secret preflight), supply chain, D1
backup/restore, observability, and the runbook truth pass.
**Repo docs:** English.
**Companion specs:**
`docs/superpowers/specs/2026-09-13-email-delivery-pipeline-design.md` (outbox + sending worker) and
`docs/superpowers/specs/2026-09-13-order-lifecycle-payments-design.md` (Paymob, redirect checkout).
This spec assumes both land and designs only the interfaces it consumes or extends.
**Roadmap:** `docs/superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md` is
authoritative for cross-spec arbitration (migration numbering, single ownership); this spec's
verification backfill is frozen at `0020_email_verified_backfill.sql`.

---

## 1. Context & current state

| #   | Gap                                                                                                                               | Risk                                                                                                                                        | Current mitigation                                                                                                                                 | Evidence                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No security headers anywhere (no CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, HSTS) | Clickjacking, MIME sniffing, XSS impact amplification, referrer leakage                                                                     | None. `static/` holds only `fonts/`, `images/`, `robots.txt`; the adapter emits only cache/`X-Robots-Tag` rules for `/_app/*`                      | `src/hooks.server.ts:23-45`; adapter `node_modules/@sveltejs/adapter-cloudflare/index.js:235-248`; `static/_headers` absent, and creating it **fails the build** (`index.js:32-36`)                      |
| 2   | Better Auth JSON endpoints for password reset / verification resend are not covered by the DB rate limiter                        | Email bombing, enumeration probing, reset-token brute force, provider quota burn                                                            | Better Auth's built-in limiter is enabled by default in production but uses **in-memory storage per isolate**; its special rule is 3/60 s per path | `src/hooks.server.ts:18-21`; `src/lib/server/rate-limit.ts:9-12`; `node_modules/better-auth/dist/context/create-context.mjs:169-174`; `node_modules/better-auth/dist/api/rate-limiter/index.mjs:294-310` |
| 3   | Reset email interpolates `user.name \|\| user.email` unescaped into HTML                                                          | Stored XSS in email clients / forged markup to the account owner                                                                            | `escapeHtml` exists but is private to `email.ts`                                                                                                   | `src/lib/server/auth.ts:46,49,66,69`; `src/lib/server/email.ts:165-171`                                                                                                                                  |
| 4   | Email verification not configured; no verified-email precondition on admin bootstrap                                              | Anyone with a matching email (typo/domain takeover) can be promoted to admin; no ownership proof for recovery                               | `emailVerified` column exists, default `false`, never enforced                                                                                     | `src/lib/server/auth.ts:23-24`; `src/lib/server/db/auth.schema.ts:8`; `src/lib/server/admin/bootstrap.ts:19-31`                                                                                          |
| 5   | Health route is shallow (`{ok:true}`) and CI has no post-deploy verification                                                      | A bad deploy (like the 2026-08-22 Error 1101) is only discovered by users/admins; no revision confirmation                                  | `tests/health.e2e.ts:6-8` waits on it during E2E; grep shows no `/api/health` checks in `ci.yml`                                                   | `src/routes/api/health/+server.ts:6-13`; `.github/workflows/ci.yml:107-144`                                                                                                                              |
| 6   | CI cannot detect bad values in Pages runtime secrets before a deploy                                                              | Repeat of the 1101 incident: fail-hard boot validation throws on the first production request                                               | Boot-time validation only (throws after deploy)                                                                                                    | `docs/todo.md:160-163`; `src/lib/server/env.ts:19-42`; `docs/production-runbook.md:100-113` (secrets live only in Pages)                                                                                 |
| 7   | No `pnpm audit` gate, no Dependabot, no CodeQL; GitHub Actions pinned by mutable tag (`@v4`, `@v3`)                               | Known vulnerable prod deps can ship; compromised action tags can exfiltrate tokens                                                          | `pnpm audit` manually clean as of 2026-09-09; `--frozen-lockfile` only                                                                             | `.github/workflows/ci.yml:29-37,52,70,101,135`; no `.github/dependabot.yml`; no CodeQL workflow (verified by `ls .github/workflows`)                                                                     |
| 8   | No backup/restore procedure or rehearsal; FTS5 virtual table blocks whole-DB export                                               | Data loss cannot be bounded or recovered beyond the built-in window; a broken backup is discovered during an incident                       | D1 Time Travel (always on, **7 days on Free**); `d1-seed.sql` is catalog-only                                                                      | `docs/todo.md:429-457`; Cloudflare D1 Time Travel docs; D1 export docs (virtual tables unsupported)                                                                                                      |
| 9   | No observability config and no alerting; docs say "dashboard only"                                                                | Errors/dead letters/rate-limit spikes are invisible until a customer complains                                                              | Manual dashboard review                                                                                                                            | `wrangler.jsonc:1-29`; `docs/architecture.md:244-266`                                                                                                                                                    |
| 10  | Docs disagree about the deploy pipeline and the Pages Git integration                                                             | Operators follow a runbook that describes a removed `e2e` job, an old concurrency group, and a Git integration that is in fact disconnected | None; `TODO` claims disabling it is still pending                                                                                                  | `docs/production-runbook.md:15-41,64-66,81-98`; `docs/architecture.md:230-242`; `docs/todo.md:477-480`; vs `.github/workflows/ci.yml:9-16,24-76`                                                         |

**Verified during this spec (2026-09-13):** the Pages project `beeking-etman-website` has
`source: null` (no Git repository attached → Direct Upload only) and its production
`env_vars` are exactly `ADMIN_EMAIL`, `BETTER_AUTH_SECRET`, `ORDER_ACCESS_SECRET`, `ORIGIN`,
all of type `secret_text` (Cloudflare API `GET /accounts/…/pages/projects/beeking-etman-website`).
The runbook instruction "disable the Pages Git integration" is therefore already satisfied;
the docs are stale, not the platform.

Out of scope but relevant: `src/lib/analytics.ts:25-33` already bundles `posthog-js` with
`api_host: "https://us.i.posthog.com"` and `src/routes/+layout.svelte:28` initializes it when
`PUBLIC_POSTHOG_KEY` is set (it is not in the Pages production env today). CSP is designed to
accommodate it from day one. Paymob is redirect-based, not iframe
(`docs/superpowers/specs/2026-09-13-order-lifecycle-payments-design.md:288-330`), so it requires
no CSP change under the recommended design.

---

## 2. Goals / Non-goals

### Goals

1. Every server-rendered response carries a reviewed security-header set and a CSP that is
   enforceable against the **actual** HTML this app emits (including JSON-LD and hydration
   scripts), without breaking the storefront.
2. Auth abuse controls become durable (DB-backed) and cover reset/verification paths with
   per-IP **and** per-account windows, without enabling user enumeration.
3. HTML escaping has one source of truth and is applied at the reset-email boundary.
4. Email verification is enabled end-to-end: existing users are migrated, new users verify,
   admin bootstrap and recovery require verification, guest checkout never does.
5. Production deploys are self-verifying: the deploy job fails red unless the live origin serves
   the exact commit and passes health/header checks; required Pages env vars are checked for
   presence before any deploy; the runbook matches reality.
6. Supply-chain controls (audit gate, Dependabot, CodeQL, SHA pinning, lockfile integrity) run in
   CI, not by habit.
7. Backup/restore is a rehearsed procedure with explicit retention, not an improvisation.
8. Error telemetry is enabled (`observability`) with a lightweight external probe; the choice of
   error-tracking tool is documented with an adoption trigger.
9. `docs/production-runbook.md`, `docs/architecture.md`, and `docs/todo.md` describe the system
   that exists.

### Non-goals

- Implementing Paymob, PostHog event taxonomy, or the email outbox/worker (separate specs).
- Automatic rollback on health failure (verification fails the workflow; rollback stays manual).
- WAF/bot-management configuration.
- Paid Cloudflare features (Workers Paid, Logpush, Enterprise traffic alerts).
- Sentry adoption now (deferred with an explicit trigger — §7.2).
- Admin audit log and Cairo-timezone reporting (Phase 5 in `docs/todo.md:93-97`).

---

## 3. Proposed design

### 3.1 Security headers (Cloudflare Pages)

#### 3.1.1 Where the headers live

Three candidate mechanisms exist; only one can own SSR responses:

| Mechanism                                                            | Applies to                                                                                                                                                                                                                                                                                            | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `static/_headers`                                                    | Nothing — `@sveltejs/adapter-cloudflare` **throws at build time** if the file exists in the assets directory (`node_modules/@sveltejs/adapter-cloudflare/index.js:32-36`)                                                                                                                             | Rejected (build-breaking)                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Root `_headers` (project root, next to `package.json`)               | **Static asset responses only.** The adapter copies it to the build output and appends its generated cache rules (`index.js:137-142,235-248`). Cloudflare documents that `_headers` is **not applied to Pages Functions responses** — and this app is `_run_worker.js`-first for every HTML/API route | Needed for `/fonts/*` and `/images/*`; insufficient alone                                                                                                                                                                                                                                                                                                                                                                                                                           |
| SvelteKit `kit.csp` (inline in `vite.config.ts`)                     | Dynamically rendered pages; SvelteKit nonces only the scripts/styles **it generates** (`@sveltejs/kit` types `KitConfig.csp`, and `src/runtime/server/page/render.js:200,587,627`)                                                                                                                    | Insufficient: JSON-LD is emitted by app components as a raw inline `<script>` with no nonce/hash — verified in the current build output (`.svelte-kit/output/server/chunks/Seo2.js:28`), generated from `src/lib/components/Seo.svelte:56` and used on `/` (`src/routes/+page.svelte:31`) and product pages (`src/routes/[department]/[category]/[slug]/+page.svelte:86-94`). A strict `kit.csp` `script-src` would silently break structured data (and produce CSP console errors) |
| **Custom CSP + headers in the existing `handle` hook** (recommended) | Every SSR/API response; per-request nonce is injected into the final HTML with `transformPageChunk`                                                                                                                                                                                                   | Chosen                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Implementation extends `src/hooks.server.ts` (no new hook file), keeping `handleBetterAuth`
as the last step of the chain:

```ts
// src/hooks.server.ts (shape)
const handleBetterAuth: Handle = async ({ event, resolve }) => {
  const nonce = generateCspNonce(); // 16 random bytes -> base64url
  event.setHeaders(buildSecurityHeaders(nonce, cspModeFromEnv())); // constants + nonce only
  return svelteKitHandler({
    event,
    resolve: (e) =>
      resolve(e, {
        transformPageChunk: ({ html }) => injectNonce(html, nonce), // HTML only
      }),
    auth,
    building,
  });
};
```

- `injectNonce` matches only script tags without a `nonce` attribute:
  `/<script(?![^>]*\bnonce=)/g` and inserts ` nonce="<nonce>"`. This covers SvelteKit's
  hydration/init scripts (which have no nonce unless `kit.csp` is configured) **and** the
  JSON-LD blocks. `<style>` is intentionally not nonced (see directives).
- The nonce is generated with WebCrypto (`crypto.getRandomValues`) and is never logged or
  persisted. `event.setHeaders` is already the codebase's header mechanism
  (`src/routes/products/+page.server.ts:21`, `src/routes/checkout/success/[id]/+page.server.ts:13`).
- `handle` does not run during the build (no prerendered pages in this app), so no
  `building` branch is required for the nonce; keep the existing `building` guard semantics.

#### 3.1.2 Exact CSP for the current app

Enforced directives (mode selected by `CSP_MODE` env: `report-only` first, then `enforce`):

```
default-src 'self';
base-uri 'self';
object-src 'none';
script-src 'self' 'nonce-<per-request>';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com;
frame-src 'none';
frame-ancestors 'none';
form-action 'self';
upgrade-insecure-requests
```

Rationale / evidence per directive:

- `default-src 'self'` — first-party only. No external images/fonts remain
  (`docs/architecture.md:244-266`); PostHog is deliberately enumerated below.
- `script-src 'self' 'nonce-…'` — no `'unsafe-inline'`, no `'unsafe-eval'`. PostHog is
  dynamically imported from the app bundle (`src/lib/analytics.ts:24-25`), so it is served
  same-origin under `'self'`. `%sveltekit.nonce%` is **not** usable inside components, which is
  why the hook injects the nonce post-render.
- `style-src 'self' 'unsafe-inline'` — required today by 3 server-rendered `style="…"`
  attributes in `ProductImageGallery.svelte` and
  `admin/+page.svelte` (2), and is the SvelteKit-documented requirement for Svelte transitions
  (`KitConfig.csp` note). **Do not add a nonce or hash to `style-src`**: per CSP3, a nonce/hash
  causes `'unsafe-inline'` to be ignored, which would block style attributes. Follow-up hardening
  (optional): refactor the 3 attributes to classes, then drop `'unsafe-inline'`.
- `img-src 'self' data: blob:` — `data:` for Vite-inlined small assets; `blob:` for the admin
  image preview (`src/lib/components/admin/ImageUpload.svelte:34`).
- `font-src 'self'` — self-hosted `static/fonts/`.
- `connect-src` — `'self'` for `/api/*`, `/api/rpc`, the cart store and oRPC client; the two
  PostHog hosts are the vendor-documented US ingestion/CDN endpoints
  (`posthog.com/docs/advanced/content-security-policy`). If Session Replay/Surveys are enabled
  later, PostHog documents adding `https://*.posthog.com` to `script-src` and
  `worker-src 'self' blob: data:`; add them only when the feature is switched on.
- `frame-src 'none'` / `frame-ancestors 'none'` — the site frames nothing and is framed by
  nothing. Paymob is a **redirect** flow, so no `frame-src` change is needed; if the payments
  spec later moves to iframe embedding, add exactly `https://accept.paymob.com` (the origin
  documented in the payments spec, `…payments-design.md:261-330`) and nothing else.
- `form-action 'self'` — all forms post to our own actions; the Paymob redirect happens
  server-side (303), which is not subject to `form-action`.
- `upgrade-insecure-requests` — safe on Pages; no known mixed content.
- No `report-uri` in the first release: there is no collector. Violations are surfaced by
  browser console checks in E2E (§5) and by the post-deploy verifier.

#### 3.1.3 Non-CSP headers

Set on every SSR/API response from the same hook:

| Header                                      | Value                                                                                                           | Notes                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options`                    | `nosniff`                                                                                                       |                                                                                                                                    |
| `Referrer-Policy`                           | `strict-origin-when-cross-origin`                                                                               | Keeps origin on outbound redirects (useful for future payment return URLs)                                                         |
| `Permissions-Policy`                        | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()` | `payment=()` today (no Payment Request API); revisit only if one is introduced                                                     |
| `X-Frame-Options`                           | `DENY`                                                                                                          | Legacy companion to `frame-ancestors`                                                                                              |
| `Cross-Origin-Opener-Policy`                | `same-origin-allow-popups`                                                                                      | Allows a future Paymob popup return without weakening script isolation                                                             |
| `Content-Security-Policy` / `…-Report-Only` | §3.1.2                                                                                                          | One of the two, never both                                                                                                         |
| `Strict-Transport-Security`                 | **not set in app** initially                                                                                    | See §7.4; prefer zone-level HSTS when a custom domain exists. If set in-app: `max-age=86400`, no `includeSubDomains`, no `preload` |

Static assets get a root `_headers` file (build-safe; the adapter copies it and appends its
generated `/_app/*` block). It sets only the security subset — cache policy is deliberately left
to Pages defaults so this change cannot alter asset freshness:

```
/fonts/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/images/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/robots.txt
  X-Content-Type-Options: nosniff
```

Do **not** create `static/_headers` (build failure) and do not duplicate the adapter's generated
`/_app/*` cache block.

#### 3.1.4 Rollout and caching constraints

- Ship `CSP_MODE=report-only` first (header name `Content-Security-Policy-Report-Only`, all other
  headers enforced), run the E2E console-violation checks, then flip `CSP_MODE=enforce`.
- Nonce-bearing HTML must never be shared-cached. Pages already responds with
  `cache-control: private, max-age=60|120` on catalog/product pages
  (`src/routes/products/+page.server.ts:21`, `src/routes/[department]/[category]/+page.server.ts:20`,
  `src/routes/[department]/[category]/[slug]/+page.server.ts:19`) and private/no-store on
  checkout/success; verify no `s-maxage`/`CDN-Cache-Control` is introduced. `/api/health` is
  `no-store` (§3.5.1).

### 3.2 Auth throttling

#### 3.2.1 Paths and windows

Better Auth endpoint paths verified in the installed package:
`POST /api/auth/request-password-reset` (server route `/request-password-reset`,
`node_modules/better-auth/dist/api/routes/password.mjs:21`), `POST /api/auth/reset-password`
(`password.mjs:130`), `GET /api/auth/reset-password/:token` (`password.mjs:93`),
`POST /api/auth/send-verification-email`
(`node_modules/better-auth/dist/api/routes/email-verification.mjs:37`),
`GET /api/auth/verify-email` (`email-verification.mjs:124`). The existing hook map keys paths
after `/api/auth` (`src/hooks.server.ts:32`), so the new keys are exactly those path strings.

Extend `AUTH_RATE_LIMITS` (`src/lib/server/rate-limit.ts:9-12`) with:

| Limiter                    | Per IP      | Per account (hash of lowercased email)   | Notes                                                                                |
| -------------------------- | ----------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `login` (existing)         | 10 / 60 s   | **new:** 10 / 15 min                     | Account window throttles distributed credential stuffing without a permanent lockout |
| `register` (existing)      | 5 / 1 h     | —                                        | Account key adds nothing pre-account                                                 |
| `passwordResetRequest`     | 5 / 15 min  | 3 / 1 h                                  | Mirrors Better Auth's 3/60 s special rule but durable                                |
| `passwordResetConfirm`     | 10 / 15 min | — (token is in the body; IP window only) | Token entropy is the primary control                                                 |
| `verificationResend`       | 5 / 15 min  | 3 / 1 h                                  | Prevents email bombing a victim's inbox                                              |
| `verifyEmailConsume` (GET) | 10 / 15 min | —                                        | Requires extending the hook to GET paths (below)                                     |

#### 3.2.2 Implementation

- Refactor `AUTH_RATE_LIMITED_PATHS` from a `Map<string, (ip) => …>` (`hooks.server.ts:18-21`)
  into a config array:
  `{ path: string, methods: ["POST"], limiter, accountKey?: (body) => … }`.
- For per-account keys, `event.request.clone().json()` is read **before** Better Auth consumes
  the original body (clone first; a parse failure falls back to IP-only). The key is
  `sha256("auth:" + limiter + ":" + normalize(email))` via WebCrypto, or HMAC with
  `BETTER_AUTH_SECRET` if we want to avoid a rainbow table over the internal rate-limit table;
  either way, **never store the raw email in `store_rate_limit`**.
- Non-existent accounts increment the same buckets as existing ones, so the response timing and
  buckets do not reveal account existence. Responses stay generic: the existing 429 body uses the
  shared i18n key `errors.tooManyAttempts` (`hooks.server.ts:34-41`); add a `Retry-After` header
  (window seconds) for well-behaved clients.
- GET endpoints (`/verify-email`, `/reset-password/:token`) are currently invisible to the hook
  (`event.request.method === "POST"` at `hooks.server.ts:31`). Extend the condition to POST plus
  the configured GET paths; do not rate-limit all GETs (static/API noise).
- Better Auth's own limiter remains a second layer with in-memory storage; do not rely on it
  (`create-context.mjs:169-174`). Optionally its `rateLimit.customStorage` could reuse the DB
  table later; out of scope.
- Client IP trust: `clientAddressKey` (`rate-limit.ts:78-83`) is backed by
  `cf-connecting-ip` in the Pages adapter (`node_modules/@sveltejs/adapter-cloudflare/files/worker.js:111-114`),
  which the edge sets and clients cannot spoof. Note this in review so no one "fixes" it to read
  `X-Forwarded-For`.

#### 3.2.3 UI/flow note

The reset/verification flows are Better Auth endpoints; the login page currently has no
forgot-password entry point (no `src/routes/**reset**`/`forgot` routes; login page has no link).
Adding the request form and the "check your inbox / resend" UI is part of the verification tasks
(§8 tasks 19-21), reusing the same throttle buckets.

#### 3.2.4 Tests

- Unit (`src/lib/server/rate-limit.spec.ts` additions): key derivation is stable and
  email-normalized; each limiter's window/max; a spoofed body without `email` falls back to IP.
- E2E (`tests/auth-throttle.e2e.ts`): POST `/api/auth/request-password-reset` and
  `/api/auth/send-verification-email` until 429 with `Retry-After`; assert the 429 body is the
  generic i18n message. Use the existing `clearRateLimitRows` helper
  (imported in `tests/admin-guard.e2e.ts:3`).

### 3.3 Email escaping (single source)

- New module `src/lib/html.ts` (isomorphic, no server-only imports) exporting
  `escapeHtml(value: string): string` covering `& < > " '` and a unit test
  (`src/lib/html.spec.ts`) that includes the `'` case the current implementation misses.
- Delete the private copy in `src/lib/server/email.ts:165-171` and import the shared helper.
- Extract the reset-email template out of `auth.ts` into a pure
  `renderPasswordResetEmail({ name, email, url }): { subject: string; html: string; text: string }`
  (`src/lib/server/auth-email.ts`). `auth.ts` then only wires Better Auth to the renderer +
  delivery. Escape `name`/`email` at the render boundary (`auth.ts:46` today) and escape the
  `url` for its HTML attribute context (`auth.ts:49`); the plain-text body needs no HTML
  escaping (`auth.ts:66,69`).
- Outbox alignment (the email spec owns the outbox delivery step; this spec owns the renderer,
  escaping, and the gate): `sendResetPassword` becomes
  `await enqueueEmail(db, { …renderPasswordResetEmail(...)… }, { type: "password_reset", idempotencyKey: "password-reset/<userId>/<ts>" })`
  per `docs/superpowers/specs/…email-delivery-pipeline-design.md:363`, and the same renderer is
  reused for the verification email (`type: "verification"`). Until that spec lands, this spec's
  renderer is independent; the interface is the renderer + a one-line send call.
- Tests: `src/lib/html.spec.ts`; `src/lib/server/auth-email.spec.ts` asserts a crafted
  `name = '<img src=x onerror=alert(1)>'` renders escaped in `html` and raw in `text`, and that
  the URL is attribute-escaped.

### 3.4 Email verification

#### 3.4.1 Configuration

Add to `betterAuth({ … })` (`src/lib/server/auth.ts:19-88`):

```ts
emailAndPassword: { enabled: true, minPasswordLength: 8, requireEmailVerification: false /* keep */ },
emailVerification: {
  sendVerificationEmail: async ({ user, url }) => { /* render + enqueue, same as reset */ },
  sendOnSignUp: true,
  autoSignInAfterVerification: true,
  expiresIn: 60 * 60,
},
```

`requireEmailVerification` stays `false` so unverified users can sign in and check out; the store
never blocks on it. Verify the exact option names against the installed
`better-auth@^1.7.1` type definitions at implementation time (interface names have moved between
minor versions).

#### 3.4.2 Gating matrix

| Action                                      | Guest                                              | Signed in, unverified                                                         | Signed in, verified |
| ------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| Checkout / order                            | Allowed (unchanged)                                | Allowed                                                                       | Allowed             |
| Sign-in / account pages                     | n/a                                                | Allowed + persistent "verify your email" banner with resend                   | Allowed             |
| Admin bootstrap promotion (`isAdminEmail`)  | n/a                                                | **Denied** — promotion requires `emailVerified === true`                      | Allowed             |
| Password reset email issued                 | Reset form still returns the same generic response | **No email sent** until verified; response stays generic to avoid enumeration | Sent                |
| Email change (when the account UI gains it) | n/a                                                | Denied                                                                        | Allowed             |

Trade-off accepted: a brand-new user who loses their password before verifying cannot self-serve a
reset; they can resend the verification email, and the owner has a documented D1 escape hatch
(`UPDATE user SET email_verified = 1 WHERE email = ?`) recorded in the runbook.

#### 3.4.3 Migration path for existing users

- Existing rows were created before verification existed. Add a data migration (generated by
  `pnpm run db:generate`; file `0020_email_verified_backfill.sql`, index frozen by the roadmap,
  after the email spec's `0018` and the payments spec's `0019`):
  `UPDATE user SET email_verified = 1 WHERE email_verified = 0;`
  Run it **before** the deploy that starts gating recovery, so nobody is locked out. It is
  additive and safe for the currently live build (old code ignores the column).
- New sign-ups after that deploy start unverified.
- Post-migration verification query: `SELECT COUNT(*) FROM user WHERE email_verified = 0;` →
  expect 0 at migration time; the migration-replay spec
  (`docs/decisions.md:1444-1463` describes the replay chain) gets an assertion for the backfill.

#### 3.4.4 Resend limits and UX

- Resend goes through `/api/auth/send-verification-email`, covered by the
  `verificationResend` limiter (§3.2.1).
- Register success page gains "check your inbox" copy; login shows an unverified banner with a
  resend button (rate-limit feedback included). The verify-email callback is Better Auth's own
  `GET /api/auth/verify-email?token=…&callbackURL=…`; add a small landing page for the
  callback target if we want branded confirmation (optional).
- Tests: E2E registration creates a `verification` row; the test fetches the token from the
  isolated E2E D1 and hits the callback URL, then asserts `user.email_verified = 1`. Unit test
  the "verified before send" gate on the reset path with a fake DB.

### 3.5 CI / deploy safety

#### 3.5.1 Build-time version injection + `/api/health` (extend the existing route)

The route already exists (`src/routes/api/health/+server.ts`), contrary to some older notes; this
spec **extends** it rather than creating it.

- In `vite.config.ts`, add `version: { name: process.env.GITHUB_SHA ?? "dev" }` to the inline
  `sveltekit({...})` options (`vite.config.ts:19-31`; the plugin takes kit options at top level).
  SvelteKit exposes it as `version` from `$app/environment`
  (`node_modules/@sveltejs/kit/types/index.d.ts:3208-3227`), which is also what client update detection
  uses — deterministic commit SHA is the documented pattern.
- New contract for the route:

```
GET /api/health
200 {"ok":true,"version":"<sha>"}         headers: cache-control: no-store
503 {"ok":false,"version":"<sha>"}        when `SELECT 1` fails
```

Implementation stays two lines: keep `db.run(sql\`select 1\`)`, import `version`, return
  `json(..., { headers: { "cache-control": "no-store" } })`. No env dump, no DB row counts, no
  error text (the current route already returns a bare `{ok:false}`on failure). The route is
  cheap (~1 ms), unauthenticated by necessity, and already disallowed in`static/robots.txt`.

- Update `tests/health.e2e.ts` from `toEqual({ ok: true })` to assert `ok === true`,
  `typeof version === "string"` (locally `"dev"`) and the `no-store` header — the old exact
  equality would fail as soon as the field is added.
- Security note: the commit SHA is already public in Pages deployment metadata
  (`ci.yml:143` passes `--commit-hash`), so exposing it here adds no information.

#### 3.5.2 Post-deploy verification job

New `verify-production` job in `.github/workflows/ci.yml`, `needs: [deploy-production]`,
`if: github.ref == 'refs/heads/main' && github.event_name == 'push'`, `timeout-minutes: 8`,
`permissions: contents: read`, and **no environment** (it needs no secrets; keeping it out avoids
a third approval click). It runs a checked-in script so the logic is unit-testable and locally
runnable:

```yaml
verify-production:
  name: Verify production (health + commit SHA + headers)
  needs: [deploy-production]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  timeout-minutes: 8
  steps:
    - uses: actions/checkout@<sha> # v4
    - uses: actions/setup-node@<sha> # v4
      with: { node-version: 22 }
    - name: Verify deployed revision
      env:
        ORIGIN: ${{ vars.PRODUCTION_URL || 'https://beeking-etman-website.pages.dev' }}
        EXPECTED_SHA: ${{ github.sha }}
        CSP_MODE: ${{ vars.CSP_MODE || 'enforce' }}
      run: node scripts/ci/verify-production.mjs
```

`scripts/ci/verify-production.mjs` (pure logic in `src/lib/ci/verify-production.ts` +
`src/lib/ci/verify-production.spec.ts` with an injected `fetch`):

1. Poll `/api/health` up to 18 times, 10 s apart (deploy propagation + cold start): require
   HTTP 200, JSON `ok === true`, and `version === EXPECTED_SHA`. Version equality is the
   revision check that the 1101 incident lacked.
2. Poll `/` and the product page `/honey/sidr/honey-sidr-1kg` (the canonical E2E product URL,
   `tests/checkout.e2e.ts:11`) once the health check passes: require 200, `content-type`
   includes `text/html`, and a non-empty body.
3. Assert response headers on `/`: `x-content-type-options: nosniff`, a `referrer-policy`, and
   `content-security-policy` (or `…-report-only` when `CSP_MODE=report-only`); assert
   `cache-control` contains `no-store` on `/api/health`.
4. Any failure: exit non-zero with the attempt log (status codes and header names only — never
   response bodies containing PII).

#### 3.5.3 Secret validation before deploy (the 1101 lesson)

Value-level validation from CI is impossible for `secret_text` entries: the Cloudflare API
returns only the key and type, never the value (verified 2026-09-13 for this project). The
workable, honest design is a **presence/shape preflight** plus fast value detection:

- `scripts/ci/check-pages-env.mjs` (logic in `src/lib/ci/pages-env.ts` + spec):
  - `GET /accounts/{CLOUDFLARE_ACCOUNT_ID}/pages/projects/beeking-etman-website`, extract only
    `deployment_configs.production.env_vars`.
  - Required: `BETTER_AUTH_SECRET`, `ORDER_ACCESS_SECRET`, `ORIGIN`. Optional-but-validated:
    `ADMIN_EMAIL` (if present, must match the same plausibility rule as
    `src/lib/server/env.ts:38-41`). Extend the list with the email spec's Pages vars `EMAIL_FROM`
    and `ADMIN_NOTIFY_EMAILS`, and — conditionally, when `PAYMENTS_PROVIDER=paymob` — the six
    `PAYMOB_*` keys (payments spec §3.7; phase 2 only, inactive in v1 per AgDR-0001 — v1 requires
    `WHATSAPP_NUMBER` and the enabled receiving accounts instead, MS §3.8).
    `RESEND_API_KEY` is a Worker secret
    (`workers/email-sender/`) and must **not** be listed as a Pages var; worker secret presence is
    verified at worker deploy time, not by this preflight.
  - Prints **only** missing/invalid key names — never values (plaintext vars are returned in
    full by the API, so the script must not dump the response).
- Wire it as the first step of `migrate-production` (already behind the `production` environment
  approval, before any migration or deploy), using the existing `CLOUDFLARE_API_TOKEN` /
  `CLOUDFLARE_ACCOUNT_ID` secrets. Confirm the token includes `Account → Cloudflare Pages →
Read` (or the Pages Edit template); if not, that is a manual token update.
- Value mistakes that pass presence checks (short secret, wrong value) are caught by
  `verify-production` §3.5.2, because `env.ts:19-42` throws at module import in production and
  `/api/health` then never returns 200. The workflow fails red at deploy time instead of the
  first customer request. Document the generation command
  (`openssl rand -base64 33` → ≥ 32 chars) in the runbook so the root cause stops recurring.
- Unit tests: fixtures for `secret_text` (no value), plaintext, and missing keys; explicit test
  that the returned structure never includes a value field in the error message.

#### 3.5.4 Runbook rewrite (single documented truth)

`docs/production-runbook.md` is rewritten to match `.github/workflows/ci.yml`:

- Pipeline diagram: `test` (check, unit, worker typecheck + `test:worker`, migration replay,
  build, artifact, Playwright E2E via `E2E_USE_BUILD=1`) → `migrate-production` →
  `deploy-production` → worker deploy (`workers/email-sender/`, owned jointly with the email spec)
  → `verify-production`; no separate `e2e` job (contradicts `docs/production-runbook.md:15-41`);
  concurrency is `ci-${{ github.ref }}` with `cancel-in-progress: false` (contradicts the
  `production` group at `runbook:64-66`).
- Deployment ownership: **Direct Upload only; the Pages Git integration is disconnected**
  (verified `source: null`). Replace `runbook:81-98` ("disable it") with a verification step and
  remove the pending item from `docs/todo.md:477-480`. Also fix `docs/architecture.md:230-242`,
  which still describes an `e2e` job.
- External setup checklist (manual): environment reviewers, the two Cloudflare secrets, the
  Pages env-var list, Dependabot/CodeQL/secret-scanning toggles, `PRODUCTION_URL` repo variable,
  Notifications, backup storage.
- Rollback: code revert via PR (existing procedure) **plus** Cloudflare dashboard "Rollback to
  this deployment" for emergency UI rollback (D1 is not rolled back by either), **plus** D1 Time
  Travel restore for destructive data changes (§3.7). Add a "verification failed" playbook:
  read the verifier output, roll back, open an incident note in `docs/todo.md`.
- Add the new operational queries (dead letters, rate-limit spikes) and the CSP report-only →
  enforce toggle procedure.

### 3.6 Supply chain

- **Audit gate:** add `pnpm audit --prod --audit-level=high` to the `test` job after install.
  Dev-only advisories are excluded by `--prod`; the repo was audit-clean on 2026-09-09
  (`docs/todo.md:357-361`). A failure is fixed by an override in `pnpm-workspace.yaml`
  (`overrides:` already used, e.g. lodash/esbuild) or an upgrade — never by lowering the gate.
- **Dependabot:** commit `.github/dependabot.yml` with weekly `npm` (grouped minor/patch, limit 5) and `github-actions` ecosystems, target branch `main`. Dependabot understands
  `pnpm-lock.yaml`.
- **CodeQL:** `.github/workflows/codeql.yml` with `github/codeql-action/init@<sha>`,
  `languages: javascript-typescript`, `build-mode: none` (no compilation needed),
  `queries: security-extended`, triggers `push`/`pull_request` on `main` plus a weekly
  `schedule`; job permissions `security-events: write`, `contents: read`. Commit it; disable
  GitHub's "default setup" if it is ever enabled to avoid duplicate scans.
- **Secret scanning / push protection:** manual repository setting (Settings → Code security).
  Availability depends on the repo plan, so record the actual state in the runbook when
  toggled; in all cases the rule stands: no secret ever enters the repo (AGENTS.md).
- **Action pinning:** pin every third-party and GitHub action to a full commit SHA with a
  `# vX.Y.Z` comment (checkout, pnpm/action-setup, setup-node, upload/download-artifact,
  cloudflare/wrangler-action, github/codeql-action, actions/github-script if added). Resolve the
  SHAs at implementation with `gh api`; Dependabot's `github-actions` ecosystem updates
  SHA-pinned actions. Never `@main`.
- **Lockfile integrity:** `pnpm install --frozen-lockfile` is already enforced
  (`ci.yml:37,97,126`); keep it in every job. Do not add install flags that bypass the lockfile.
  The pnpm version is pinned via `devEngines` (`package.json:70-76`) and CI (`ci.yml:31-32`);
  keep the two in sync.

### 3.7 Backup / restore

#### 3.7.1 First line: D1 Time Travel

Always on, no cost. Free plan restores to any minute in the **last 7 days**; paid extends to 30
days (Cloudflare D1 Time Travel docs). Commands:

```sh
wrangler d1 time-travel info beeking --timestamp="2026-09-13T00:00:00Z"
wrangler d1 time-travel restore beeking --bookmark=<bookmark>
```

Restoring is destructive in place and returns an undo bookmark; record the previous bookmark in
the runbook whenever it is used.

#### 3.7.2 Durable export (7-day window is not enough)

`wrangler d1 export beeking --remote --output=db.sql` is the documented whole-DB export, **but it
is not supported for databases with virtual tables** and `store_product_fts` is an FTS5 virtual
table (`drizzle/0003_fts_search.sql:1-24`). The design therefore backs up **tables**, not the
database file, and rebuilds the search index from source data:

- `scripts/d1-backup.mjs` (logic in `src/lib/ci/d1-backup.ts` + unit tests):
  1. Resolve the table list from `sqlite_schema` excluding `store_product_fts%` (virtual + shadow
     tables).
  2. For each table, run
     `wrangler d1 export beeking --remote --table=<t> --no-schema --output=<dir>/<t>.sql`.
  3. Write `manifest.json` with per-file SHA-256, row counts (via `SELECT COUNT(*)`), and the
     live `d1_migrations` max id.
  4. Never write dumps into the repo; the dump contains customer PII.
- **Schema** is not exported: `drizzle/` migrations are the schema source of truth and are
  versioned, which is stronger than a schema dump.
- **Restore drill** (quarterly + before a destructive migration), local:
  1. `DATABASE_URL=file:/tmp/restore.db pnpm exec drizzle-kit migrate` (replays all migrations,
     including FTS creation/triggers).
  2. `sqlite3 /tmp/restore.db < <t>.sql` for every table file (FK order: users/categories →
     products/variants → orders/items → notifications).
  3. Populate FTS from the content tables with the same backfill `INSERT … SELECT` as
     `drizzle/0003_fts_search.sql:23-27`, re-apply the `0010` normalization, then
     `INSERT INTO store_product_fts(store_product_fts) VALUES('rebuild');` (the FTS table is
     created by the migrations; only its content is restored from source tables).
  4. Verification queries: counts per table equal the manifest, `PRAGMA foreign_key_check;`
     returns no rows, `SELECT COUNT(*) FROM d1_migrations;` matches, and
     `SELECT count(*) FROM store_product_fts WHERE store_product_fts MATCH 'عسل';` > 0.
  5. Latest order number matches the source of truth (`SELECT number FROM store_order ORDER BY
created_at DESC LIMIT 1;`).
  6. For a remote rehearsal, create a scratch D1 (`wrangler d1 create beeking-restore-drill`),
     apply each `drizzle/*.sql` in journal order with `wrangler d1 execute … --file`, import the
     same dumps, run the same queries, then `wrangler d1 delete beeking-restore-drill`.
- **Schedule/retention:** monthly export + always before a migration that rewrites data; keep 12
  monthlies and the last 3 pre-migration exports, encrypted at rest on the owner's machine
  (`age`/GPG), never as GitHub artifacts (90-day retention and PII exposure). Record the location
  and the encryption passphrase handling in the runbook (passphrase in the owner's password
  manager, not in the repo).
- **KV media gap:** admin-uploaded product images live in the `MEDIA` KV namespace
  (`wrangler.jsonc:19-24`), not D1. Add a monthly `scripts/kv-backup.mjs` that lists keys
  (`wrangler kv key list --namespace-id <id>`) and fetches each value to the encrypted backup
  directory (catalog images are already in git, so the volume is small). Record the gap
  explicitly if the owner chooses not to do it.
- **Caution:** a running export blocks other database requests (Cloudflare docs); run exports
  off-peak and never during a deploy.

### 3.8 Observability & alerting

#### 3.8.1 Logs

- Add to `wrangler.jsonc`:

```jsonc
"observability": {
  "enabled": true,
  "logs": { "invocation_logs": true, "head_sampling_rate": 1 }
}
```

Workers Logs stores logs for up to 7 days (Cloudflare docs). Verify the Pages config accepts
the `observability` key at implementation (Pages supports a subset of the Workers config); if
it is rejected, enable Observability in the Pages project dashboard and record that in the
runbook. Real-time debugging uses `wrangler pages deployment tail`.

- Keep log hygiene: no secrets, reset URLs, full emails, or order addresses in log lines; the
  email spec already defines structured logging for the outbox.

#### 3.8.2 Error tracking decision

**Decision: Cloudflare-native now — Workers Logs + deployment notifications + a scheduled
external probe. Defer Sentry.**

- Cloudflare Notifications "Pages → Project updates" (all plans) can email on deployment
  success/failure; enable it. Traffic/error-rate notifications are Enterprise-only, so
  Cloudflare cannot alert on 5xx rate on this plan.
- Add `.github/workflows/production-probe.yml`: schedule `*/30 * * * *` + `workflow_dispatch`,
  one job that curls `/api/health` and `/` with `curl -fsS --max-time 10`, and on failure posts
  to Telegram when `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` secrets exist, otherwise opens/updates
  a GitHub issue (`permissions: issues: write`). Alert fatigue guard: only alert when two
  consecutive runs fail; recovery updates/closes the issue.
- Sentry adoption trigger (deferred): adopt `@sentry/sveltekit` on the free tier when a real
  client-side error cannot be diagnosed from Workers Logs alone, or when the owner wants error
  grouping/release regression alerts. CSP delta when adopted: add the Sentry ingest origin to
  `connect-src` (per the DSN) and nothing else; scrub PII in `beforeSend`.
- What to alert on: post-deploy verification failure (workflow red), scheduled probe failures,
  Pages deployment failures, future Paymob webhook processing failures (payments spec),
  email dead letters (email spec §3.9 already enqueues `ops_alert` emails), and rate-limit spikes
  (runbook query below; promote to an alert only if it proves noisy).

#### 3.8.3 Operational queries (runbook)

```sql
-- email health (schema per the email spec)
SELECT type, status, COUNT(*) FROM store_notification GROUP BY 1, 2;
-- rate-limit hot keys in the last hour
SELECT key, SUM(count) AS hits FROM store_rate_limit
WHERE window_start > (unixepoch() * 1000 - 3600000)
GROUP BY key ORDER BY hits DESC LIMIT 20;
-- pending migrations == deployed revision sanity
SELECT COUNT(*) FROM d1_migrations;
```

---

## 4. Migration & rollout

Every phase is a small PR that keeps `pnpm exec vp check`, unit tests, build, and Playwright green
(`docs/decisions.md:1444-1463` sets the same-artifact deploy contract). Order matters where noted.

| Phase | Content                                                                                | Ordering / rollback notes                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0    | Docs truth pass (runbook, architecture, todo) + `docs/decisions.md` ADRs for this spec | Docs only; no runtime impact                                                                                                                             |
| P1    | Shared `escapeHtml` + `renderPasswordResetEmail` extraction (no behavior change)       | Independent; the email spec's reset-into-outbox task builds on it                                                                                        |
| P2    | Auth throttle extension + tests                                                        | Independent; deploy any time                                                                                                                             |
| P3    | `kit.version.name` + health route + health spec update                                 | Must land after P1/P2 only for review bandwidth; independent functionally                                                                                |
| P4    | `verify-production` job + verifier script                                              | Depends on P3 (version) and P5 for header checks; ship with header assertions disabled if P5 not yet merged                                              |
| P5    | Header hook in report-only + root `_headers` + E2E header/console tests                | Flip `CSP_MODE=enforce` in a follow-up commit; Pages env var change is manual                                                                            |
| P6    | Pages env preflight step                                                               | Needs token Pages Read scope (manual verification)                                                                                                       |
| P7    | Supply chain: audit gate, Dependabot, CodeQL, SHA pinning                              | Pin PR can land last; Dependabot starts PRs immediately                                                                                                  |
| P8    | Backup script + drill + KV backup decision                                             | Independent                                                                                                                                              |
| P9    | Observability config + Notifications + probe workflow                                  | Probe depends on health route (P3)                                                                                                                       |
| P10   | Verification config + backfill migration + UI + tests                                  | Migration ships before the gating code (CI order guarantees migration precedes deploy on the same push; if gating is a later push, backfill lands first) |
| P11   | Admin bootstrap verified precondition + reset gating                                   | Depends on P10 backfill being live                                                                                                                       |

Manual GitHub/Cloudflare steps (not code): confirm `production` environment reviewers; add
`PRODUCTION_URL` repo variable (optional); confirm/extend the Cloudflare token scope for Pages
Read; enable Dependabot alerts + secret scanning/push protection; disable CodeQL default setup if
enabled; enable Pages "Project updates" notifications; create the Telegram bot secrets (optional);
choose the encrypted backup location; add `CSP_MODE` as a Pages production env var (starts
`report-only`).

---

## 5. Testing strategy

**Unit (Vitest, server project `src/**/*.spec.ts`):**

- `src/lib/html.spec.ts` — all five entities, idempotence, empty string.
- `src/lib/server/auth-email.spec.ts` — escaping of name/email, attribute escaping of URL,
  plain-text integrity.
- `src/lib/server/rate-limit.spec.ts` — new windows/maxes, account key normalization, fallback.
- `src/lib/ci/pages-env.spec.ts` — secret_text/plaintext/missing fixtures; no values in output.
- `src/lib/ci/verify-production.spec.ts` — retry/backoff with an injected fake fetch; version
  mismatch fails; header assertions.
- `src/lib/ci/d1-backup.spec.ts` — FTS/shadow tables excluded from the table list; manifest
  shape.
- `src/lib/server/security-headers.spec.ts` — `buildSecurityHeaders` values, nonce is present in
  `script-src`, report-only vs enforce header name selection, no `unsafe-inline` for scripts.

**E2E (Playwright, `tests/`):**

- `tests/health.e2e.ts` updated: `{ok:true, version:string}` + `cache-control: no-store`.
- `tests/security-headers.e2e.ts`: assert headers on `/`, `/api/health`, a font URL
  (`/fonts/cairo-arabic-wght-normal.woff2`), and that the CSP in report-only mode is the
  `…-Report-Only` name.
- CSP console watch: on `/`, a product page, `/checkout`, and `/admin` (behind the admin fixture),
  collect `page.on("console")` messages and fail on `Content Security Policy` violations; this is
  the gate for flipping report-only → enforce.
- `tests/auth-throttle.e2e.ts`: 429 + `Retry-After` for reset and verification endpoints;
  `clearRateLimitRows` between cases.
- Verification flow E2E (per §3.4.4) using the isolated E2E D1 token.
- CI dry-run of the verifier: `node scripts/ci/verify-production.mjs` against
  `wrangler pages dev` output locally (with `EXPECTED_SHA=dev`) before relying on it in CI.

**CI migration replay:** the existing replay (`ci.yml:42-46`) covers the new
`email_verified` backfill migration; add an assertion after replay that the `user` table has the
column and the migration is recorded.

---

## 6. Security review checklist

**Headers/CSP**

- Nonce is generated per response from CSPRNG, never reused/logged, and injected only into the
  final HTML of that response.
- No `'unsafe-eval'`, no `'unsafe-inline'` in `script-src`; no wildcard origins.
- `style-src` keeps `'unsafe-inline'` **without** nonce/hash (CSP3 semantics); refactor list of
  inline styles is tracked.
- Report-only is temporary; the enforce flip is a reviewed change after zero-violation E2E runs.
- Nonce pages are `private`/`no-store`; verify no CDN cache rule captures HTML.
- `event.setHeaders` values are constants + nonce only (no user input → no header injection).
- JSON-LD content is `<`-escaped (`Seo.svelte:31-33`) before nonce injection; the nonce does not
  change that.
- `transformPageChunk` cannot be reached on non-HTML responses; confirm in tests.

**Auth throttling**

- Account keys are hashed; `store_rate_limit` never stores raw emails.
- Body cloning happens before Better Auth reads it; parse failures degrade to IP-only.
- Per-account windows cannot lock a victim out permanently (bounded window, no hard lock).
- GET throttling is scoped to the two named paths, not all GETs.
- 429 body and timing do not reveal account existence; `Retry-After` is a plain number.
- `cf-connecting-ip` trust note is documented so no one switches to `X-Forwarded-For`.

**Escaping**

- One helper, used at render time; no double-escaping; URL escaped in attribute context.
- No `{@html}` on user data anywhere in the email path.

**Verification**

- Backfill runs before gating; post-migration query shows zero unverified legacy rows.
- `promoteAdminByEmail` returns false for unverified users even when the email matches.
- Reset/verification responses stay generic for unknown and unverified accounts.
- Resend is rate-limited; tokens expire (1 h) and are single-use (Better Auth).
- Guest checkout and unverified sign-in are not blocked.

**CI/deploy**

- Verifier fails on version mismatch, non-200, missing headers; retries bounded; output has no
  secrets/PII.
- Preflight prints key names only; plaintext values never echo; runs before migrations.
- Action SHAs resolved from the real tags; token scope for Pages Read verified; no `@main`.
- Audit gate fails on high/critical prod advisories; overrides are recorded in
  `pnpm-workspace.yaml`.

**Backup**

- Dumps contain PII → encrypted, off-repo, access documented; manifest hashes verified during the
  drill; Time Travel bookmark recorded before any restore.
- FTS rebuild is exercised in the drill; `PRAGMA foreign_key_check` is clean.

**Observability**

- No secret/token/URL/email content in log lines; sampling rate understood; notification
  destinations (email/Telegram) are owner-controlled; probe secrets are Actions secrets, never
  repo variables.

---

## 7. Open decisions

1. **Headers implementation point.** Recommendation: custom CSP in `handle` +
   `transformPageChunk` nonce, because `kit.csp` cannot nonce component-rendered JSON-LD
   (§3.1.1). Rejected: `kit.csp` alone (breaks structured data), `_headers` alone (cannot cover
   SSR responses).
2. **Sentry vs Workers observability.** Recommendation: Workers Logs + Pages notifications +
   scheduled probe now; Sentry later on the documented trigger (§3.8.2). Rejected now: adding a
   third-party processor, CSP entries, and a dependency before error volume justifies it.
3. **Action pinning policy.** Recommendation: pin **all** actions (including GitHub-owned) to
   full SHAs with version comments; Dependabot maintains them. Rejected: major-tag pinning
   (`@v4`), which is mutable.
4. **HSTS timing.** Recommendation: no app-set HSTS until a custom domain exists; then enable at
   the Cloudflare zone (SSL/TLS → Edge Certificates → HSTS), starting `max-age=86400`, bump to
   6 months + `includeSubDomains` after a stable week, and `preload` only after months of
   stability (preload is hard to reverse). If the owner wants in-app HSTS first, set
   `max-age=86400` only — never preload.
5. **Verification-required actions.** Recommendation: admin bootstrap + email change require
   verification; password reset issuance requires verification **after** the existing-user
   backfill; sign-in, checkout, and account browsing never require it (§3.4.2).
6. **CSP report-only duration.** Recommendation: one full deploy cycle plus the E2E console-watch
   gate, then enforce; do not leave report-only permanently.
7. **Paymob CSP shape.** Redirect mode needs no change; iframe mode adds only
   `frame-src https://accept.paymob.com` (origin from the payments spec). Confirm against Paymob
   onboarding docs at implementation; never add `default-src` allowances for a payment provider.
8. **Probe cadence/channel.** Recommendation: every 30 minutes, two consecutive failures before
   alerting; Telegram if the owner supplies bot secrets, otherwise GitHub issue (email
   notification). Revisit if GitHub Actions minutes or alert noise become a problem.

---

## 8. Ordered task breakdown

Sizes are implementation estimates (half-days). "Manual" means a dashboard/settings step.

| #   | Task                                                                                          | Size  | Deps              | Code/Manual   |
| --- | --------------------------------------------------------------------------------------------- | ----- | ----------------- | ------------- |
| 0   | Runbook/architecture/todo truth pass + ADRs for this spec                                     | 0.5 d | —                 | Code (docs)   |
| 1   | `src/lib/html.ts` shared `escapeHtml` + specs; replace private copy in `email.ts`             | 0.5 d | —                 | Code          |
| 2   | Extract `renderPasswordResetEmail` from `auth.ts` + escaping specs                            | 0.5 d | 1                 | Code          |
| 3   | Extend `AUTH_RATE_LIMITS`/hook map: per-IP + per-account, new paths, GET paths, `Retry-After` | 1 d   | —                 | Code          |
| 4   | Auth throttle unit + e2e tests                                                                | 0.5 d | 3                 | Code          |
| 5   | `kit.version.name` (GITHUB_SHA) + health route version/no-store + update health spec          | 0.5 d | —                 | Code          |
| 6   | `verify-production` job + `src/lib/ci/verify-production.ts` + unit specs + local dry run      | 1 d   | 5                 | Code          |
| 7   | Pages env preflight script + spec + wire into `migrate-production`                            | 1 d   | —                 | Code          |
| 8   | Confirm/extend `CLOUDFLARE_API_TOKEN` scope for Pages Read                                    | 0.5 d | —                 | Manual        |
| 9   | Security-header module + hook nonce injection (report-only) + root `_headers`                 | 1.5 d | —                 | Code          |
| 10  | Header/CSP unit + e2e (incl. console-violation watch); flip `CSP_MODE=enforce`                | 1 d   | 9                 | Code + Manual |
| 11  | `pnpm audit --prod --audit-level=high` in `test` job                                          | 0.5 d | —                 | Code          |
| 12  | `.github/dependabot.yml` (npm + actions) and Dependabot enablement                            | 0.5 d | —                 | Code + Manual |
| 13  | CodeQL workflow (JS/TS, `security-extended`, build-mode none)                                 | 0.5 d | —                 | Code          |
| 14  | SHA-pin all actions in `ci.yml` (+ CodeQL workflow)                                           | 0.5 d | 10-13             | Code          |
| 15  | `scripts/d1-backup.mjs` + manifest/spec + KV backup decision                                  | 1 d   | —                 | Code          |
| 16  | Restore drill runbook + execute one local drill; encrypt/store baseline                       | 1 d   | 15                | Code + Manual |
| 17  | `observability` config (or dashboard) + Pages notifications + backup runbook section          | 0.5 d | —                 | Code + Manual |
| 18  | Scheduled `production-probe` workflow (Telegram/GitHub issue on 2× failure)                   | 0.5 d | 5                 | Code + Manual |
| 19  | Enable Better Auth email verification + resend/verify UI + tests                              | 2 d   | 1,2,3             | Code          |
| 20  | `email_verified` backfill migration + replay assertion                                        | 0.5 d | 19 (deploy first) | Code          |
| 21  | Require verified email in `promoteAdminByEmail` + reset gating + tests                        | 0.5 d | 20                | Code          |
| 22  | Secret scanning/push protection toggle; `PRODUCTION_URL` var; Telegram secrets                | 0.5 d | —                 | Manual        |
| 23  | (Deferred) Sentry evaluation against the trigger in §7.2                                      | —     | 17                | Code          |

**Parallelization:** 1→2, 3→4, 5→6, 7→8, 9→10 share no files except `ci.yml` (tasks 6, 7, 11-14
touch it; land sequentially). 15-18 are independent of the auth/header work. 19-21 are one
sequence gated by the email spec's outbox task. 0 can run first or last but must precede the
final quality gate.

**External dependencies (not tasks):** owner decision on Telegram alerting; encrypted backup
storage + passphrase handling; Paymob embed mode confirmation (payments spec); Resend/domain
work (email spec) for verification emails to actually deliver.
