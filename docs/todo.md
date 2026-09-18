# Program Task Board — Commerce Platform

**Project:** beeking-etman-website (SvelteKit 2 + Svelte 5 runes, Cloudflare Pages + D1 + KV, Drizzle, Better Auth)
**Date:** 2026-09-13; amended 2026-09-17 (AgDR-0001, AgDR-0002).
**Status:** M0 not started; all phases below not started. Baseline verified 2026-09-13: 191 products / 0 orders / 0 notifications in production D1.
**Roadmap:** [Commerce Platform Program Roadmap](superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md) — authoritative for phase order, migration numbers, file ownership, and sequencing. Companion specs: EM, MS, DI, OPS, COM, I18N (see phase headers). PAY is deferred to phase 2.
**Phase order:** M0 production correctness → M1 manual settlement + launch catalog → M2 commerce core (COM W0) → M3 commerce parity (COM W1/W2) → M4 admin parity → M5 reliability → M6 performance & cost; Phase 6 polish is a spec-gated backlog.

**How to use this board.** One phase in flight; a phase starts only after its predecessor's exit
gate is recorded. Per task: read the cited spec, write a plan in `docs/superpowers/plans/`,
implement test-first, run the quality gate (`vp check`, `vp test --run`, `vp run test:e2e` where
available, migration replay), append an ADR, and commit conventional (`type(scope): subject`).
Migration numbers 0018–0023 are frozen; new migrations take the next free tag from
`drizzle/meta/_journal.json` — never renumber or reuse. Never push to `main` without the owner's
say-so. Move a task to Archive only after its evidence is recorded. Specs carry full descriptions;
this board carries IDs, status, and essential dependency notes.

## Frozen migration allocation (roadmap §3.1)

| #      | File                                             | Owner      | Constraint                                                                                                                                               |
| ------ | ------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0018   | `0018_email_delivery.sql`                        | EM         | First. Outbox rebuild (`attempt_count`, `next_attempt_at`, `last_error`, `provider_message_id`, `locked_at`) + indexes.                                  |
| 0019   | `0019_settlement.sql`                            | MS         | After 0018. Order/payment schema, settlement events, hold deadline, status vocabulary, triggers. Number frozen; content reshaped 2026-09-17 (AgDR-0001). |
| 0020   | `0020_email_verified_backfill.sql`               | OPS        | After 0018. Backfill only; requires the verification deploy already live (OPS-19).                                                                       |
| 0021   | `0021_order_status_default.sql`                  | DI (D1)    | Only if settlement is not yet applied; otherwise folded into MS's 0019 rebuild (C2). Never two `store_order` rebuilds in one release window.             |
| 0022   | `0022_inventory_integrity.sql`                   | DI (D2)    | Independent of settlement.                                                                                                                               |
| 0023   | `0023_drop_legacy_product_columns.sql`           | DI (D4)    | Drain-gated; only after old-instance drain evidence (OPS health SHA + canary).                                                                           |
| staged | `drizzle/staged/after_drain_status_backfill.sql` | DI (D3)    | Pre-settlement only: `paid` → `placed` backfill. Superseded once 0019 lands; never run after settlement.                                                 |
| —      | COM / I18N migrations                            | COM / I18N | No numbers reserved. Each COM sub-spec takes the next free tag at implementation time; I18N has no migrations.                                           |

Rules: never reuse a tag; never renumber after a file lands on `main`; confirm the next free index
at generation time; hand-review generated SQL (`store_coupon`, `store_return`, `store_review` are
not in `schema.ts` and may be proposed for drop — never commit that blindly).

## M0 — Production correctness

**Goal:** Make the live site safe and honest before any new feature.
**Exit gate:** No email path marks a row `sent` without a provider message id; CSP enforced;
reset/verification throttled; deploy impossible unless `verify-production` confirms SHA + health +
headers; secret preflight runs before migrations; inventory in grams with named CHECKs; no known
stale doc claims.
**Gate commands:** `vp check`; `vp test --run`; `vp run test:e2e`; migration replay (0018, 0020);
`verify-production` green; restore drill evidence recorded.

### EM — email delivery pipeline (spec §9)

