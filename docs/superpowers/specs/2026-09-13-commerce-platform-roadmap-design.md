# Commerce Platform Program Roadmap — Master Design Spec

**Date:** 2026-09-13
**Status:** Authoritative program roadmap. Freezes cross-spec arbitration for the 2026-09-13
program. Docs only: this document changes no code, config, migration, or companion spec.
**Owner:** Project owner (solo senior developer).
**Amended:** 2026-09-17 — manual-settlement pivot (AgDR-0001) and blend-studio retirement
(AgDR-0002). See §1.3, §2, §4.2, §6, and §7.
**Companion specs (all in `docs/superpowers/specs/`):**

| ID             | Spec                                                                              |
| -------------- | --------------------------------------------------------------------------------- |
| EM             | `2026-09-13-email-delivery-pipeline-design.md`                                    |
| MS             | `2026-09-17-manual-settlement-design.md`                                          |
| PAY (deferred) | `2026-09-13-order-lifecycle-payments-design.md` — phase-2 reference, do not build |
| DI             | `2026-09-13-data-integrity-hardening-design.md`                                   |
| OPS            | `2026-09-13-ops-security-hardening-design.md`                                     |
| COM            | `2026-09-13-commerce-parity-design.md`                                            |
| I18N           | `2026-09-13-i18n-routing-design.md`                                               |

**Authority rule.** Where a companion spec conflicts with this document on migration numbering,
file/feature ownership, sequencing, or phase placement, this document is authoritative. The
companion specs are being amended in parallel to match §3; until they are, read citations to
their sections against the arbitration tables here. Factual citations in companion specs
(e.g. PAY §4.1 calling its migration `0018`, DI §9 planning `0019`/`0020`) are superseded by
§3.1. Any future reversal requires a new dated entry in `docs/decisions.md`, not a silent edit.

---

## 1. Program overview

### 1.1 Objective

The storefront is live, bilingual, and holds a real catalog, but it cannot yet take real money
and it silently loses transactional email. This program turns it into a production commerce
platform in a deliberate order:

1. **Correctness first** — email actually delivers, security headers and auth throttling exist,
   deploys are health-verified, docs match reality.
2. **Real settlement** — cash on delivery plus manual InstaPay and Vodafone Cash transfers with
   admin-verified payment and a working refund path (AgDR-0001). Paymob is deferred to phase 2.
3. **Commerce parity** — shipping/tax/coupons/returns/reviews/admin tooling on top of a stable
   money layer.
4. **Performance and cost** — path-based i18n and public-page caching, only when the free-tier
   headroom or SEO plan demands it.
5. **Polish** — analytics, wishlist, abandoned cart, invoice PDF — opportunistic, spec-gated.

### 1.2 Verified baseline (2026-09-13)

These facts were verified read-only while drafting this roadmap and correct the original audit.
They are the starting line every companion spec must assume.

| Area                   | Verified fact                                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack                  | SvelteKit 2 + Svelte 5 runes, TypeScript strict, Tailwind v4, Cloudflare Pages + D1 + KV, Drizzle, Better Auth, Vitest (`vp test --run`), Playwright, GitHub Actions (`vp` toolchain).                                                                                                        |
| Migration journal      | Ends at `0017_catalog_authority` (`drizzle/meta/_journal.json`); next free index is `0018`.                                                                                                                                                                                                   |
| Production D1          | 191 products / 191 variants / 561 images / 0 orders / 0 notifications.                                                                                                                                                                                                                        |
| Health endpoint        | `GET /api/health` **already exists** (`src/routes/api/health/+server.ts`, exercised by `tests/health.e2e.ts`). OPS extends it with version + `no-store`; it does not create it.                                                                                                               |
| Pages Git integration  | **Already disconnected** (Cloudflare API `source: null`). Production env keys are exactly `ADMIN_EMAIL`, `BETTER_AUTH_SECRET`, `ORDER_ACCESS_SECRET`, `ORIGIN` (all `secret_text`). `docs/production-runbook.md`, `docs/architecture.md:239`, and `docs/todo.md:477` are stale on this point. |
| Two-storefront catalog | Honey + beekeeping tools expansion is **already shipped** (commits `e4c9cfe`, `59662fa`); `sku`, `published`, `costPrice`, `weightGrams` columns exist. Remaining: SKU uniqueness, storefront enforcement, `salePrice`, variant-level weight (COM §3h).                                       |
| Email pipeline         | Outbox rows accumulate and are marked `sent` even when no provider binding exists (EM §1.1). No Cron Worker, no retry, no admin visibility.                                                                                                                                                   |
| Deployment chain       | GitHub Actions is the single deployer: `test` → `e2e` → `migrate-production` → `deploy-production`. Push to `main` runs that chain; the Pages Git integration is not involved.                                                                                                                |
| Incident history       | 2026-08-22: production 1101 outage caused by an invalid `ORDER_ACCESS_SECRET` at deploy. Lesson: validate secrets **before** migrations/deploy (OPS §3.5).                                                                                                                                    |
| Worker artifacts       | No `workers/` directory exists yet; EM creates `workers/email-sender/` (EM §8.2).                                                                                                                                                                                                             |
| Free tier              | Workers 100K req/day, D1 5M rows read/day, 100K rows written/day, Pages static bandwidth unmetered (`docs/architecture.md:244-266`).                                                                                                                                                          |

### 1.3 Program invariants

Every phase and every sub-project must preserve these. A plan that breaks one requires a new ADR.

1. **Money is integer piasters everywhere** — DB columns, service math, API payloads, UI display
   (format only at the edge). No floats in money paths.
2. **Guest checkout stays** — no account required to buy; order access continues via the
   capability cookie (MS §7, I18N §1.5).
3. **Private routes stay unprefixed** — `/checkout`, `/account`, `/admin`, `/api` are never
   localized (I18N §8.4); they remain `noindex`.
4. **Public pages must become free-tier-cacheable** — the Cache API page cache and anonymous
   public layout are the target end state (I18N §3.4); no new uncacheable public read paths.
5. **Admin-verified settlement** — cash on delivery plus manual InstaPay and Vodafone Cash
   transfers; only the shop sets `paid` (AgDR-0001; MS §3.2). Paymob is a phase-2 option, not a v1
   dependency.
6. **Ready-made blends are products** — the blend studio is retired (AgDR-0002); blends sell as
   catalog products with weight variants, jar stock, and ingredient descriptions. No recipe
   accounting and no raw-material deduction run at order time.
7. **Single authority per schema surface** — one vocabulary for order status, one owner per
   table, no dual writes (DI §1.4; arbitration §3).
8. **Docs match reality at every phase gate** — stale claims are treated as defects (OPS task 0).

### 1.4 What changed since the original audit

- The original audit assumed Pages auto-deployed from Git and that `/api/health` needed creating.
  Both are false (§1.2); M0's ops work is an **extension and enforcement** job, not a greenfield.
