# Production deploy runbook

This runbook is the operational contract for shipping the website to
production. It covers the deploy chain in `.github/workflows/ci.yml`, the
external setup that must be completed before any merge to `main` actually
deploys, and the rollback path when a deploy goes wrong.

## How the deploy chain works

A single GitHub Actions workflow (`.github/workflows/ci.yml`) owns every
production change. The Pages Git integration is already disconnected (verified
`source: null`; roadmap §1.2), and step 1 below confirms it stays that way, so
the workflow is the only thing that touches production.

```
push / PR to main
        │
        ▼
   ┌────────────────────────────────────────────────┐
   │ test (45m)                                     │
   │ check · unit · coverage · migration replay ·   │
   │ build · Playwright (E2E_USE_BUILD=1)           │
   └──────┬─────────────────────────────────────────┘
          │ on success: upload the cloudflare-build artifact
          ▼  (main push only)
   ┌─────────────────────────┐   environment: production
   │ migrate-production (10m)│   (required reviewers)
   │ needs: test             │
   └───────────┬─────────────┘
               ▼
   ┌───────────────────────────────┐   environment: production
   │ deploy-production (20m)       │   (required reviewers)
   │ needs: test + migrate-        │
   │ production; downloads the     │
   │ cloudflare-build artifact     │
   └───────────┬───────────────────┘
               ▼
       wrangler pages deploy
       from the checked build
```

PRs run `test` only. `migrate-production` and `deploy-production` run only on
pushes to `main`.

Key guarantees baked into the workflow:

- **Single owner of migration + deploy.** The Pages Git integration is
  disconnected (`source: null`), so only this workflow mutates production D1
  and the deployed Pages artifact.
- **Same checked build, no drift.** `test` runs the E2E suite against the
  `.svelte-kit` build it just produced, then uploads `.svelte-kit/cloudflare`,
  `.svelte-kit/output/server`, and `.svelte-kit/cloudflare-tmp` as the
  `cloudflare-build` artifact; `deploy-production` downloads that exact
  artifact into `.svelte-kit` instead of rebuilding. E2E sets
  `E2E_USE_BUILD=1`; local runs still build by default.
- **Isolated E2E runtime bindings.** `scripts/e2e-server.mjs` launches the
  installed Wrangler CLI from a throwaway runtime dir in the OS temp
  directory where `scripts/e2e-setup.mjs` copied `wrangler.jsonc` and wrote
  an isolated `.dev.vars`, so `wrangler pages dev` loads our generated test
  secrets from the config dir instead of any real `.dev.vars`. Playwright
  waits for `/api/health` (including a D1 query) and prints both server
  output streams so startup failures are visible.
- **Race-free ordering.** `migrate-production` runs after `test` succeeds and
  before `deploy-production`, so the new Worker code never starts against an
  old schema and no migration ships against a failed suite.
- **One deploy at a time.** Top-level
  `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: false }`
  queues runs per ref and never abandons an in-flight deploy.
- **Least-privilege tokens.** Top-level `permissions: contents: read`. The
  Cloudflare API token only lives in the wrangler-action steps.
- **Timeouts on every job.** A hung step is killed (test: 45m,
  migrate-production: 10m, deploy-production: 20m) instead of burning the
  6-hour workflow ceiling.
- **Evidence on every run.** The coverage report uploads as `coverage-report`
  and the Playwright report plus `test-results/` as `playwright-report`, both
  14-day-retained with `if: always()`, so failure evidence survives a timeout.

## External setup required

These are the manual setup and verification steps. The production jobs cannot
run until the secrets exist and reviewers are configured (no secrets →
wrangler-action fails to authenticate; no reviewers → environment gate holds
the run).

### 1. Verify the Pages Git integration stays disconnected

The Pages project is Direct Upload only: no Git repository is attached
(`source: null`, verified 2026-09-13; roadmap §1.2 and OPS spec §1, gap 10).
There is no auto-deploy to disable.

Confirm before the first production deploy, and re-check after any Pages
project change:

1. Cloudflare dashboard → **Workers & Pages** → project
   `beeking-etman-website` → **Settings**. **Connected Git repository** must
   show no repository.
2. If a repository has been reconnected, disconnect it (**Settings** →
   **Connected Git repository** → **Disconnect**). A connected repo would race
   `migrate-production`: Pages can ship new Worker code before the matching D1
   migrations land.
3. Verify by pushing to a non-`main` branch: no deploy should trigger. A push
   to `main` must produce a deploy only through the GitHub Actions run.