- [x] EM-1 — Schema + migration 0018 (outbox rebuild, columns, indexes, CHECK), schema mirror, replay spec (EM §9.1)
- [ ] EM-2 — Provider adapter (`email-provider.ts`, Resend fetch impl, result mapping) + unit specs (EM §9.2; needs D01)
- [ ] EM-3 — `outbox.ts` enqueue + `outbox-drain.ts` claim/lease/backoff/dead/park + libsql unit specs (EM §9.3; after 0018)
- [ ] EM-4 — `workers/email-sender/` scaffold: wrangler cron (email + settlement entries), health endpoint, `scheduled()` drain + `runSettlementJobs` hook, tsconfig, `test:worker` (EM §9.4)
- [ ] EM-5 — App rewiring: `sendOrderConfirmation`/`sendOrderStatusUpdate` enqueue-only; delete `flushOutbox`; spec updates; temporary flag shim (EM §9.5)
- [ ] EM-6 — Password reset through the outbox in `auth.ts` + test (EM §9.6; after OPS-2)
- [ ] EM-7 — Env validation (`EMAIL_FROM` fail, remove stale warnings) + `.dev.vars.example`/runbook (EM §9.7)
- [ ] EM-8 — CI worker typecheck, `test:worker`, worker deploy job, token permission check (EM §9.8; `ci.yml` edits serialized with OPS)
- [ ] EM-9 — `/admin/emails` + resend/retry-all + audit + E2E (EM §9.9)
- [ ] EM-10 — Alerting (`ops_alert` thresholds/throttle) + prune job + health check (EM §9.10)
- [ ] EM-11 — E2E: checkout enqueue assertion, admin resend flow (EM §9.11)
- [ ] EM-12 — Rollout: migration → DRY_RUN worker → app → provider enable; runbook + todo correction; ADR (EM §9.12; gated by business blockers)

### OPS — ops & security hardening (spec §8)

- [ ] OPS-0 — Runbook/architecture/todo truth pass + ADRs for this spec (OPS §8.0; may run first or last, must precede the M0 gate)
- [ ] OPS-1 — `src/lib/html.ts` shared `escapeHtml` + specs; replace private copy in `email.ts` (OPS §8.1)
- [ ] OPS-2 — Extract `renderPasswordResetEmail` from `auth.ts` + escaping specs (OPS §8.2; before EM-6)
- [ ] OPS-3 — Extend `AUTH_RATE_LIMITS`/hook map: per-IP + per-account, new paths, GET paths, `Retry-After` (OPS §8.3)
- [ ] OPS-4 — Auth throttle unit + e2e tests (OPS §8.4)
- [ ] OPS-5 — `kit.version.name` (`GITHUB_SHA`) + health route version/`no-store` + spec update (OPS §8.5)
- [ ] OPS-6 — `verify-production` job + `src/lib/ci/verify-production.ts` + unit specs + local dry run (OPS §8.6)
- [ ] OPS-7 — Pages env preflight script + spec + wire into `migrate-production` (OPS §8.7)
- [ ] OPS-8 — Confirm/extend `CLOUDFLARE_API_TOKEN` scope for Pages Read (OPS §8.8; manual)
- [ ] OPS-9 — Security-header module + hook nonce injection (report-only) + root `_headers` (OPS §8.9)
- [ ] OPS-10 — Header/CSP unit + e2e console-violation watch; flip `CSP_MODE=enforce` (OPS §8.10)
- [ ] OPS-11 — `pnpm audit --prod --audit-level=high` in the `test` job (OPS §8.11)
- [ ] OPS-12 — `.github/dependabot.yml` (npm + actions) + Dependabot enablement (OPS §8.12)
- [ ] OPS-13 — CodeQL workflow (JS/TS, `security-extended`, build-mode none) (OPS §8.13)
- [ ] OPS-14 — SHA-pin all actions in `ci.yml` + CodeQL workflow (OPS §8.14; after OPS-10–13)
- [ ] OPS-15 — `scripts/d1-backup.mjs` + manifest/spec + KV backup decision (OPS §8.15)
- [ ] OPS-16 — Restore drill runbook + one local drill; encrypt/store baseline (OPS §8.16; needs backup storage blocker)
- [ ] OPS-17 — `observability` config + Pages notifications + backup runbook section (OPS §8.17)
- [ ] OPS-18 — Scheduled `production-probe` workflow (Telegram/GitHub issue on 2× failure) (OPS §8.18)
- [ ] OPS-19 — Enable Better Auth email verification + resend/verify UI + tests (OPS §8.19; after EM outbox live)
- [ ] OPS-20 — Migration 0020 `email_verified` backfill + replay assertion (OPS §8.20; requires OPS-19 deploy live)
- [ ] OPS-21 — Require verified email in `promoteAdminByEmail` + reset gating + tests (OPS §8.21; after OPS-20)
- [ ] OPS-22 — Secret scanning/push protection toggle; `PRODUCTION_URL` var; Telegram secrets (OPS §8.22; manual)