- The two-storefront catalog expansion is largely done; COM's W0 catalog list shrinks to
  uniqueness/enforcement/sale price/variant weight rather than new storefront work.
- Paymob was the program's central deliverable on 2026-09-13. On 2026-09-17 the owner deferred it
  (AgDR-0001): v1 ships COD plus manual transfers under admin-verified payment. Paymob returns in
  phase 2 with no date, and no v1 work waits on merchant onboarding.
- Email was believed to be "sent but unlogged"; it is in fact **silently lost** — EM becomes the
  first implementation project, not a cleanup.

---

## 2. Sub-project map

Estimates are focused implementation time derived from each spec's own task tables; calendar time
adds business waits (owner settlement accounts, domain verification) and the solo context-switch
tax.
"Task-days" sums the spec table; "Wall clock" allows for the parallelization the spec documents.

| ID                 | Scope                                                                                                                                                                                                                                    | Primary outputs                                                                                                                   | Task-days (basis)            | Wall clock                       | Ref            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------- | -------------- |
| **EM**             | Fix silent outbox loss; explicit `SendResult`; outbox retry/lease columns; Cron Worker `workers/email-sender/`; Resend adapter; reset email through outbox; `/admin/emails`; alerting + prune.                                           | `workers/email-sender/`, `outbox.ts`, `outbox-drain.ts`, `email-provider.ts`, migration 0018, admin page, CI worker deploy.       | 13.5 d                       | ~1.5–2 w (EM §9 parallelization) | EM §9          |
| **MS**             | Order/payment state machines; reserve-at-placement hold with expiry; COD plus manual InstaPay and Vodafone Cash flows; customer claim and admin review queue with audit; WhatsApp CTAs; expiry job consumed by EM's worker.              | Migration 0019, `settlement/*.ts`, checkout method and claim routes, admin actions, cron job export.                              | 12 d                         | ~2 w                             | MS §9          |
| **PAY** (deferred) | Phase-2 gateway design only: Paymob Intention + Unified Checkout, 20-field HMAC webhook, refunds ledger, reconciliation. Not built in v1 (AgDR-0001).                                                                                    | None until phase 2.                                                                                                               | —                            | —                                | PAY (deferred) |
| **DI**             | Safe order-status default; inventory REAL kg → INTEGER grams; movement units; named CHECKs + missing triggers; shared status vocabulary; drain-gated legacy-column drop; staged pre-payments backfill.                                   | Migrations 0021/0022/0023 (or fold), `units.ts`, inventory service rewrites, constraint specs, reconciliation queries.            | 12 d + wall-clock drain gate | ~2–2.5 w + drain wait            | DI §9          |
| **OPS**            | Nonce CSP; root `_headers`; auth throttling; shared `escapeHtml`; email verification; `kit.version.name` + extended health; `verify-production` job; secret preflight; supply-chain scanning; Time Travel backups; Workers Logs + probe. | Security headers module, CI changes, verification flow + migration 0020, backup/restore scripts, probe workflow, runbook rewrite. | 17 d (incl. manual steps)    | ~2.5–3 w                         | OPS §8         |
| **COM**            | Coupons; shipping v2 (zones × methods × weight tiers); inclusive tax with snapshots; returns/RMA; reviews; notification matrix; admin commerce tools (manual orders, audits, CSV, Cairo-time buckets); catalog prerequisites.            | Per-area migrations (numbers assigned when their sub-specs land), services, admin surfaces, e2e coverage.                         | —                            | ~26–28 w sequential (W0 ≈ 8 w)   | COM §7         |
| **I18N**           | `[lang=lang]` for public routes; 301 legacy map; hreflang/canonical/sitemap; hybrid prerender + Cache API page cache; admin purge.                                                                                                       | Two PRs (routing/SEO; cache), no DB migrations.                                                                                   | 11.5 d                       | ~2–2.5 w                         | I18N §9        |

**Program shape.** M0–M1 (correctness + settlement) is the launch-critical spine at roughly 6–8
focused weeks, with ops and some integrity work overlapped. COM is the long tail (two quarters);
it is intentionally separated so money correctness is never blocked behind parity features.

---

## 3. Frozen cross-spec arbitration

### 3.1 Migration numbering (authoritative)

| #      | File                                             | Owner      | Constraint                                                                                                                                                   |
| ------ | ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0018   | `0018_email_delivery.sql`                        | EM         | **First.** Outbox rebuild (attempt_count, `next_attempt_at`, `last_error`, `provider_message_id`, `locked_at`) + indexes.                                    |
| 0019   | `0019_settlement.sql`                            | MS         | **After 0018.** Order/payment schema, settlement events, hold deadline, status vocabulary, triggers. Number frozen; content reshaped 2026-09-17 (AgDR-0001). |
| 0020   | `0020_email_verified_backfill.sql`               | OPS        | **After 0018.** Backfill only; requires the verification deploy already live (OPS §8 task 20).                                                               |
| 0021   | `0021_order_status_default.sql`                  | DI (D1)    | **Only if settlement is not yet applied**; otherwise folded into MS's rebuild. Never two `store_order` rebuilds in one release window (DI §8.5).             |
| 0022   | `0022_inventory_integrity.sql`                   | DI (D2)    | Independent of payments.                                                                                                                                     |
| 0023   | `0023_drop_legacy_product_columns.sql`           | DI (D4)    | Drain-gated; only after old-instance drain evidence (OPS health SHA + canary).                                                                               |
| staged | `drizzle/staged/after_drain_status_backfill.sql` | DI (D3)    | Staged, **pre-settlement only**: `paid` → `placed` backfill. Superseded once 0019 lands; never run after settlement.                                         |
| —      | COM / I18N migrations                            | COM / I18N | **No numbers reserved.** Each COM sub-spec takes the next free tag at implementation time; I18N has no migrations.                                           |

Rules: never reuse a tag, never renumber after a file lands on `main`, always confirm the next
free index in `drizzle/meta/_journal.json` at generation time, and hand-review generated SQL
(legacy tables `store_coupon`, `store_return`, `store_review` are not in `schema.ts` and may be
proposed for drop — never commit that blindly; COM §4.3, DI §3.2).

### 3.2 Single-owner assignments (authoritative)

| Surface                                                                                                | Owner    | Explicit non-owners                                         |
| ------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| `enqueueEmail` signature, `OutboxType` union, outbox schema/logic                                      | **EM**   | MS/COM/OPS consume it; no parallel email writes             |
| `workers/email-sender/` — `scheduled()`, cron entries, drain loop, health                              | **EM**   | MS/COM/OPS register jobs through EM's worker hook           |
| `runSettlementJobs` (hold expiry release)                                                              | **MS**   | EM's worker invokes the exported function only              |
| Canonical order/payment vocabulary, legacy alias cleanup, `store_payment_event`, full-refund recording | **MS**   | DI consumes constants; nobody forks the enum                |
| Single `store_order` rebuild, inventory/movement schema, named constraints, legacy-column drop         | **DI**   | MS supplies its default/trigger contract; no second rebuild |
| `ci.yml` shape, `verify-production`, secret preflight, `sendResetPassword` renderer/escaping/gating    | **OPS**  | EM owns the delivery pipeline the renderer feeds            |
| Coupons, shipping v2, tax, returns, reviews, admin commerce tools, `reason_code` service/UI            | **COM**  | Reason codes are read by MS refunds but owned by COM        |
| Routing, hreflang/canonical/sitemap, page cache, admin purge                                           | **I18N** | No schema changes; no auth/private-route changes            |

