# Production deploy runbook

This runbook is the operational contract for shipping the website to
production. It covers the deploy chain in `.github/workflows/ci.yml`, the
external setup that must be completed before any merge to `main` actually
deploys, and the rollback path when a deploy goes wrong.

## How the deploy chain works

A single GitHub Actions workflow (`.github/workflows/ci.yml`) owns every
production change. Cloudflare Pages' built-in Git integration must be
**disabled** (see [External setup required](#external-setup-required)) so
the workflow is the only thing that touches production.

```
push / PR to main
        │
        ▼
   ┌─────────┐         fail-fast on lint / type / unit / migration-replay / build
   │  test   │ ───────────────────────────────────────────────────────┐
   └────┬────┘                                                        │
        │  on success: upload .svelte-kit/cloudflare artifact          │
        ├──────────────────────────────┐                               │
        ▼                              ▼                               ▼
   ┌─────────┐                  ┌──────────────────┐            (PR build artifact
   │   e2e   │ (needs test)     │ migrate-prod     │             only, never
   └────┬────┘                  │ (needs test+e2e,│             deployed)
        │                       │  main push only) │
        │                       └────────┬─────────┘
        │                                │
        ▼                                ▼
   ┌──────────────────────────┐   environment: production
   │      deploy-prod         │   (required reviewers)
   │ (needs test+e2e+migrate, │
   │  main push only)         │
   └────────────┬─────────────┘
                ▼
        wrangler pages deploy
        from the checked build
        downloaded by deploy-prod
```

Key guarantees baked into the workflow:

- **Single owner of migration + deploy.** The Pages git integration is
  off, so only this workflow mutates production D1 and the deployed Pages
  artifact.
- **Same checked build, no drift.** `test` runs the E2E suite against the
  `.svelte-kit` build it just produced, then uploads `.svelte-kit/cloudflare`,
  `.svelte-kit/output/server`, and `.svelte-kit/cloudflare-tmp` as an
  artifact; `deploy-prod` downloads that exact same artifact instead of
  rebuilding. E2E sets `E2E_USE_BUILD=1`; local runs still build by default.
- **Isolated E2E runtime bindings.** `scripts/e2e-server.mjs` launches the
  installed Wrangler CLI from a throwaway runtime dir in the OS temp
  directory where `scripts/e2e-setup.mjs` copied `wrangler.jsonc` and wrote
  an isolated `.dev.vars`, so `wrangler pages dev` loads our generated test
  secrets from the config dir instead of any real `.dev.vars`. Playwright
  waits for `/api/health` (including a D1 query) and prints both server
  output streams so startup failures are visible.
- **Race-free ordering.** `migrate-prod` runs before `deploy-prod` in the
  same workflow and only after `test` succeeds, so the new Worker code never
  starts against an old schema and no migration ships against a failed
  suite.
- **One deploy at a time.** Top-level
  `concurrency: { group: production, cancel-in-progress: false }`
  queues concurrent merges and never abandons an in-flight deploy.
- **Least-privilege tokens.** Top-level `permissions: contents: read`. The
  Cloudflare API token only lives in the wrangler-action steps.
- **Timeouts on every job.** A hung step is killed (test: 20m, e2e: 45m,
  migrate-prod: 10m, deploy-prod: 20m) instead of burning the 6-hour
  workflow ceiling.
- **Failure evidence on e2e.** Playwright report and `test-results/` are
  uploaded as a 14-day-retained artifact whenever the e2e job fails.

## External setup required

These are manual one-time steps. Until all of them are done, the deploy
job will refuse to run (no secrets → wrangler-action fails to authenticate;
no reviewers → environment gate holds the run).

### 1. Disable Cloudflare Pages Git integration

The Pages project auto-deploys on push to `main` today. That independent
deploy races the workflow's `migrate-prod` step (Pages can ship new Worker
code before the matching D1 migrations land). Disable it so the workflow
is the only deployer.

1. Cloudflare dashboard → **Workers & Pages** → project
   `beeking-etman-website`.
2. **Settings** → **Builds** → **Build configurations**.
3. Either:
   - Disable the production branch build entirely, **or**
   - Detach the GitHub repo from the Pages project (Settings → **Connected
     Git repository** → **Disconnect**).

Verify by pushing to a non-`main` branch and confirming no deploy is
triggered. Verify again by pushing to `main`: only the GitHub Actions run
should produce a deploy.

### 2. Configure required secrets

Repository or environment-level secrets (Settings → Secrets and variables
→ Actions → `production` environment):

| Secret                  | Required by                   | Notes                                                                                                                                                           |
| ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `migrate-prod`, `deploy-prod` | Token with `Account.Workers Scripts:Edit`, `Account.D1:Edit`, and `Account.Account Settings:Read` scopes (or the equivalent `Cloudflare Pages: Edit` template). |
| `CLOUDFLARE_ACCOUNT_ID` | `migrate-prod`, `deploy-prod` | Account ID of the Cloudflare account that owns the Pages project.                                                                                               |

No other secrets are needed at the workflow level: production secrets
(BETTER_AUTH_SECRET, ORDER_ACCESS_SECRET, ORIGIN, ADMIN_EMAIL,
EMAIL_API_KEY, SMTP_HOST) live in the Pages project's **Settings →
Variables and Secrets** and are not visible to the workflow.

### 3. Configure the `production` environment with required reviewers

1. Repository **Settings** → **Environments** → **New environment** →
   name: `production`.
2. **Required reviewers**: add at least one operator who must approve
   every `migrate-prod` and `deploy-prod` run. Both jobs set
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
cancel-restock trigger would restock twice. Drain old instances first, then
the migration can rewrite `paid` → `placed` and drop the legacy path.

### Normal deploy

1. Open a PR against `main`. The `test` and `e2e` jobs run on the PR
   head; neither `migrate-prod` nor `deploy-prod` runs.
2. Merge the PR. On the merge commit the `test`, `e2e`,
   `migrate-prod`, and `deploy-prod` jobs queue under the
   `production` concurrency group (single-flight). `migrate-prod`
   waits for both `test` and `e2e` to succeed before it starts.
3. Reviewers approve the `production` environment for both
   `migrate-prod` and `deploy-prod`. Each approval is a separate click.
4. `migrate-prod` applies any pending Drizzle migrations to remote D1.
   Idempotent: a no-op if nothing is pending.
5. `deploy-prod` downloads the `cloudflare-build` artifact and runs
   `wrangler pages deploy` against it, using only the commit hash (no
   interpolated commit message) so the command cannot break on special
   characters.
6. Smoke-test the production URL.

### Hotfix

Same as a normal deploy but on a branch cut from `main`. The
`production` concurrency group will queue behind any in-flight deploy and
wait for it (`cancel-in-progress: false`); it will not cancel the existing
run.

### Rollback

Rollback is a code change, not a UI click:

1. Identify the bad commit (`git log --oneline -20 main`).
2. `git revert <bad-sha>` on a fresh branch, push, merge.
3. The workflow re-runs: `migrate-prod` is a no-op if no schema changed,
   and `deploy-prod` ships the previous build back. If the bad deploy
   shipped a destructive migration, write the inverse migration in
   `drizzle/` first so the revert also rolls the schema back; otherwise
   the rolled-back Worker code will hit a new schema.

### Inspecting a failed deploy

- `Actions` tab → run → `deploy-prod` job. The wrangler-action step
  prints the rejected deployment.
- Cloudflare dashboard → **Workers & Pages** → project → **Deployments**
  shows every successful and failed deployment with its commit hash.
- `migrate-prod` failures show the rejected migration name; the D1
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