An API-based check needs a token with Pages Read; extending the CI token scope
is tracked as OPS-8. The dashboard check needs no token.

### 2. Configure required secrets

Repository or environment-level secrets (Settings → Secrets and variables
→ Actions → `production` environment):

| Secret                  | Required by                               | Notes                                                                                                                                                           |
| ----------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `migrate-production`, `deploy-production` | Token with `Account.Workers Scripts:Edit`, `Account.D1:Edit`, and `Account.Account Settings:Read` scopes (or the equivalent `Cloudflare Pages: Edit` template). |
| `CLOUDFLARE_ACCOUNT_ID` | `migrate-production`, `deploy-production` | Account ID of the Cloudflare account that owns the Pages project.                                                                                               |

No other secrets are needed at the workflow level: production secrets
(BETTER_AUTH_SECRET, ORDER_ACCESS_SECRET, ORIGIN, ADMIN_EMAIL) live in the
Pages project's **Settings → Variables and Secrets** and are not visible to
the workflow.

### 3. Configure the `production` environment with required reviewers

1. Repository **Settings** → **Environments** → **New environment** →
   name: `production`.
2. **Required reviewers**: add at least one operator who must approve
   every `migrate-production` and `deploy-production` run. Both jobs set
   `environment: production` so a missing approval holds the run.
3. Optionally add **Deployment branches**: branch `main` only.

### 4. Confirm Pages project settings

- `wrangler.jsonc` declares `pages_build_output_dir: ".svelte-kit/cloudflare"`
  and a single D1 database binding (`beeking`). Confirm these match the
  Pages project in the dashboard; drift here causes wrangler-action to
  deploy against the wrong D1.
- Production env vars (see step 2) exist in the Pages project, not in the
  workflow.

## Day-to-day operations

### Legacy catalog columns & staged cleanup

`store_product.price/stock/image` are no longer read or written by the app.
Migration `0017_catalog_authority` (applies automatically with the journal)
backfills every legacy cover into the gallery and installs triggers
(`store_product_legacy_cover_insert/update`) that route any old-app cover
write into the gallery. Product-level price/stock writes from an old instance
are intentionally ignored; variant rows stay authoritative.

**Do NOT apply the staged column drop during normal deploys.** It lives at
`drizzle/staged/0017_drop_legacy_product_columns.sql` and is deliberately not
in the drizzle journal. Applying it while an old build is live breaks that
build's `SELECT ... image` storefront queries. After every old instance is
fully drained, run once:

```sh
wrangler d1 execute beeking --remote --file=drizzle/staged/0017_drop_legacy_product_columns.sql
```

Order safety during overlap: while any old app instance may still serve
requests, do **not** administratively cancel orders created by the new build
(`stock_version = 'atomic'`) — an old instance's manual restock plus the new
cancel-restock trigger would restock twice. Drain old instances first;
`0019_settlement` ships the settlement schema with no backfill and keeps the
legacy `placed`/`paid`/`simulated` values as read aliases.

Two more staged, drain-gated items are not in the journal:

- `store_blend_benefit` (migration 0013) has no readers after the blend-studio
  retirement (AgDR-0002). Its drop ships as a staged migration after drain; no
  v1 migration removes it.
- The pre-settlement `paid` → `placed` status backfill
  (`drizzle/staged/after_drain_status_backfill.sql`) is superseded by
  `0019_settlement` and is not present in this tree. Never run it after 0019 is
  applied: 0019 already ships the legacy read aliases.

### Normal deploy

1. Open a PR against `main`. The `test` job runs on the PR head;
   `migrate-production` and `deploy-production` do not run (they require a
   push to `main`).
2. Merge the PR. On the merge commit, `test` runs first and
   `migrate-production` starts only after it succeeds. Runs queue in the
   `ci-${{ github.ref }}` concurrency group (`cancel-in-progress: false`), so
   a merge waits behind any in-flight run on `main`.
3. Reviewers approve the `production` environment for
   `migrate-production` and then for `deploy-production`. Each approval is a
   separate click.
4. `migrate-production` applies any pending Drizzle migrations to remote D1
   (`wrangler d1 migrations apply beeking --remote`). Idempotent: a no-op if
   nothing is pending.
5. `deploy-production` downloads the `cloudflare-build` artifact and runs
   `wrangler pages deploy .svelte-kit/cloudflare --project-name
beeking-etman-website --branch main --commit-hash <sha>
--commit-dirty=false`, so the deploy carries no interpolated commit
   message.