### 3.3 Conflicts resolved by this roadmap

| #   | Conflict                                                                                                                                                | Resolution                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | EM reserves `0018`; PAY §4.1 also labels its migration `0018_payments`; DI plans `0019`/`0020`.                                                         | EM takes `0018`, settlement takes `0019`; settlement-first references in DI become `0019`; DI's own files become `0021`/`0022`/`0023` per §3.1.                                    |
| C2  | DI §3.1 ships a standalone `'placed'` default; settlement replaces the vocabulary with `pending_confirmation`.                                          | DI D1 is conditional: if 0019 has not been applied, ship 0021 with `'placed'`; if settlement is applied, fold the physical default alignment into MS's rebuild once (DI §8.5).     |
| C3  | OPS task 19–21 (verification UI, backfill, gating) is gated by EM's outbox task; OPS tasks 1–2 (escaping/render extraction) precede EM's reset enqueue. | OPS 1–2 land before EM's `sendResetPassword` rewiring; EM lands the outbox; OPS 19→20→21 land after. Direction is per-slice, not whole-project.                                    |
| C4  | OPS creates "health/version" work; `/api/health` already exists.                                                                                        | OPS **extends** the existing route (`kit.version.name` = `GITHUB_SHA`, `no-store`); no new endpoint, no replacement.                                                               |
| C5  | COM §4.2 wants W0 before payments launch; COM §4.3 says never blindly commit generated drops.                                                           | W0 ships before _launch_ (not before implementation); each COM area re-declares its legacy table in `schema.ts` in the same change and takes the next free migration tag.          |
| C6  | DI §9 references `0019`/`0020` for D1/D2; COM §7 references payments `0018`.                                                                            | Both read against §3.1: DI = 0021/0022/0023 (or fold), COM = 0019.                                                                                                                 |
| C7  | I18N could precede or follow payments.                                                                                                                  | I18N is independent and has no schema coupling; it defaults to after Phase 4 (M5) and may be pulled earlier **only** on measured free-tier pressure or a forced SEO/campaign date. |
| C8  | EM §8.3 puts reset email in the same outbox; OPS §3.4 owns verification gating.                                                                         | EM owns the pipeline; OPS owns the renderer, escaping, and the gate conditions. The split is at `auth.ts`'s enqueue call, not in delivery.                                         |

---

## 4. Milestones and phases

### 4.0 Milestone summary

| Milestone | Phase                              | Goal                                                                                                             | Definition of done (one line)                                                                                                                                                                                            | Gate commands                                                                                                                |
| --------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **M0**    | Production correctness             | Make the live site safe and honest before any new feature.                                                       | No email can be silently lost; headers/throttling/escaping/verification live; deploy blocked unless health+SHA verified; docs match reality.                                                                             | `vp check`; `vp test --run`; `vp run test:e2e`; migration replay (0018/0020); `verify-production` job green; runbook review. |
| **M1**    | Manual settlement + launch catalog | Record COD and transfer orders, verify payment by hand, hold stock with a deadline, and retire the blend studio. | COD and transfer journeys complete; no customer path reaches `paid`; review queue and audit trail live; hold expiry releases exactly once; one full refund recorded; `/blends` redirects; ready-made blends purchasable. | `vp check`; `vp test --run`; e2e suite (`E2E_USE_BUILD=1`); migration replay (0019); runbook checklist; `verify-production`. |
| **M2**    | Commerce core (COM W0)             | Put non-money commerce primitives in place before launch.                                                        | Catalog prerequisites enforced (SKU unique, `published` honored, sale price, variant weight); shipping v2 resolves zones × weight; tax snapshot model exists; Cairo-time buckets correct.                                | `vp check`; `vp test --run`; `vp run test:e2e`; migration replay; COM §4.2 W0 exit checklist.                                |
| **M3**    | Commerce parity (COM W1/W2)        | Reach WooCommerce-level commerce capability.                                                                     | Coupons, manual orders, edit audit, reviews, CSV, returns/RMA operational per COM §3a–3g and §4.2.                                                                                                                       | `vp check`; `vp test --run`; `vp run test:e2e`; area migration replays; COM §7 area demos.                                   |
| **M4**    | Admin parity                       | Close the admin surface and audit-trail gaps left by M0–M3.                                                      | Every admin mutation is role-gated + audited; list/filter/export parity across orders/customers/payments/inventory; no orphaned tools.                                                                                   | `vp check`; `vp test --run`; admin e2e suite; audit coverage query (no unaudited mutation routes).                           |
| **M5**    | Reliability                        | Make failures visible and recoverable without a developer.                                                       | Notification matrix complete; dead-letter ops runnable; reconciliation monitored; backup/restore drill done; alert pipeline proven with a deliberate failure.                                                            | `vp check`; `vp test --run`; drill evidence; alert fire+recover walkthrough.                                                 |
| **M6**    | Performance & cost                 | Cut D1 reads and satisfy SEO with path-based i18n.                                                               | `/ar` + `/en` public routing live with 301s/hreflang/sitemap; ≥70% page-cache hit share; 60–85% D1 read reduction on public paths at flat traffic.                                                                       | `vp check`; `vp test --run`; `vp run test:e2e`; I18N §6 metric table; scheduled canary.                                      |
| —         | Phase 6 polish                     | Opportunistic backlog                                                                                            | Spec-gated only; enters a milestone only with its own spec + plan.                                                                                                                                                       | Its own spec's gates.                                                                                                        |

### 4.1 M0 — Production correctness (Phase 0)

**Goal.** Fix the silent failures and unsafe edges before adding revenue surface.

**Specs and scope.**

- **EM** — migration 0018 + outbox drain + `workers/email-sender/` + provider adapter + app
  rewiring to enqueue-only + reset email through outbox + env validation (EM §9 tasks 1–8, 10).
  `/admin/emails` and e2e (tasks 9, 11) land in this milestone too; they are the operational
  evidence that "no silently-lost email" holds.
- **OPS** — `escapeHtml` + reset renderer extraction (tasks 1–2) **before** EM's reset rewiring;
  auth throttling (3–4); version + health extension (5); `verify-production` (6); secret preflight
  (7–8); headers/CSP report-only→enforce (9–10); supply chain (11–14); backups + restore drill
  (15–16); observability + probe (17–18); email verification (19–21); runbook/architecture/todo
  truth pass (0). Task 0 may run first or last but must precede the M0 gate.