### DI — data integrity, D2 + D4 prep (spec §9)

- [ ] DI-2 — `src/lib/units.ts` + specs (grams/kg conversion, formatting, caps) (DI §9.2)
- [ ] DI-5 — D2 (0022): inventory schema + `check()` declarations; hand-edit conversion/backfill/recon-guard/triggers; fractional-kg replay + guard mutation test (DI §9.5)
- [ ] DI-6 — Inventory service updates in grams, typed transfer payloads, `completeTransfer` single-transaction, error mapping (DI §9.6)
- [ ] DI-7 — Admin inventory UI/i18n/test-id updates (reports, alerts, transfers) (DI §9.7)
- [ ] DI-8 — Seed/tooling: exporter cleanup prepared, `inventory.spec.ts` DDL, no batch seed rows (DI §9.8)
- [ ] DI-9 — Constraint test suite `src/lib/server/db/constraints.spec.ts` (every CHECK/trigger failure path) (DI §9.9)
- [ ] DI-10 — Observability: constraint mapping helper, reconciliation queries R1–R3, log conventions (DI §9.10)
- [ ] DI-11 — E2E additions: checkout → safe status; inventory pages smoke; transfer validation (DI §9.11)
- [ ] DI-12 — Drain evidence runbook + production runbook section (health-SHA revision check, canary checksum, export/bookmark) (DI §9.12; uses OPS-5 once landed)

**M0 sequencing.** EM-1 → EM-3 → {EM-4, EM-5, EM-6, EM-9}; OPS-1→2 precede EM-6; OPS-19→20→21
after EM's outbox is live (C3); DI D2 runs independently; `ci.yml` edits (EM-8, OPS-6/7/11–14)
land sequentially.

## M1 — Manual settlement + launch catalog

**Goal:** Record COD and manual transfer orders, verify payment by hand, hold stock with a deadline,
and retire the blend studio so the catalog matches the shop's workflow (AgDR-0001, AgDR-0002).
**Exit gate:** COD and transfer journeys complete; no customer path reaches `paid`; admin review
queue + audit trail live; hold expiry releases stock exactly once; one full refund recorded;
`/blends` redirects; ready-made blends purchasable; coverage reporting exists with a recorded floor.
**Gate commands:** `vp check`; `vp test --run`; migration replay (0019; trigger + default tests);
e2e suite (`E2E_USE_BUILD=1`); runbook go-live checklist in the PR; `verify-production`.

### SET — order lifecycle & manual settlement (MS §9)

- [x] SET-1 — Approve spec; AgDR-0001 lands; roadmap/todo/decisions updates (MS §9 SET-1) — GH #4 (docs PR #16)
- [x] SET-2 — Migration `0019_settlement` + schema defaults + snapshot + replay spec + DDL copies (MS §9 SET-2; after 0018) — GH #5
- [ ] SET-3 — Settlement lifecycle core (`settlement/lifecycle.ts`, `types.ts`) + order/payment vocabulary rework across admin/i18n/email/export consumers; the shared types become the single source for the payment-event guard vocabulary (MS §9 SET-3) — GH #6
- [ ] SET-4 — Checkout method selection (COD, InstaPay, wallet) + transfer instructions + claim flow (MS §9 SET-4) — GH #7
- [ ] SET-5 — Success and order pages: order number, amount, claim form, WhatsApp CTA (MS §9 SET-5) — GH #8
- [ ] SET-6 — Admin review queue, settlement panel, audited actions (verify, reject, refund, extend hold) (MS §9 SET-6) — GH #9
- [ ] SET-7 — `runSettlementJobs` hold expiry + wire into EM's Cron worker or its stub (MS §9 SET-7; after EM-4 or its stub) — GH #10
- [ ] SET-8 — Settlement email triggers + copy (MS §9 SET-8) — GH #11
- [ ] SET-9 — E2E journeys: COD, transfer claim → verify, hold expiry, blend retirement (MS §9 SET-9) — GH #14
- [ ] SET-10 — Coverage reporting + threshold for the settlement modules (MS §9 SET-10) — GH #14
- [ ] SET-11 — Security review pass + fixes (claims untrusted, rate limits, PII masking, IDOR) (MS §9 SET-11) — GH #15
- [ ] SET-12 — Docs truth pass: architecture, runbook, data model, go-live checklist (MS §9 SET-12) — GH #15