6. Smoke-test the production URL.

### Coverage floor

`pnpm run test:coverage` runs the server test project with coverage, writes
`coverage/` (text summary + html + lcov), and fails on a threshold regression.
CI runs the same command after the unit tests and uploads the report as the
`coverage-report` artifact.

The floor covers the manual-settlement modules
(`src/lib/server/settlement/**` plus `src/lib/server/admin/settlement.ts`) and
was measured on 2026-09-20 (GH #14):

| Scope                          | Statements | Branches | Functions | Lines  |
| ------------------------------ | ---------- | -------- | --------- | ------ |
| Settlement modules (aggregate) | 96.57%     | 94.11%   | 100%      | 96.62% |
| Configured floor               | 95%        | 90%      | 95%       | 95%    |

Per-file floors for the key settlement files sit just below each measured
value, so a real regression fails the run while normal refactors do not.
`claims.ts` carries the lowest floor (80% lines / 75% branches) because its
concurrent-claim fallback is defensive rather than a primary path.
`src/lib/server/email.ts` stays out of scope: it measures 75.47% lines /
54.16% branches, and folding it in would hide settlement regressions behind
unrelated email gaps. Raising the floor requires re-measuring and updating this
section in the same PR.

### Settlement operations

The manual-settlement flow (AgDR-0001) records COD and transfer orders, holds
stock to a deadline, and verifies payment by hand. Read the architecture
"Data model" and "Notable behavior" sections before operating it.

#### Go-live checklist

- [ ] Configure the Pages project environment (Settings → Variables and
      Secrets): `WHATSAPP_NUMBER` (international format, required for the
      WhatsApp CTAs), `PAYMENT_INSTAPAY_ADDRESS` and `PAYMENT_WALLET_NUMBER`
      (each method is offered only when its value is set),
      `ORDER_HOLD_MINUTES` (default `1440`), optional `COD_HOLD_MINUTES`, and
      `PAYMENTS_COD_ENABLED` (`false` removes COD; default `true`). Local
      placeholder values for all six variables live in `.dev.vars.example`.
- [ ] Insert the production `blends` category (AgDR-0002). The seed refuses to
      run once orders exist, so the row is inserted directly (idempotent):
      `sh
wrangler d1 execute beeking --remote --command "INSERT INTO store_category (id, name, name_en, slug, department) VALUES (lower(hex(randomblob(16))), 'خلطات جاهزة', 'Ready-made blends', 'blends', 'honey') ON CONFLICT(slug) DO NOTHING"
`
      Verify: `/blends` returns 301 to `/honey/blends`, the `خلطات جاهزة` chip
      appears on `/honey`, and `/honey/blends` is listed in `/sitemap.xml`.
- [ ] Run `pnpm run test:coverage` and confirm the settlement floor is green
      (see "Coverage floor" above).
- [ ] Run one claim smoke against a deployed D1 and confirm the claim appends
      exactly one `store_payment_event` row. The #14 e2e already runs a real
      claim through the miniflare D1 artifact in CI; no staging project exists,
      so this production smoke remains an owner action.
- [ ] Know the gap: **the hold-expiry job is inactive.** Cloudflare Pages has
      no cron runtime and the EM-4 email worker does not exist, so
      `runSettlementJobs` is never called in production. Stock holds are
      released only when the worker ships (SET-7/EM-4).

#### Review queue

Transfer claims land as `pending_review` orders. Open
`/admin/orders?payment=pending_review` (the orders list also carries a
review-queue shortcut), then open the order: the settlement panel shows the
claim reference and the event timeline.

- **Verify:** match the claimed amount and reference against the receiving
  account, enter a reference or a note, and submit **mark paid**
  (`?/mark_paid`). This is the only path that sets `paid`.
- **Reject:** enter a note and submit **reject claim** (`?/reject_claim`). The
  order moves to `failed`; the customer may submit a corrected claim from the
  success page.
- Both actions write a `store_payment_event` row, a best-effort asynchronous
  admin audit row, and a customer email through the outbox.

To inspect the queue directly:

```sh
wrangler d1 execute beeking --remote --command "SELECT id, number, payment_method, payment_reference, payment_claimed_at FROM store_order WHERE payment_status = 'pending_review' ORDER BY payment_claimed_at"
```

#### Hold expiry

`releaseExpiredHolds` (exposed as `runSettlementJobs`) cancels orders whose
`hold_expires_at` passed more than the 5-minute grace window:

- `pending_confirmation` orders of any method, and
- `confirmed`/`processing` transfer orders whose payment is still
  `unpaid`/`pending_review`.

Only `stock_version = 'atomic'` rows are selected. The cancellation flips the
order to `cancelled`, appends an `expiry` event, and the 0019 restock trigger
returns the reserved stock exactly once. A `pending_review` claim becomes
`failed`.

**The job is not wired yet.** It runs only from the EM-4 worker's
`scheduled()` handler (SET-7/EM-4). Until that worker deploys, holds never
expire in production and stock stays reserved indefinitely.

To verify a release (after EM-4 ships, or after invoking the job manually):

```sh
wrangler d1 execute beeking --remote --command "SELECT id, number, status, payment_status, hold_expires_at FROM store_order WHERE id = '<order-id>'"
wrangler d1 execute beeking --remote --command "SELECT type, actor, created_at FROM store_payment_event WHERE order_id = '<order-id>' ORDER BY created_at"
```

The order must be `cancelled` with exactly one `expiry` event and its variant
stock restored.

#### Refund recording

Refunds are recording-only and full-amount only; the shop returns the money
manually on the original payment rail. Open a `paid` order, enter the refund
reference and a note, and submit **refund** (`?/refund`). The action moves
`paid` → `refunded`, appends a `refund` event, writes the best-effort audit
row, and enqueues the customer email. It never restocks and never changes the
fulfillment status. Partial refunds are out of v1 (AgDR-0001).

#### Security posture (settlement, 2026-09-20, GH #15)

The manual-settlement security review returned **NO BLOCKERS**. Fixed in the
#15 pass:

- `devalue` lockfile bump (5.9.0 → 5.9.4).
- Customer email addresses removed from the `EMAIL binding unavailable`
  warning in `src/lib/server/email.ts`.
- The claim IP limiter now runs before the order lookup on
  `/checkout/success/[id]`, so lookups cannot bypass the per-IP bucket.
- The claim reference sanitizer strips C1 controls, Unicode format characters,
  and line/paragraph separators.
- Admin invoice and orders-CSV responses send `Cache-Control: private,
no-store`.

Findings mapped to existing tickets:

| Finding                                                                                    | Tracking       |
| ------------------------------------------------------------------------------------------ | -------------- |
| Admin audit writes are best-effort and async; prove durability across every mutation route | M4-1           |
| Password-reset email rendering and escaping                                                | OPS-1 / OPS-2  |
| Per-account (not only per-IP) login throttling                                             | OPS-3          |
| Security headers / CSP                                                                     | OPS-9 / OPS-10 |
| Hold-expiry worker absent (no cron runtime)                                                | SET-7 / EM-4   |

### Hotfix

Same as a normal deploy but on a branch cut from `main`. Once merged, the run
joins the `ci-${{ github.ref }}` concurrency group
(`cancel-in-progress: false`), so it queues behind any in-flight run on `main`
and never cancels one.

### Rollback

Rollback is a code change, not a UI click:

1. Identify the bad commit (`git log --oneline -20 main`).
2. `git revert <bad-sha>` on a fresh branch, push, merge.
3. The workflow re-runs: `migrate-production` is a no-op if no schema changed,
   and `deploy-production` ships the previous build back. If the bad deploy
   shipped a destructive migration, write the inverse migration in
   `drizzle/` first so the revert also rolls the schema back; otherwise
   the rolled-back Worker code will hit a new schema.

### Inspecting a failed deploy

- `Actions` tab → run → `deploy-production` job. The wrangler-action step
  prints the rejected deployment.
- Cloudflare dashboard → **Workers & Pages** → project → **Deployments**
  shows every successful and failed deployment with its commit hash.
- `migrate-production` failures show the rejected migration name; the D1
  migrations table (`wrangler d1 execute beeking --remote --command
"SELECT * FROM d1_migrations"`) records what applied.

## What this workflow deliberately does NOT do

- **No automatic rollback on health-check failure.** A bad deploy is
  rolled back via a revert PR (see above). Adding automated rollback
  requires a real readiness probe against the deployed URL, which is out
  of scope for this workflow.
- **No dependency audit / secret scanning step.** Recommended as separate
  scheduled jobs in a follow-up; the current workflow keeps deploys
  focused on the migration + build artifact chain.
- **No preview deploys.** Preview environments would need their own
  Cloudflare project and a separate workflow; today every push to `main`
  is production-only.