- **DI** — D2 inventory units + constraints (tasks 2, 5–10) and D4 **prep only**: drain evidence
  runbook, exporter cleanup prep, health-SHA revision check (tasks 8, 12). D1 is deferred to M1
  per arbitration (C2); D4 execution is wall-clock-gated, not effort-gated (DI §9).
- **Not here:** any customer-facing commerce feature, any routing change, any COM work that needs
  payments schema.

**Sequencing inside M0.**

1. EM tasks 1→3 (schema + drain logic) and OPS tasks 1–2 in parallel; OPS 0 can start at once.
2. Then EM {4,5,6,9} + OPS {3–18} with `ci.yml` edits serialized (OPS §8 parallelization note).
3. OPS 19→20→21 after EM's outbox is live (C3).
4. DI D2 runs independently; DI drain-prep uses OPS health SHA once task 5 lands.
5. `/admin/emails`, alerting, e2e, rollout (EM 9–12) close the milestone.

**Exit gate (M0).**

- No email path can mark a row `sent` without a provider message id; `/admin/emails` shows
  pending/sent/dead truthfully.
- CSP is enforced (not report-only) with zero E2E console violations; `_headers` covers static.
- Reset/verification endpoints are throttled per-IP + per-account; escaping has one helper.
- Production deploy is impossible unless `verify-production` confirms SHA + health + headers.
- Secret preflight runs before migrations; the 2026-08-22 failure class is closed.
- Inventory is stored in grams with named CHECKs; D4 evidence collection is running.
- `docs/production-runbook.md`, `docs/architecture.md`, and `docs/todo.md` have no known stale
  claims about deployment, health, or email.

**Gate commands.** `vp check`; `vp test --run`; `vp run test:e2e`; migration replay (0018, 0020);
`verify-production` job green on a production deploy; restore drill evidence recorded.

### 4.2 M1 — Manual settlement + launch catalog (Phase 1)

**Goal.** Record COD and manual transfer orders, verify payment by hand, hold stock with a
deadline, and retire the blend studio so the catalog matches the shop's workflow.

**Specs and scope.**

- **MS** — full §9 sequence SET-1…SET-12: `0019_settlement` migration + DDL copies, lifecycle core
  and vocabulary rework, checkout method selection + transfer instructions + claim flow, success
  and order pages with the WhatsApp CTA, admin review queue and audited actions, hold-expiry job
  wired into EM's worker (or its stub), settlement notification copy, e2e journeys, coverage
  reporting, security pass, docs truth pass.
- **Catalog pivot (AgDR-0002)** — retire the blend studio (`/blends` 301, Phaser lab, blend cart
  and order expansion, navigation, i18n, tests) and sell ready-made blends as catalog products
  with weight variants, jar stock, and ingredient descriptions. No migration.
- **DI** — D1 folded. If M0 shipped 0021 with `'placed'`, the 0019 rebuild aligns the physical
  default to `pending_confirmation` in the same rebuild (C2). If settlement lands before any DI D1
  file, the fold happens inside 0019 and 0021 is never created.
- **OPS** — verification gating where account state is touched; no CSP change in v1 (the Paymob
  confirmation moves to phase 2); preflight/env validation extended for the v1 settlement
  variables (`PUBLIC_WHATSAPP_NUMBER` and the receiving accounts).
- **EM** — no schema changes; `sendOrderStatusUpdate` and the settlement triggers call the same
  `enqueueEmail`; SET-8 asserts outbox rows per trigger.

**Business blockers that gate _launch_, not implementation.**

- Owner settlement accounts: the receiving InstaPay address and Vodafone Cash number.
- Owner WhatsApp number for the customer CTA (O4).
- COD offered yes/no (`PAYMENTS_COD_ENABLED`, O1).
- Ready-made blend product data: names, ingredients, weights, prices, stock, and photos.
- Sender domain registered, DNS with SPF/DKIM/DMARC, provider account verified (EM §9 external).

**Exit gate (M1).**

- COD journey complete: the order is recorded `unpaid`, the admin confirms, ships, delivers, and
  records the collected cash.
- Transfer journey complete: the customer claims, the admin verifies the money in the receiving
  account, and the order proceeds. No customer path reaches `paid`.
- Hold expiry releases stock exactly once; shipped and delivered reversals never restock.
- Every admin settlement and fulfillment action writes an audit row; the review queue and the
  event timeline render.
- One full refund recorded with a reason and a reference.
- `/blends` returns 301; a ready-made blend product checks out as a normal variant line; no
  recipe accounting runs.
- Coverage reporting exists with a recorded floor for the settlement modules.

**Gate commands.** `vp check`; `vp test --run`; migration replay (0019; trigger + default tests);
e2e suite (`E2E_USE_BUILD=1`); runbook go-live checklist in the PR; `verify-production`.

### 4.3 M2 — Commerce core (COM W0, Phase 1.5)

**Goal.** Ship the order-snapshot primitives that must exist before real orders accumulate, without
touching money movement.

**Specs and scope (COM §4.2 W0).**

- **3h catalog prerequisites** — variant `cost_price`/`sale_price`/`weight_grams`, `sku` partial
  unique index, `published` enforcement in listing/featured/search/sitemap, admin toggle + schemas,
  seed/backfill + docs (COM §7 rows 3h-1…3h-4).
- **3b shipping v2** — tables + seed parity for 7 zones/standard rates, `resolveShipping` service,
  checkout integration, `/admin/shipping`, `ShipmentProvider` manual adapter (COM §7 rows 3b-1…3b-5).
  Runs beside payments because `shipping_cost` is already an isolated snapshot.
- **3c tax** — `store_tax_setting` + snapshot columns, integer tax math (inclusive), invoice
  rendering, `/admin/settings/tax` (COM §7 rows 3c-1…3c-4). `active = 0` until VAT is confirmed.
- **3g Cairo buckets** — timezone helper + dashboard/report SQL range filters (COM §7 row 3g-1).
- **COD is a payment method, not a shipping method** — shipping v2 keeps the method list about
  delivery; checkout owns payment selection (MS §3.4).

**Exit gate (M2).** Per COM §4.2/§7: archived products invisible everywhere; SKU conflicts
surface as typed admin errors; checkout resolves a zone × weight shipping estimate that matches
the snapshot persisted on the order; tax math is integer-exact and invoices state VAT inclusion;
Cairo day boundaries are correct across DST tests. Money movement untouched; all migrations that
ship here are additive and take the next free tag at implementation time (C1/§3.1).

**Gate commands.** `vp check`; `vp test --run`; `vp run test:e2e`; migration replay; COM §4.2 W0
exit checklist.

### 4.4 M3 — Commerce parity (COM W1/W2, Phase 2)

**Goal.** Reach WooCommerce-level capability once the money layer is trusted.