### BLEND — retire the studio, sell ready-made blends (AgDR-0002)

- [ ] BLEND-1 — Remove the studio: `/blends` routes, Phaser lab, blend lib, cart item kind, order expansion, navigation, i18n, tests (AgDR-0002) — GH #12
- [ ] BLEND-2 — 301 `/blends` → blends category; sitemap update; SEO check (AgDR-0002) — GH #12
- [ ] BLEND-3 — Ready-made blend products: weight variants, jar stock, ingredient text in descriptions, photos (AgDR-0002; owner data) — GH #13
- [ ] BLEND-4 — Storefront + admin verification for blend products (AgDR-0002; SET-9 carries the purchase e2e) — GH #13

### DI — D1 fold + shared vocabulary (spec §9)

- [x] DI-1 — ADR + pre-flight checklist (production rows re-checked, boundaries acknowledged, frozen journal confirmed) (DI §9.1; gates D1) — evidence in SET-2 (#5): production baseline 0 orders / 0 order items (`docs/todo.md` archive, 2026-09-13); the journal ended at `0018_email_delivery` when 0019 was generated (the settlement slot was frozen by the roadmap); D1 content folded into 0019
- [x] DI-3 — D1: capture live `store_order` triggers, edit default + `check()`, fold into 0019 (or ship 0021 if settlement is not applied), sync 8 fixture DDLs (DI §9.3; C2) — folded into 0019 by SET-2 (#5)
- [ ] DI-4 — Order error mapping + shared `stock_version` vocabulary; also closes the carried corrupt-status-logging and shared `STATUS_ORDER` items, and maps the 0019 aborts (`CANCELLED_IS_TERMINAL`, `INVALID_PAYMENT_EVENT_VALUES`) (DI §9.4)

**M1 notes.** Settlement triggers call the same `enqueueEmail`; OPS-21 output is consumed where
settlement flows touch account state; the settlement env variables extend OPS-7 preflight. The
deferred PAY task series moves to the Phase 2 backlog. Carried test gap: checkout-form
page-component unit coverage (SET-9 covers the journey end-to-end).

## M2 — Commerce core (COM W0)

**Goal:** Ship order-snapshot primitives that must exist before real orders accumulate; no money movement.
**Exit gate:** Archived products invisible everywhere; SKU conflicts are typed admin errors;
checkout shipping estimate matches the stored snapshot; tax math integer-exact; Cairo day
boundaries correct across DST; COD stays a checkout payment method, never a shipping method (MS §3.4).
**Gate commands:** `vp check`; `vp test --run`; `vp run test:e2e`; migration replay; COM §4.2 W0 exit checklist.

- [ ] COM-W0-1 — Variant `cost_price`/`sale_price`/`weight_grams` columns + `sku` partial unique index + migration + DDL copies (COM §7 3h-1)
- [ ] COM-W0-2 — `published` enforcement in listing/featured/search/sitemap + admin publish/archive toggle + tests (COM §7 3h-2)
- [ ] COM-W0-3 — Extend product/variant admin schemas + `ProductForm.svelte` + conflict mapping + i18n; also closes the carried slug-issue exact-match item (COM §7 3h-3)
- [ ] COM-W0-4 — Seed/backfill (weights, costs) + e2e (archived hidden, SKU conflict) + docs/ADR (COM §7 3h-4)
- [ ] COM-W0-5 — Shipping v2 tables + seed parity (7 zones/standard rates) + snapshot columns + DDL copies (COM §7 3b-1)
- [ ] COM-W0-6 — `resolveShipping` service + weight computation + estimate resolution + unit specs (COM §7 3b-2)
- [ ] COM-W0-7 — Checkout load/submit integration (method select, estimates) + cart total wiring + i18n (COM §7 3b-3)
- [ ] COM-W0-8 — `/admin/shipping` rate editor + audit + quote preview (COM §7 3b-4)
- [ ] COM-W0-9 — `ShipmentProvider` interface + manual adapter + docs/ADR/e2e (COM §7 3b-5)
- [ ] COM-W0-10 — `store_tax_setting` + order/item snapshot columns + migration + DDL copies (COM §7 3c-1; `active = 0` until VAT confirmed)
- [ ] COM-W0-11 — Integer inclusive tax math (rounding) + invoice render + unit specs (COM §7 3c-2)
- [ ] COM-W0-12 — `/admin/settings/tax` + audit + monthly summary query/export (COM §7 3c-3)
- [ ] COM-W0-13 — Checkout/invoice e2e + docs/ADR (COM §7 3c-4)
- [ ] COM-W0-14 — Cairo-time helper + dashboard/report SQL range filters + DST tests (COM §7 3g-1)

## M3 — Commerce parity (COM W1/W2)

**Goal:** Reach WooCommerce-level capability once the money layer is trusted.
**Exit gate:** Coupon apply/cap/exhausted/cancel-release e2e green; manual order reaches
`pending_confirmation` and is marked paid only through the guarded path; every order/customer edit
writes before/after audit rows; reviews gated by verified purchase + moderation; CSV dry-run makes
zero writes and re-import is idempotent by SKU; partial return with damaged vs good quantities
exercises refund + restock correctly.
**Gate commands:** `vp check`; `vp test --run`; `vp run test:e2e`; per-area migration replays;
COM §7 area checklists.

### W1 — with/after settlement schema (after 0019; 3h done)

- [ ] COM-W1-1 — `store_coupon*` rebuild + redemption + snapshot columns + migration + DDL copies (COM §7 3a-1)
- [ ] COM-W1-2 — Coupon resolve/validate/allocate service + typed errors + unit specs (COM §7 3a-2)
- [ ] COM-W1-3 — Coupon preview endpoint + authoritative `createOrder` integration + idempotent redemption + i18n (COM §7 3a-3)
- [ ] COM-W1-4 — `/admin/coupons` CRUD + redemption report/CSV + audit (COM §7 3a-4)
- [ ] COM-W1-5 — Coupon e2e (apply, cap, exhausted, cancel release) + docs/ADR (COM §7 3a-5)
- [ ] COM-W1-6 — Manual order creation + `source`/`created_by` + payment-method action (COD included) + audit (COM §7 3g-4)
- [ ] COM-W1-7 — Order/customer edit + before/after audit + notes table + `AuditTargetType` extension (COM §7 3g-3)
- [ ] COM-W1-8 — Review + rating tables rebuild, aggregate triggers + migration + DDL copies (COM §7 3e-1)
- [ ] COM-W1-9 — Review submission + verified-buyer check + abuse controls + rate limits + i18n (COM §7 3e-2)
- [ ] COM-W1-10 — Product-page display + paged list + `Seo.svelte` aggregateRating + e2e (COM §7 3e-3)
- [ ] COM-W1-11 — `/admin/reviews` moderation queue + bulk actions + approval email + audit (COM §7 3e-4)
- [ ] COM-W1-12 — Review tests (trigger math, eligibility, spam) + docs/ADR (COM §7 3e-5)
- [ ] COM-W1-13 — CSV import/export + `store_import_batch` + dry-run + injection guard + e2e (COM §7 3g-5; after 3h)

### W2 — after production refunds verified

- [ ] COM-W2-1 — Return/return_item/evidence schema rebuild + migration + `returns/` media prefix + DDL copies (COM §7 3d-1)
- [ ] COM-W2-2 — Customer return request flow (eligibility, quantities, evidence upload, rate limit, status page) (COM §7 3d-2)
- [ ] COM-W2-3 — Admin return queue/detail + guarded workflow + refund allocation + restock via 3g-2 (COM §7 3d-3)
- [ ] COM-W2-4 — Return notifications + order-detail panel + evidence serving policy (COM §7 3d-4)
- [ ] COM-W2-5 — Return DB workflow tests + e2e (partial, damaged vs good, refund-failure retry) + docs/ADR (COM §7 3d-5)
- [ ] COM-W2-6 — Notification matrix constants + renderer checklist + key/type mapping (COM §7 3f-1)
- [ ] COM-W2-7 — Wire each area's events + ops-alert boundaries (COM §7 3f-2)
- [ ] COM-W2-8 — Delivery-evidence e2e (enqueue assertions per event) + docs (COM §7 3f-3)
- [ ] COM-W2-9 — Stock adjustments service + `/admin/inventory/adjustments` + movement reason CHECK (COM §7 3g-2; may land earlier with DI/COM W0)

**M3 boundaries.** Returns never precede working refunds; reason codes are COM-owned and read by the settlement refund and audit surfaces.

## M4 — Admin parity

**Goal:** No fragmented admin surface, no unaudited mutation, no missing operational view left by M0–M3.
**Exit gate:** Audit coverage query returns no unaudited admin mutation route; each admin area has
an e2e happy path + at least one guard test; admin i18n AR/EN key parity holds.
**Gate commands:** `vp check`; `vp test --run`; admin e2e suite; audit coverage query recorded in the close-out PR.

- [ ] M4-1 — Enumerate every admin mutation route; prove each writes `logAdminAction` with target type + before/after (Roadmap §4.5)
- [ ] M4-2 — List/filter/export parity + e2e happy path + guard test per area: orders, payments, customers, inventory, emails, coupons, reviews, returns; closes the carried admin-guard/KPI e2e item (Roadmap §4.5)
- [ ] M4-3 — Close slipped COM §7 rows (order/customer edits, inventory adjustments) by executing their specs, never by inventing scope (Roadmap §4.5)
- [ ] M4-4 — Dashboard aggregates reflect collected vs simulated money, Cairo buckets, reliability counters (Roadmap §4.5)

Carried admin fixes (no spec task yet; old board items):

- [ ] M4-5 — Vanished-product image upload returns `fail(404)` instead of a false success
- [ ] M4-6 — Pasted image URLs restricted to `https:`
- [ ] M4-7 — `deleteVariant` scoped by `productId`
- [ ] M4-8 — `lowStock` query `LIMIT`
- [ ] M4-9 — Move the third copy of `retryOnBusy` into `$lib/server/sqlite`
- [ ] M4-10 — Surface form failure messages inside dialog content (house-wide)

## M5 — Reliability

**Goal:** Failures surface and recover without a developer at a keyboard.
**Exit gate:** A deliberate failure produces an alert within two cycles and a recovery alert after
fix; restore drill evidence stored; notification matrix has zero unowned rows; runbook covers
worker deploy/rollback, secret rotation, backup/restore, incident triage.
**Gate commands:** `vp check`; `vp test --run`; drill evidence file; alert fire/recover transcript.

- [ ] M5-1 — Notification matrix verification: every event enqueues through EM's outbox; zero unowned rows (Roadmap §4.6; COM-3f-2/3)
- [ ] M5-2 — Dead-letter operations: `/admin/emails` resend/retry-all with audit; dead rows alerted; 30-day prune verified (Roadmap §4.6; EM-9/10)
- [ ] M5-3 — Settlement monitoring: expiry counts + review-queue counters logged; unreviewed claims surfaced; alert thresholds documented (Roadmap §4.6; SET-7/SET-6)
- [ ] M5-4 — Backup/restore rehearsal: local drill, encrypted off-repo baseline, manifest hashes, Time Travel bookmark (Roadmap §4.6; OPS-16)
- [ ] M5-5 — Alert drill: two-consecutive-failure fire + recovery proof (Roadmap §4.6; OPS-18)
- [ ] M5-6 — Runbook close-out: worker deploy/rollback, secret rotation, backup/restore, incident triage (Roadmap §4.6)
- [ ] M5-7 — Carried: KV/media free-tier usage alert (old board item; no spec task yet)

## M6 — Performance & cost (I18N)

**Goal:** Public pages become cacheable and localizable on the free tier; polish stays spec-gated.
**Exit gate:** ≥70% page-cache hit share after warm-up; 60–85% D1 read reduction on public paths at
flat traffic; 404/redirect-loop rates at or below baseline; catalog-edit freshness ≤5 min;
scheduled canary green; legacy URLs 301 to the correct locale; private routes and cookie scopes
unchanged.
**Gate commands:** `vp check`; `vp test --run`; `vp run test:e2e` (i18n suite); canary workflow;
before/after D1 metrics recorded in the close-out PR.

- [ ] I18N-1 — Baseline metrics snapshot + `src/lib/i18n/routes.ts` + `src/params/lang.ts` + unit specs (I18N §9.1)
- [ ] I18N-2 — Move public routes under `[lang=lang]`; public layout without cookies; root branch; delete unused `getCategories`; `<html lang>` transform (I18N §9.2)
- [ ] I18N-3 — Legacy 301 redirect hook + map + specs (I18N §9.3)
- [ ] I18N-4 — Localize URL builders + Header/Footer/Hero/CartDrawer/error/account/success links + switcher link (I18N §9.4)
- [ ] I18N-5 — SEO: alternates/canonical/`og:locale`, localized JSON-LD, sitemap locale × urls (I18N §9.5)
- [ ] I18N-6 — E2E migration: helper + updated specs + `tests/i18n-routing.e2e.ts` (I18N §9.6; after I18N-2–5)
- [ ] I18N-7 — Anonymous split completion: client session enhancement in `Header` + public-layout no-session test (I18N §9.7)
- [ ] I18N-8 — `page-cache.ts` + hook wiring + public `Cache-Control` + `X-Page-Cache` + unit specs (I18N §9.8; after I18N-7)
- [ ] I18N-9 — Admin purge hooks (products/categories) + unit/E2E verification within TTL (I18N §9.9)
- [ ] I18N-10 — Prerender `[lang]/about` + build assertion (I18N §9.10)
- [ ] I18N-11 — Observability after-metrics + docs (ADR, architecture routing/cost, todo statuses) (I18N §9.11)
- [ ] I18N-12 — (Conditional) custom domain: `PUBLIC_SITE_URL`, Search Console, Cache Rules + purge-by-URL (I18N §9.12; needs custom-domain decision)

**M6 ordering.** Default after M5; pull earlier only on measured free-tier pressure or a forced SEO/campaign date (C7). Private routes stay unprefixed (I18N §8.4).

## Gated & backlog

**Wall-clock gated (post-drain evidence; not launch-blocking, R4):**

- [ ] DI-13 — Catalog drop: after evidence, generate D4 (0023) + schema/exporter/d1-seed cleanup + grep gate + post-drop smoke (DI §9.13)
- [ ] DI-14 — After-drain status backfill script + run (pre-settlement only; once 0019 lands verify the settlement `placed`/`paid` → `confirmed` alias cleanup instead) (DI §9.14)
- [ ] DI-15 — Docs close-out: architecture (grams/units/authority), todo statuses incl. the stale legacy-column entry, ADR, cross-spec numbering notes (DI §9.15; after DI-3–14)

**Deferred with spec:** OPS-23 — Sentry evaluation against the OPS §7.2 trigger (deferred; revisit after OPS-17).
**Deferred to phase 2:** PAY P1–P17 — Paymob gateway (intention API, HMAC webhook, refunds ledger, reconciliation) per the frozen `2026-09-13-order-lifecycle-payments-design.md`. Returns only after the owner unblocks merchant onboarding (AgDR-0001; roadmap §4.2).

**Phase 6 polish (each needs its own spec + plan; roadmap §4.7):**

- [ ] PostHog analytics: wiring, event taxonomy/funnel (old board Phase 2; COM §1.4 places it here)
- [ ] Invoice PDF export (COM §1.4 deferral)
- [ ] Blends catalog: category landing copy + product photography pack (the studio is retired; AgDR-0002)
- [ ] Native-speaker pass on Arabic copy added across EM/MS/COM/I18N

## Business blockers (owner actions)

- [ ] **[OWNER]** Settlement accounts: receiving InstaPay address + Vodafone Cash wallet number — gates the transfer instructions and M1 launch (MS §3.8; roadmap §6)
- [ ] **[OWNER]** WhatsApp number for the customer CTA (MS §3.8, O4)
- [ ] **[OWNER]** COD decision: offer it or not (`PAYMENTS_COD_ENABLED`) (MS §8, O1)
- [ ] **[OWNER]** Ready-made blend product data: names, ingredients, weights, prices, stock, photos — gates BLEND-3 (AgDR-0002)
- [ ] **[OWNER]** Paymob merchant onboarding: KYB/approval, sandbox + production keys, HMAC secret, integration IDs — phase 2 only; no longer gates M1 (AgDR-0001)
- [ ] **[OWNER]** Sender domain + DNS: register a dedicated domain, SPF/DKIM/DMARC, Resend account + domain verification, `RESEND_API_KEY`, `ADMIN_NOTIFY_EMAILS` — gates EM-12 and M0's no-lost-email proof (EM §9 external)
- [ ] **[OWNER]** Custom-domain decision — gates zone HSTS/Cache Rules, hreflang validation, and the M6 invocation-reduction half (OPS §7.4; I18N-12; D37)
- [ ] **[OWNER]** VAT registration status — tax stays `active = 0` until confirmed (COM §6.1; COM-W0-10)
- [ ] **[OWNER]** Encrypted backup storage + passphrase handling — OPS-16/M5-4 cannot run without it (OPS §3.7)

## Owner decisions (full list: roadmap §7, D01–D42)

All items default to the roadmap's recommendation unless the owner objects; an objection opens an
ADR and may change a plan, not a phase gate. Top blocking decisions:

- [ ] D01 — Email provider (recommended: Resend; fallback Workers Paid + Cloudflare Email Service)
- [ ] D02 — Sender domain acquisition (recommended: dedicated domain verified before provider enable)
- [ ] D28 — Default locale redirect (recommended: deterministic 301 → `/ar`; no negotiation)
- [ ] D20 — Tax mode (recommended: inclusive `rate_bp = 1400`, `active = 0` until VAT confirmed)
- [ ] D08 — Reservation timing (recommended: reserve at placement; 24-h hold + 5-min grace, env-tunable)
- [ ] D09 / D41 — Paymob checkout mode + CSP (deferred to phase 2 per AgDR-0001)
- [ ] MS O1–O8 — Settlement configuration: COD on/off, hold window, no proof uploads, WhatsApp number source, hold extension (+24 h), full refunds only, COD capture at handover, env-configured receiving accounts (recommended defaults in MS §8)

## Archive

**Shipped 2026-09-02 — storefront (commit `dd07776`).** Governorate shipping (7 zones,
free-shipping threshold 600_00, `computeShipping`) + durable email outbox
(`enqueueEmail`/`flushOutbox`, admin notify digests); i18n AR/EN keys; spec DDLs patched. Paymob
was deferred at that point. See `docs/decisions.md` 2026-09-02. The 2026-09-17 pivot (AgDR-0001)
defers Paymob again and makes COD plus manual transfers the M1 settlement model.

**Shipped 2026-09-09 — production-readiness pass.** Migration 0016 order hardening (trigger-owned
stock, `stock_version`, `payment_status`, legacy `paid`→`placed` display) + 0017 catalog authority
(legacy columns bridged, staged drop outside the journal); checkout nonce proof cookies; oRPC
search boundary; single CI deploy owner (test → e2e → migrate → deploy, same artifact); 480+ unit /
40 e2e green. See `docs/decisions.md` 2026-09-09.

**Shipped 2026-09-13 — storefront UX/a11y.** Commits `732b99a` (availability badge from variant
stock), `6bed2dc` (storefront a11y, touch targets, mobile layout), `1dddff5` (e2e skip link,
mobile search, form a11y).

**Resolved / no longer open.** Dev-mode hydration investigation closed (2026-09-13): `vp dev`
hydration works; the raw-HTML check was misleading. `.finite()`/`MAX_SAFE_INTEGER` caps on admin
page params already implemented (DI Appendix B). `pnpm audit` clean (2026-08-21 overrides);
rate-limit persistence, checkout idempotency nonce, third-party imagery cutover, and SQLITE_BUSY
retries shipped. Card-expiry validation is moot (PCI card fields removed). The old "disable Pages
Git integration / set secrets" item is stale: the integration is already disconnected and
production env keys are set (roadmap §1.2).

**Superseded / unavailable.** `docs/plan-2026-09-02-priority-overhaul.md` and
`docs/plan-2026-09-02-admin-ops.md` are deleted/unavailable (not in the repo) — do not link them as
live; their surviving content is absorbed by the 2026-09-02 ADRs and this program. The 2026-08-25
roadmap ordering and old roadmap sections are superseded by the 2026-09-13 program.

**Incident lesson (2026-08-22).** Production 1101 outage from an invalid `ORDER_ACCESS_SECRET` at
deploy. Closed by OPS-7 (secret preflight before migrations) and OPS-6 (`verify-production`
SHA/health/header gate).