**Specs and scope (COM §4.2 waves).**

- **W1 (after the settlement schema is live)** — coupons (snapshot + redemption columns; one code
  per order, no stacking), manual orders with payment-method choice, order/customer edit audit +
  notes, reviews (verified purchase, pre-moderated), bulk CSV import/export with dry-run.
  Reviews and bulk only strictly need 3h; coupons/manual orders need the settlement schema
  (COM §4.2).
- **W2 (after production refunds verified)** — returns/RMA (14-day window, evidence rules,
  inspected-good restock, refund recording through the settlement lifecycle), notification matrix
  consolidation, stock adjustments if not already landed.
- **Boundary** — returns never precede working refunds; reason codes are COM-owned and read by the
  settlement refund and audit surfaces (§3.2).

**Exit gate (M3).** Per COM §3a–3g and §7 area demos: coupon apply/cap/exhausted/cancel-release
e2e green; manual order reaches `pending_confirmation` and can be marked paid only through the
guarded path; every order/customer edit writes before/after audit rows; reviews gated by verified
purchase
and moderation; CSV dry-run makes zero writes and re-import is idempotent by SKU; partial return
with damaged vs good quantities exercises refund + restock correctly.

**Gate commands.** `vp check`; `vp test --run`; `vp run test:e2e`; per-area migration replays;
COM §7 area checklists.

### 4.5 M4 — Admin parity (Phase 3)

**Goal.** No fragmented admin surface, no unaudited mutation, no missing operational view left
behind by M0–M3.

**Scope.** This milestone is intentionally a **consolidation pass**, not a new-feature pass:

- Audit-trail breadth: enumerate every admin mutation route and prove each writes `logAdminAction`
  with target type + before/after where the target is order/customer/inventory/payment.
- Admin list/filter/export parity: orders, payments, customers, inventory, emails, coupons,
  reviews, returns — consistent pagination, empty states, CSV export where specified.
- Close any COM §7 rows that slipped (known candidates: 3g-g2 order/customer edits, 3g-g5
  inventory adjustments) — but only by executing their existing spec, never by inventing scope.
- Dashboard aggregates reflect collected vs awaiting-review vs legacy simulated money (MS §6),
  Cairo buckets (M2), and the reliability counters from M5 once available.

**Exit gate (M4).** Audit coverage query returns no unaudited admin mutation route; each admin
area has an e2e happy path + at least one guard test; admin i18n AR/EN key parity holds; no
unowned table or endpoint is left without a phase assignment.

**Gate commands.** `vp check`; `vp test --run`; admin e2e suite (`tests/admin-operations.e2e.ts`
plus area specs); audit coverage query recorded in the close-out PR.

### 4.6 M5 — Reliability (Phase 4)

**Goal.** Failures surface and recover without a developer at a keyboard.

**Scope.**

- **Notification matrix completion** (COM §3f) — every event in the matrix enqueues through EM's
  outbox; per-event e2e assertions of enqueue rows; no second scheduler.
- **Dead-letter operations** (EM §3.9) — `/admin/emails` resend/retry-all with audit; dead rows
  alerted to `ADMIN_NOTIFY_EMAILS`; 30-day prune verified.
- **Settlement monitoring** (MS §6) — expiry counts and review-queue counters logged every run;
  unreviewed claims surfaced in the orders queue; alert thresholds documented.
- **Backup/restore rehearsal** (OPS §3.7) — at least one local restore drill executed, encrypted
  off-repo baseline stored, manifest hashes verified; Time Travel bookmark recorded before restore.
- **Alerts** (OPS §3.8) — probe workflow running on schedule with two-consecutive-failure
  alerting; deliberately break staging/branch health once to prove fire + recovery.
- **Runbook close-out** — every phase's operational procedure is in the runbook, not in a spec.

**Exit gate (M5).** A deliberate failure (worker paused or health probe pointed at a bad SHA)
produces an alert within two cycles and a recovery alert after fix; restore drill evidence is
stored; the notification matrix has zero unowned rows; runbook covers worker deploy/rollback,
secret rotation, backup/restore, incident triage.

**Gate commands.** `vp check`; `vp test --run`; drill evidence file; alert fire/recover transcript.

### 4.7 M6 — Performance & cost (I18N, Phase 5) and Phase 6 polish

**Goal.** Public pages become cacheable and localizable on the free tier; polish backlog stays
spec-gated.

**Scope (I18N §9, two PRs).**

- **PR 1 — routing + SEO.** `[lang=lang]` public routes with route matcher, public layout without
  cookies/session, legacy 301 map, localized URL builders, hreflang/canonical/`og:locale`,
  sitemap alternates, switcher, E2E migration. Private routes stay unprefixed (I18N §8.4).
- **PR 2 — cache.** `page-cache.ts` + hook wiring, public `Cache-Control`, `X-Page-Cache` log,
  admin purge on catalog writes, prerender `/about`, after-metrics.
- **Default ordering** — after M5 unless free-tier pressure or a campaign date pulls it earlier
  (C7). It must land before organic traffic campaigns; full build-time prerender of catalog pages
  is rejected (I18N §8.3).
- **Phase 6 polish** — analytics (PostHog is already a dependency), wishlist, abandoned cart,
  invoice PDF, etc. Each item requires its own spec + plan and cannot displace a milestone gate.
  They are tracked as a backlog list, not scheduled here.

**Exit gate (M6).** I18N §6 metric table: ≥70% page-cache hit share after warm-up; 60–85% D1 read
reduction on public paths at flat traffic; 404/redirect-loop rates at or below baseline;
catalog-edit freshness ≤5 min; scheduled canary green; legacy URLs 301 to the correct locale;
private routes and cookie scopes unchanged.

**Gate commands.** `vp check`; `vp test --run`; `vp run test:e2e` (i18n suite); canary workflow;
before/after D1 metrics recorded in the close-out PR.

---

## 5. Dependency DAG

```
EM ─────────────► MS                       (enqueueEmail interface; MS exports runSettlementJobs)
OPS prep ───────► EM  ─────► OPS gating    (renderer/escaping before reset rewiring;
                                            verification gating after outbox is live)
EM + OPS ───────► DI D1 (fold) + DI D3     (safe default shape depends on MS state;
                                            drain evidence via health SHA)
DI D2 ──────────────────────────────────┐  (independent)
DI D4 ◄──── old-instance drain evidence ─┘  (wall-clock gate, OPS health SHA + canary)
COM W0 (3h/3b/3c/3g-g7) ──► before settlement launch   (COM §4.2)
COM W1 ──► after EM + settlement 0019/0021 (coupon/manual-order snapshot columns)
COM W2 ──► after production refunds verified
I18N ────► independent; default after M5 (pull earlier only on measured pressure)
```

| Edge              | Meaning                                                                                                           | Citation                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------- |
| EM → MS           | MS consumes `enqueueEmail`/`OutboxType`; MS owns `runSettlementJobs`, EM's worker invokes it.                     | §3.2; EM §3.3; MS §9 SET-7 |
| OPS(1–2) → EM     | Shared escaping + reset renderer extracted before EM rewires reset enqueue.                                       | OPS §8; EM §3.8            |
| EM → OPS(19–21)   | Verification/backfill/gating after a working outbox exists; reset issuance is never gated on a dead pipeline.     | OPS §8; C3                 |
| EM+OPS → DI D1    | D1's default/trigger shape depends on whether settlement has landed; D1 waits for the MS decision (fold vs 0021). | DI §2.3, §8.5; C2          |
| OPS → DI D3/D4    | Drain evidence (health SHA + checksum canary) is the gate; D3 is pre-settlement only.                             | DI §8.3, §9                |
| DI D2 → COM       | Inventory adjustments use grams + movement units + `reason_code`.                                                 | COM §4.1; DI §9            |
| MS → COM W2       | Returns/refunds depend on the settlement lifecycle and the delivered state.                                       | COM §4.1/§4.2              |
| EM → COM 3f       | Notification matrix is enqueue-only on EM's pipeline.                                                             | COM §4.2; EM §3.3          |
| COM W0 → COM W1   | SKU uniqueness + `published` enforcement precede coupons/bulk/reviews.                                            | COM §4.2; COM §7 3h        |
| I18N ∥ everything | No schema or auth coupling; default ordering only.                                                                | I18N §9; C7                |

---

## 6. Critical path to launch-ready

**Critical path (must be serial):**

1. **EM 0018 + drain + worker** — nothing pays off until email cannot silently vanish; MS's
   settlement notifications and OPS's verification both ride this path.
2. **OPS core** — `verify-production`, secret preflight, headers, throttling, version/health.
   Without the deploy gate, every subsequent production change is a coin flip (2026-08-22).
3. **MS 0019 + lifecycle + checkout flows + review queue + hold expiry** — the revenue path,
   including the DI D1 fold so there is exactly one `store_order` rebuild.
4. **Launch verification** — `verify-production` green on a production deploy that exercised a
   real COD order, a real transfer claim and verification, and a delivered email.

**Parallel business work (start now, no code dependency):**

| Workstream                            | Why it blocks launch                                                                                             | Where                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Settlement accounts + WhatsApp number | No receiving account = the transfer page cannot instruct the customer; no WhatsApp number = no confirmation CTA. | MS §3.8, §8 O4; §7 decisions |
| Ready-made blend product data         | The blends category cannot ship without names, ingredients, weights, prices, stock, and photos.                  | AgDR-0002; §4.2              |
| Sender domain + DNS (SPF/DKIM/DMARC)  | No verified domain = Resend cannot deliver order/reset mail; M0's "no lost email" is unprovable.                 | EM §9 external deps          |
| Custom domain decision                | Gates HSTS-at-zone, Cache Rules, hreflang validation, and the invocation-reduction half of M6.                   | OPS §7.4; I18N §9 task 12    |
| VAT registration status               | Tax stays `active = 0` until confirmed; invoices/legal copy depend on it.                                        | COM §6.1, §7                 |
| Backup storage + passphrase           | Restore drill and encrypted off-repo baseline cannot run without it.                                             | OPS §3.7                     |

**Launch-ready definition.** `verify-production` passes against a production deploy whose checkout
recorded a real COD order and a real transfer order, whose claim was verified by hand in the
receiving account, whose hold expiry released stock exactly once, and whose order-confirmation
email was delivered (not merely marked sent); all business blockers above are closed; the
runbook's go-live checklist is signed.

---

## 7. Consolidated owner-decision list

Every item is a **recommended default unless the owner objects**; an objection opens an ADR and
may change a plan, not a phase gate. Sources are the companion specs' decision sections.

| #   | Decision                        | Recommended default                                                                                | Source         | Affects         |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------- | -------------- | --------------- |
| D01 | Email provider                  | **Resend** (fallback: Workers Paid + Cloudflare Email Service, ~$5/mo; still needs the domain)     | EM §8.1        | M0              |
| D02 | Sender domain acquisition       | **Buy a dedicated sender domain, verify SPF/DKIM/DMARC before enabling the provider**              | EM §9 external | M0 (business)   |
| D03 | Worker location                 | **In-repo `workers/email-sender/`**                                                                | EM §8.2        | M0              |
| D04 | Reset email path                | **Same outbox** (no provider-native SMTP bypass)                                                   | EM §8.3        | M0              |
| D05 | Send latency                    | **Cron only, every minute**; no app→worker wake-up call                                            | EM §8.4        | M0              |
| D06 | Failed-row retry                | **5 bounded attempts + dead + manual resend from `/admin/emails`**                                 | EM §8.5        | M0              |
| D07 | Outbox claim mechanism          | **Conditional UPDATE + lease**; no reliance on D1 `RETURNING`                                      | EM §8.6        | M0              |
| D08 | Reservation timing              | **Reserve at placement; 24-h hold (env-tunable) + 5-min release grace**                            | MS §3.3        | M1              |
| D09 | Checkout mode                   | **Deferred to phase 2** (Paymob redirect); v1 selects a local payment method at checkout           | MS §3.4        | M1              |
| D10 | Refund granularity              | **Full manual refunds in v1**; amount-based ledger deferred to phase 2                             | MS §8 O6       | M1              |
| D11 | Manual mark-paid                | **The primary path**: reference or note + audit + settlement event                                 | MS §3.4.4      | M1              |
| D12 | Reconciliation cadence          | **Hold expiry every 5 min; review-queue counters in a daily 09:00 Cairo digest**                   | MS §6          | M1              |
| D13 | Post-shipment reversal          | **Refund only; no status flip, no restock** (RMA owns returns)                                     | MS §3.5        | M1              |
| D14 | `processing` state              | **Keep it; allow `confirmed → shipped` to skip**                                                   | MS §3.1        | M1              |
| D15 | Inventory precision             | **Grams (INTEGER)**                                                                                | DI §8.1        | M0 (D2)         |
| D16 | Movement ledger                 | **`unit` + `quantity_base_units` (Option A)**                                                      | DI §8.2        | M0 (D2)         |
| D17 | Legacy column drop timing       | **Decoupled and drain-gated**; never bundled with launch                                           | DI §8.3        | M0 prep / later |
| D18 | Constraint strictness           | **Fail loudly**; no silent clamping                                                                | DI §8.4        | M0              |
| D19 | Status-default fold             | **Fold into MS if 0019 is applied; otherwise ship 0021 with `'placed'`**                           | DI §8.5; §3.1  | M0/M1           |
| D20 | Tax mode                        | **Inclusive (`rate_bp = 1400`, `active = 0` until VAT confirmed)**                                 | COM §6.1       | M2              |
| D21 | Coupon stacking                 | **One code per order; no stacking** (`stackable` reserved)                                         | COM §6.2       | M3              |
| D22 | Review moderation               | **Verified purchase + pre-moderation** (all pending until approved)                                | COM §6.3       | M3              |
| D23 | Return restock                  | **Restock only inspected-`good` quantities**                                                       | COM §6.4       | M3              |
| D24 | Manual-order payment            | **Create `pending_confirmation`/`unpaid`; method choice including COD; guarded mark-paid only**    | COM §6.5       | M3              |
| D25 | Bulk import format              | **CSV (UTF-8, RFC 4180), `sku` upsert key, mandatory dry-run**                                     | COM §6.6       | M3              |
| D26 | Return window / evidence        | **14 days from delivery; ≥1 photo for `damaged`/`wrong_item`, optional otherwise**                 | COM §6.7       | M3              |
| D27 | Coupon release on cancellation  | **Only when the order never shipped**                                                              | COM §6.8       | M3              |
| D28 | Default-locale redirect         | **Deterministic 301 → `/ar` for `/` and legacy public URLs; no negotiation on redirects**          | I18N §8.1      | M6              |
| D29 | 301 vs 302 soak                 | **301 directly**; optional 302 soak only if the owner wants rollback-proofing                      | I18N §8.1      | M6              |
| D30 | Slug strategy                   | **Shared Latin slugs** (Arabic slugs need their own ADR + migration)                               | I18N §8.2      | M6              |
| D31 | Prerender vs cache              | **Hybrid: prerender `/about`; Cache API + public `Cache-Control` for D1 pages**                    | I18N §8.3      | M6              |
| D32 | Private-route prefixing         | **Keep private routes unprefixed**                                                                 | I18N §8.4      | M6              |
| D33 | Public first-visit negotiation  | **None in v1**                                                                                     | I18N §8.5      | M6              |
| D34 | Workers Cache vs Cache Rules    | **No Workers Cache; Cache Rules later with the custom domain**                                     | I18N §8.7      | M6              |
| D35 | Query-string caching            | **Excluded in v1**                                                                                 | I18N §8.8      | M6              |
| D36 | Sentry vs Workers observability | **Workers Logs + Pages notifications + scheduled probe now; Sentry deferred**                      | OPS §7.2       | M0              |
| D37 | HSTS timing                     | **No app-set HSTS until a custom domain; then zone-level 86400 → 6 months; preload much later**    | OPS §7.4       | M0/M6           |
| D38 | Action pinning policy           | **Pin all actions to full SHAs** (Dependabot maintains)                                            | OPS §7.3       | M0              |
| D39 | Verification-required actions   | **Admin bootstrap + email change + reset issuance (after backfill); never sign-in/checkout**       | OPS §7.5       | M0              |
| D40 | CSP enforcement timing          | **One full deploy cycle report-only + E2E console watch, then enforce**                            | OPS §7.6       | M0              |
| D41 | Paymob CSP shape                | **Deferred to phase 2**; confirm at onboarding                                                     | OPS §7.7       | Phase 2         |
| D42 | Probe cadence / channel         | **Every 30 min, alert after 2 consecutive failures; Telegram if secrets exist, else GitHub issue** | OPS §7.8       | M0              |

---

## 8. Execution protocol

**Per sub-project (mandatory sequence).**

1. **Spec** — the companion spec in `docs/superpowers/specs/` (this roadmap for cross-cutting
   arbitration). Specs are amended only to match this roadmap's §3, never to override it.
2. **Implementation plan** — `docs/superpowers/plans/<date>-<slug>.md` following the repo's
   `writing-plans` convention (the existing `docs/superpowers/plans/` directory is the home).
3. **Implementation with TDD** — tests first at the unit/route level; migration changes get a
   replay spec; embedded spec DDLs updated in the same change (DI §1.6).
4. **Quality gate** — `vp check`, `vp test --run`, `vp run test:e2e` where the area has e2e,
   migration replay, and the phase-specific evidence listed in §4.
5. **Commit** — conventional commits via the repo `git-assistant` pre-commit review
   (`type(scope): subject`), one logical change per commit.
6. **Docs** — append an ADR to `docs/decisions.md`; update `docs/architecture.md`; update
   `docs/todo.md` with build-plan items only (not design notes).

**Solo constraints.**

- **One phase in flight at a time.** No phase starts until its predecessor's exit gate is
  recorded. Parallelism is allowed only _inside_ a phase where the specs document it (e.g. EM/
  OPS/DI D2 in M0), never across phase gates.
- **Frozen migration numbers.** `0018`–`0023` and the staged file are frozen (§3.1). Any new
  migration takes the next free tag; no renumbering, no reusing, no ad-hoc `wrangler d1 execute`
  for schema outside the journal (the staged drop/backfill are the only sanctioned exceptions,
  and both are gated).
- **No push to `main` without the owner's explicit say-so.** Pushing to `main` triggers the
  `migrate-production` → `deploy-production` CI chain; migration replay and e2e run before it, but
  production environment reviewers are the last gate.
- **Business blockers run in parallel with code.** Settlement accounts, the WhatsApp number, and
  domain/DNS are started at program start; M1/M0 gates do not wait for them to _begin_, only to
  _launch_. Paymob onboarding belongs to phase 2.
- **Rollback posture** — forward-only migrations; rollback means redeploy of the previous build
  plus (only when required) a recorded Time Travel bookmark or staged SQL, executed by the owner
  with the runbook in hand.
- **Program review cadence** — after each milestone exit, re-read this roadmap against reality;
  a new dated ADR records any arbitration change.

---

## 9. Risk register

| #   | Risk                                                                                                                           | Likelihood / impact | Mitigation                                                                                                                                                                     | Early warning                                                                   | Owner |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----- |
| R1  | **Solo capacity** — six parallel specs across phases overwhelm one developer; half-finished phases.                            | High / High         | One phase in flight; frozen numbers; plan-first; split each phase into ≤2-day tasks (companion §9 tables already sized that way).                                              | Phase gate slips by >1 week; two plans open at once.                            | Owner |
| R2  | **Owner settlement details late** — the InstaPay address, wallet number, or WhatsApp number arrives after the code is ready.   | Medium / Medium     | Code ships behind env configuration; a missing account fails validation fast; the runbook lists the owner checklist.                                                           | Accounts not supplied by code-complete.                                         | Owner |
| R3  | **Email deliverability/domain** — mail lands in spam or is rejected despite a working pipeline.                                | Medium / High       | Dedicated domain + SPF/DKIM/DMARC before provider enable; `/admin/emails` delivery evidence; bounded retries; alert on dead letters; warm-up period before campaigns.          | Dead-letter rate >2%; provider complaint codes repeat.                          | Owner |
| R4  | **Old-instance drain blocks DI D4** — legacy columns never droppable because old instances keep serving.                       | Medium / Medium     | D4 is decoupled from launch (DI §8.3); health SHA + checksum canary evidence runbook ready; staged drop file prepared; never bundle the drop with a deploy.                    | Health SHA still serving old revision after >24 h.                              | Owner |
| R5  | **Free-tier quota** — D1 reads (or Worker requests) approach the daily cap as catalog/traffic grows.                           | Medium / Medium     | COM §5 guardrails (no N+1, PK lookups, cacheable reads); I18N cache with measured 60–85% target; monitor D1 row metrics; pull M6 earlier on pressure.                          | D1 reads >70% of daily limit; p95 latency up.                                   | Owner |
| R6  | **CSP breakage from analytics** — enforced CSP breaks PostHog or JSON-LD.                                                      | Medium / Medium     | Report-only first with E2E console watch; no `default-src` allowances; enforce only after zero violations (OPS §7.6). Phase 2 revisits CSP for Paymob.                         | Console violations during report-only cycle.                                    | Owner |
| R7  | **Runbook drift recurring** — docs again diverge from reality (already true for Pages Git integration, health endpoint).       | High / Low–Medium   | OPS task 0 truth pass; every phase close-out includes a docs diff; stale claims treated as defects.                                                                            | A doc statement contradicted by a verification query.                           | Owner |
| R8  | **Trigger loss / dual authority on `store_order`** — MS and DI both rebuild, losing 0016 triggers or leaving two vocabularies. | Low / High          | Arbitration C2/§3.1: one rebuild per release window; capture-and-recreate every trigger (DI Appendix A); replay tests assert triggers + default.                               | Two rebuild migrations staged at once; `paid` default still present after 0019. | Owner |
| R9  | **Secret misconfiguration outage (2026-08-22 class)** — invalid/absent secret reaches a deploy and 1101s production.           | Medium / High       | OPS preflight prints names only and runs before migrations; `verify-production` blocks deploy on SHA/health/header mismatch; env validation fails fast for selected providers. | Preflight warning; health version mismatch.                                     | Owner |
| R10 | **Claim backlog** — transfer claims pile up unreviewed and holds expire before verification.                                   | Medium / Medium     | Review-queue counters + daily digest; hold extension action; expiry releases stock exactly once.                                                                               | Claims older than 1 h rising; expired holds with open claims.                   | Owner |

---

## 10. Success criteria for the program

1. **Real settlement in production** — the live store records COD and manual transfer orders with
   admin-verified payment, no customer path to `paid`, and no simulated payment on new orders.
2. **Zero silently-lost emails** — every enqueue either delivers with a provider message id,
   retries within a bounded schedule, or lands in a visible dead-letter queue with an alert.
3. **Every production deploy is health-verified** — `verify-production` asserts the deployed SHA,
   `/api/health`, and security headers before the deploy is considered complete.
4. **No dual-authority schema** — one order-status vocabulary, one inventory unit (grams), one
   legacy-column fate, enforced by named constraints and single-owner arbitration.
5. **Returns, refunds, and coupons are operational** — customers can request returns, admins can
   record full manual refunds and restock inspected goods, and coupons apply with bounded,
   auditable redemptions.
6. **Public catalog is cacheable with measured D1 read reduction** — ≥70% cache-hit share and a
   60–85% drop in D1 reads on public paths at flat traffic (I18N §6).
7. **Observability is actionable** — dead letters, unreviewed claims, and backend health alerts
   reach the owner; backup/restore is rehearsed, not theoretical.
8. **Docs match reality** — runbook, architecture, decisions, and todo describe what is actually
   deployed; no known stale claim survives a phase gate.

---

## Appendix A — Gate command reference

| Gate                | Command(s)                                                   | Notes                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static check        | `vp check`                                                   | Format, lint, typecheck. Zero errors; warnings tracked.                                                                                                        |
| Unit/integration    | `vp test --run`                                              | Vitest via Vite+ (`package.json` `test:unit` is `vp test`). Includes `src/lib/server/db/migration-replay.spec.ts`.                                             |
| Migration replay    | `vp test --run` (full suite) or targeted via the replay spec | Replays the real `drizzle-kit migrate` chain into isolated libsql state; asserted per `docs/decisions.md` 2026-09-09.                                          |
| E2E                 | `vp run test:e2e`                                            | Installs Chromium and runs Playwright; builds are consumed via the CI artifact (`E2E_USE_BUILD=1`). Targeted: `pnpm exec playwright test tests/health.e2e.ts`. |
| Local D1 apply      | `pnpm d1:migrate`                                            | Applies journal migrations to the local D1.                                                                                                                    |
| Remote migration    | CI `migrate-production` job                                  | Only on `main`; production environment reviewers; runs after `test`/`e2e`.                                                                                     |
| Deploy verification | CI `verify-production` job (new in OPS)                      | Asserts `GITHUB_SHA`, health status, and headers after `deploy-production`.                                                                                    |
| Worker smoke        | `GET <worker-url>/`                                          | Returns `200 {"ok":true,"pending":N,"dead":M}` (EM §6).                                                                                                        |
| Canary              | Scheduled `production-probe` workflow (OPS)                  | Asserts `/` → `/ar` 301, both locale homes 200, sitemap hreflang (I18N §6).                                                                                    |
| Backup/restore      | `scripts/d1-backup.mjs` + restore drill runbook (OPS §3.7)   | Encrypted, off-repo, manifest verified; Time Travel bookmark recorded.                                                                                         |

## Appendix B — Companion spec section index

| Topic                                                                                                                | Citation                                                   |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| EM — send result, outbox schema, worker, provider, admin, decisions, tasks                                           | EM §3.1, §3.2, §3.5, §3.6, §3.9, §8, §9                    |
| MS — state machines, hold and expiry, COD and transfer flows, claims, admin audit, rollout, decisions, tasks         | MS §3.1, §3.2, §3.3, §3.4, §3.5, §3.6, §4, §8, §9          |
| PAY (deferred) — Paymob gateway design, preserved for phase 2                                                        | PAY, deferred — do not build                               |
| DI — status default, catalog authority, inventory units, movements, constraints, rollout, decisions, tasks           | DI §3.1, §3.2, §3.3, §3.4, §3.5, §4, §8, §9                |
| OPS — headers, throttling, escaping, verification, CI safety, supply chain, backups, observability, decisions, tasks | OPS §3.1, §3.2, §3.3, §3.4, §3.5, §3.6, §3.7, §3.8, §7, §8 |
| COM — area designs, sequencing, cost guardrails, decisions, tasks                                                    | COM §3a–3h, §4.2, §4.3, §5, §6, §7                         |
| I18N — routing, language resolution, SEO, caching, rollout, metrics, decisions, tasks                                | I18N §3.1, §3.2, §3.3, §3.4, §4, §6, §8, §9                |

---

_This document supersedes no companion spec in full; it arbitrates their intersections and
sequences them into one program. Amendments require a dated ADR in `docs/decisions.md` and a
corresponding update to §3 of this file._
