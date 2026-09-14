# Email Delivery Pipeline — Design Spec

**Date:** 2026-09-13
**Status:** Proposed (implementation plan input)
**Scope:** Make every transactional email verifiably delivered (or explicitly dead-lettered) in production.
**Owner context:** Paymob (Phase 1) is a separate spec. COD is removed permanently. Free tier is preferred; a separate Worker with a Cron Trigger is acceptable (Pages cannot run cron).
**Repo docs:** English.
**Roadmap:** `docs/superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md` is authoritative for cross-spec arbitration (migration numbering, single ownership); migration `0018` is frozen there.

---

## 1. Context & current state

### 1.1 The bug: production sends are no-ops marked `sent`

`sendEmail()` (`src/lib/server/email.ts:33-52`) resolves the Cloudflare Email Service binding from
`platform?.env.EMAIL`. When the binding is absent — which is **always** in production, because
Cloudflare Pages cannot bind `send_email` (documented in `wrangler.jsonc:25-28` and
`docs/todo.md:462-464`) — the function logs a warning and returns **without throwing**
(`email.ts:38-41`).

`flushOutbox()` (`email.ts:90-120`) then treats that silent return as success:

- it calls `sendEmail(...)` at `email.ts:102`,
- on return it writes `status = "sent", sentAt = Date.now()` at `email.ts:108-111`,
- only a thrown error reaches the catch that writes `failed` (`email.ts:112-118`).

There is no provider message id anywhere in the schema or the code, so "sent" today means
"the local function returned", not "an email provider accepted the message".

### 1.2 Production reality

- Every production checkout calls `sendOrderConfirmation` (`src/routes/checkout/+page.server.ts:124-129`),
  which enqueues the customer confirmation **and** the `ADMIN_NOTIFY_EMAILS` digest
  (`email.ts:235-239`), then flushes inline (`email.ts:239`).
- Every admin status change calls `sendOrderStatusUpdate`
  (`src/routes/admin/orders/[id]/+page.server.ts:64-69`), which enqueues then flushes
  (`email.ts:558-559`).
- Password reset (`src/lib/server/auth.ts:28-83`) calls `sendEmail()` directly and fire-and-forget
  (`auth.ts:75-82`) — also a silent no-op in production. A customer who requests a reset gets no
  email at all.
- `docs/todo.md:462-464` claims "outbox rows accumulate as `pending`". This is **wrong**: there
  is no live `pending` backlog, because `flushOutbox` immediately marks the rows `sent` after the
  silent no-op. The todo item must be corrected when this spec is implemented.

### 1.3 Blast radius

1. **Every customer email since the outbox shipped (2026-09-02) is silently lost** — order
   confirmations, status updates, admin digests — while `store_notification.status = 'sent'`
   asserts the opposite. The failure is invisible to admins and to any queue-depth monitoring.
2. **Dead rows are terminal.** Even with a binding present, `failed` rows (`email.ts:116-117`) are
   never retried; the "durable outbox" is enqueue-durable but delivery- non-durable.
3. **No send is idempotent.** A crash between provider acceptance and the status update would
   resend on the next drain, because neither `flushOutbox` nor the provider call carries an
   idempotency key (schema has no message id — `src/lib/server/db/schema.ts:352-371`).
4. **`EMAIL_API_KEY` / `SMTP_HOST` warnings were misleading and are already removed.** The
   `src/lib/server/env.ts` cleanup (2026-09-13) deleted the two warnings about variables that no
   code read. The real delivery env surface (`EMAIL_FROM`, provider key) is specified in §3.7.
5. **Recovery is impossible for the lost rows.** The outbox did not store a provider message id, so
   past sends cannot be audited or resent; the payload survives but the delivery evidence does not.

### 1.4 Why the current architecture cannot be fixed in place

- Pages cannot run a Cron Trigger and cannot bind `send_email`, so a **separate Worker** is the
  only in-platform way to drain an outbox on a schedule.
- Cloudflare Email Service sending to arbitrary recipients requires the **Workers Paid plan**
  (docs: "Outbound emails (Email Sending): Not available on Workers Free") and a sending domain
  onboarded on the account; the project is on Pages free with a `pages.dev` host and no custom
  domain. Cloudflare itself is therefore not a free-tier option for customer email today.

---

## 2. Goals / Non-goals

### Goals

1. An email is marked `sent` **only after** a provider returned a `provider_message_id`.
2. Transient failures retry with exponential backoff + jitter; exhausted rows are dead-lettered
   and visible.
3. Sends are idempotent across retries and worker reentrancy.
4. The app request path **enqueues only** — no inline flush, no provider latency in the user
   request, no silent success.
5. Password reset routes through the same pipeline, with an operator-visible delivery state.
6. Admins can see failed/dead rows and trigger a manual resend.
7. Works on the Workers Free plan (provider allowing) or inside a clearly stated budget.
8. On-call signal: dead letters and queue staleness must produce an alert, not silence.

### Non-goals

- Paymob payment emails (separate Phase 1 spec).
- Marketing/broadcast email, templates platform, open/click analytics.
- Inbound email, replies, bounce/complaint webhooks (a future extension of the provider adapter;
  see §3.5 for why the design stays webhook-free now).
- Multi-provider failover or per-recipient routing.
- Migrating Better Auth to a provider-native SMTP transport (decided against in §3.6; revisit only
  if provider SMTP becomes a hard requirement).

---

## 3. Proposed design

### 3.1 Send result type — no more silent success

Replace `Promise<void>` with an explicit result at the provider boundary. The outbox state
machine consumes this type; it is the single place that decides `sent` vs retry vs dead.

```ts
// src/lib/server/email-provider.ts (shared by app and worker; no SvelteKit imports)
export interface EmailPayload {
  to: string;
  from: string; // "Beeking Etman <orders@…>"
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string; // stable per outbox row, e.g. "order-confirmation/<orderId>"
}

export type SendResult =
  | { kind: "delivered"; providerMessageId: string }
  | { kind: "provider_missing" }
  | { kind: "retryable_error"; code: string; message: string }
  | { kind: "permanent_error"; code: string; message: string };

export interface EmailProvider {
  send(payload: EmailPayload): Promise<SendResult>;
}
```

Mapping rules (documented, tested, never inferred at the call site):

| Provider response                                                                  | Result                            |
| ---------------------------------------------------------------------------------- | --------------------------------- |
| 2xx with `id`                                                                      | `delivered` + `providerMessageId` |
| 5xx, 429 (general), network error, timeout                                         | `retryable_error`                 |
| 400/422 invalid recipient or payload; 401/403 bad key **after** key presence check | `permanent_error`                 |
| Adapter constructed but `RESEND_API_KEY` unset/blank                               | `provider_missing`                |

`provider_missing` is handled by the drain logic (never by the provider adapter) so a missing
secret can never be confused with a sent message.

### 3.2 Outbox schema evolution (migration `drizzle/0018_email_delivery.sql`)

`store_notification` (`schema.ts:352-371`) keeps its role and gains delivery columns. The table is
tiny and currently poison-tainted (rows falsely marked `sent`), so a rebuild — the same pattern
`0016_order_hardening.sql:3-23` already uses — is acceptable and lets us add a real CHECK.

Target DDL:

```sql
CREATE TABLE `store_notification_new` (
  `id`                  text PRIMARY KEY NOT NULL,
  `type`                text NOT NULL,                -- OutboxType (canonical union, §3.3); legacy rows keep historical values
  `channel`             text NOT NULL DEFAULT 'email',
  `recipient`           text NOT NULL,
  `from_address`        text NOT NULL DEFAULT '',       -- snapshot of sender identity
  `subject`             text NOT NULL,
  `body`                text NOT NULL,                  -- JSON {html,text}
  `status`              text NOT NULL DEFAULT 'pending'
                        CHECK (`status` IN ('pending','sending','sent','failed','dead')),
  `attempt_count`       integer NOT NULL DEFAULT 0,
  `next_attempt_at`     integer,                        -- epoch ms; NULL = parked
  `last_error`          text,                           -- truncated, redacted
  `provider_message_id` text,
  `locked_at`           integer,                        -- lease owner timestamp, epoch ms
  `idempotency_key`     text,                           -- stable per logical email
  `created_at`          integer NOT NULL,
  `sent_at`             integer
);
INSERT INTO store_notification_new (...) SELECT ..., 'sent' AS status, ... FROM store_notification;
-- Backfill: legacy `sent` rows get provider_message_id NULL and remain sent = unverifiable.
DROP TABLE store_notification;
ALTER TABLE store_notification_new RENAME TO store_notification;
CREATE INDEX store_notification_type_idx ON store_notification (`type`);
CREATE INDEX store_notification_due_idx ON store_notification (`status`, `next_attempt_at`);
CREATE INDEX store_notification_created_idx ON store_notification (`created_at`);
CREATE UNIQUE INDEX store_notification_idem_idx ON store_notification (`idempotency_key`)
  WHERE `idempotency_key` IS NOT NULL;
```

Justification for each decision, and what was rejected:

- **Status stays 5 values, not the original 3.** `sending` is required so a lease claim is visible;
  `dead` is required so "never auto-retry again" is distinguishable from "failed, will retry".
  `legacy_unverified` was considered and rejected: it would permanently widen the CHECK for a
  one-time condition. Legacy `sent` rows stay `sent`; their unreliability is documented here and
  in the migration comment instead.
- **`next_attempt_at` NULL = parked.** Used for `provider_missing` (waiting for
  `RESEND_API_KEY`) and for manual-only holds; the due query simply requires it to be non-NULL and
  due. A separate `parked` status was rejected as redundant.
- **`locked_at` lease, not a boolean.** A worker can die mid-send; the lease expiry lets the next
  run reclaim the row (`status='sending' AND locked_at < now - 300_000`). A `locked` boolean
  needs a second cleanup process.
- **Partial unique index on `idempotency_key`.** SQLite treats NULLs as distinct, so legacy rows
  (NULL key) coexist; new rows get a key generated by the enqueue helper.
- **No webhook/event columns.** Resend delivery events require a webhook receiver + signing secret
  and buy us nothing until bounce handling is a requirement. Out of scope; the adapter and
  `provider_message_id` leave the door open.

Drizzle schema (`schema.ts`) mirrors the DDL, including the CHECK via `sql` raw in the table
definition (as `0016` does for order items) and the two new indexes.

### 3.3 Enqueue helper (app side)

`enqueueEmail` moves out of the SvelteKit-tainted `src/lib/server/email.ts` into
`src/lib/server/outbox.ts`. This is the **single exported enqueue interface** and the canonical
`OutboxType` union; all companion specs (payments, commerce, ops) consume both **verbatim**:

```ts
export type OutboxType =
  | "order_received"
  | "payment_confirmed"
  | "payment_failed"
  | "status_update"
  | "refund"
  | "admin_alert"
  | "password_reset"
  | "verification"
  | "ops_alert"
  | "review_approved"
  | "low_stock"
  | "return_requested"
  | "return_status";

export async function enqueueEmail(
  db: LibSQLDatabase<typeof schema>,
  email: { recipient: string; subject: string; html: string; text: string; from?: string },
  opts: { type: OutboxType; idempotencyKey: string },
): Promise<{ id: string }>;
```

The union is one value per lifecycle event family (kept minimal on purpose): `return_*` is
instantiated as `return_requested` (admin alert) and `return_status` (customer decisions/progress);
adding a value requires an ADR in `docs/decisions.md`.

- `idempotencyKey` is **required** so a duplicate call is a single row
  (`INSERT … ON CONFLICT(idempotency_key) DO NOTHING`). Callers use:
  - `order-confirmation/${orderId}`
  - `order-admin/${orderId}/${recipient}`
  - `order-status/${orderId}/${newStatus}`
  - `password-reset/${userId}/${Date.now()}` (each reset request is a new logical send)
  - `ops-alert/${bucket}`
- Sets `next_attempt_at = Date.now()` so a fresh row is immediately due.
- Validates `recipient` with a shared `isPlausibleEmail` plus CRLF rejection before insert; a row
  that cannot be sent is rejected at the boundary, not later by the worker.
- `from_address` snapshots `env.EMAIL_FROM ?? configured default` at enqueue time.

`sendOrderConfirmation` and `sendOrderStatusUpdate` become enqueue-only: they resolve order data,
build HTML/text, call `enqueueEmail`, and **remove** the `flushOutbox` calls
(`email.ts:239`, `email.ts:559`). `flushOutbox` itself is deleted; its replacement `drainOutbox`
lives in the worker-shared module (§3.4). In the request path the enqueue must be awaited
(durability), and a DB failure surfaces as a 500 so checkout can retry — the customer must not be
told "order confirmed" while no durable row exists.

### 3.4 Drain logic and retry policy (shared, testable)

`src/lib/server/outbox-drain.ts` (no SvelteKit imports; takes
`db: LibSQLDatabase<typeof schema>` and an `EmailProvider`):

```ts
export async function drainOutbox(
  db: LibSQLDatabase<typeof schema>,
  provider: EmailProvider,
  opts?: { now?: number; limit?: number },
): Promise<DrainReport>;
```

**Concurrency / reentrancy.** The claim is atomic without needing D1 transactions
(which are unavailable across HTTP):

1. Reclaim stale leases:
   `UPDATE store_notification SET status='pending', locked_at=NULL WHERE status='sending' AND locked_at < :now - 300000`.
2. Claim one batch (default 25):
   `UPDATE store_notification SET status='sending', locked_at=:now, attempt_count=attempt_count+1 WHERE id IN (SELECT id FROM store_notification WHERE status='pending' AND next_attempt_at IS NOT NULL AND next_attempt_at <= :now ORDER BY next_attempt_at LIMIT 25)`.
3. `SELECT` rows with `status='sending' AND locked_at = :now` (the worker's own claim stamp).
   Rows claimed by a concurrent run are simply skipped; their `locked_at` differs.
4. Per row: call `provider.send(...)`; then update by `id` **and** `locked_at` guard.
   A duplicate cron tick is therefore safe: two runs cannot both proceed past the lease guard.

**Retry schedule.** Attempts 1–5 (configurable), backoff table with ±20% jitter:

| Attempt (after failure) | Delay to next attempt      |
| ----------------------- | -------------------------- |
| 1                       | 60 s                       |
| 2                       | 5 min                      |
| 3                       | 60 min                     |
| 4                       | 6 h                        |
| 5                       | → `dead` (no next attempt) |

- `retryable_error`: `attempt_count < 5` → `status='pending'`, `next_attempt_at = now + backoff`;
  otherwise `status='dead'`, `last_error` set.
- `permanent_error`: `status='dead'` immediately, no retry (a bad recipient never heals).
- `provider_missing`: `status='pending'`, `next_attempt_at=NULL` (parked), `attempt_count` is
  **not** incremented for parking purposes (the claim increment is compensated by not counting it
  toward the retry cap); an ops alert is emitted once per hour (§3.9).
- Resend quota 429s: `code='daily_quota_exceeded'` → `next_attempt_at = now + 6 h` without
  consuming an attempt; `code='monthly_quota_exceeded'` → `now + 24 h`. Both are `retryable_error`
  at the adapter layer; the drain inspects the code for the delay.
- On success: `status='sent'`, `sent_at=now`, `provider_message_id=…`, `last_error=NULL`,
  `locked_at=NULL`.
- Rows already carrying `provider_message_id` are never sent again (defense in depth alongside the
  provider idempotency key, whose dedupe window at Resend is 24 h per their docs).

`last_error` policy: store `code: message` truncated to 300 chars; never store HTML, reset URLs, or
the request body. All email bodies contain the order/reset link, so `last_error` must be built only
from the provider's error response.

### 3.5 Delivery Worker — `workers/email-sender/`

Recommended layout (chosen over alternatives in §8.2):

```
workers/email-sender/
├── wrangler.jsonc       # name "beeking-email-sender", main src/index.ts, D1 binding;
│                        # crons: email drain every minute + payment entries supplied by PAY (§3.7)
├── tsconfig.json        # workers-types, no SvelteKit ambient types
└── src/
    ├── index.ts         # export default { scheduled }; fetch() health returns 200 {ok:true}
    ├── provider-resend.ts
    └── (imports shared logic from ../../src/lib/server/outbox-drain.ts + schema)
```

- **Trigger:** `"triggers": { "crons": [...] }` — the email drain runs every minute (the cron
  granularity Cloudflare supports and the intended latency floor); payment expiry/reconciliation/
  daily-digest entries are supplied by the payments spec (§3.7) and live in this same config.
- **Bindings:** `d1_databases` with the same `database_id` and `migrations_dir: "drizzle"` as the
  Pages project (`wrangler.jsonc:10-18`). No KV, no R2, no queue.
- **Secrets/vars:** `RESEND_API_KEY` is the worker's only secret —
  `wrangler secret put RESEND_API_KEY --config workers/email-sender/wrangler.jsonc` (repo doc in
  `docs/production-runbook.md`) — and never touches the Pages environment, the repo, or logs.
  `EMAIL_FROM` and `ADMIN_NOTIFY_EMAILS` are Pages vars (ops spec §3.5.3 preflight); the app
  snapshots `from_address` at enqueue, and the worker mirrors `ADMIN_NOTIFY_EMAILS` only for the
  alert enqueue in §3.9.
- **The API worker (Pages) enqueues only.** No HTTP endpoint is deployed on the sender worker
  except a no-op `/health` for smoke checks; the app never talks to it. This removes auth surface
  and a second network hop.
- **Scheduled handler:** constructs the Resend adapter, calls `drainOutbox(db, provider)`, then
  calls `runPaymentJobs(db, paymob, now)` — exported by the payments spec for payment expiry,
  pending-payment reconciliation, and the daily digest (payments spec §3.7/§3.8) — then prunes
  `sent` rows older than 30 days (retention; see §7) and emits the alert check (§3.9). Payments
  contributes the jobs; this spec owns the worker and its schedule.
- **Idempotency:** the adapter sends `Idempotency-Key: <row.idempotency_key>` on
  `POST https://api.resend.com/emails`; the key is generated at enqueue time (§3.3), so an app
  crash, a duplicate cron, or a lease reclaim all replay the same logical send.
- **D1 access from the worker** uses `drizzle-orm/d1` with the same schema module; the shared
  drain module is written against `LibSQLDatabase<typeof schema>`, which the D1 driver satisfies
  structurally (the same bridge `src/lib/server/db/index.ts:37-42` already relies on).
- **Cost:** Workers Free supports cron triggers; every-minute runs execute ~1,440 invocations/day
  with D1 reads on a table that is normally empty. Monitor per §6; if D1 reads matter, the cron
  can be relaxed to `*/5 * * * *` (documented as the first dial).

### 3.6 Provider decision

| Criterion                          | Cloudflare Email Service                                  | **Resend (recommended)**                   | Postmark        | AWS SES                                               |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------ | --------------- | ----------------------------------------------------- |
| Free tier for arbitrary recipients | **No** — "Outbound emails: Not available" on Workers Free | Yes — 3,000/mo, 100/day                    | No (trial only) | No (SES sandbox; paid after)                          |
| Requirement                        | Workers Paid + sending domain + Email Routing             | Custom domain (DKIM/SPF) + API key         | Custom domain   | Custom domain, AWS account, production-access request |
| API from Worker                    | binding (Pages can't bind it)                             | REST, JSON, 1 fetch, no SDK needed         | REST            | SigV4 signing or SDK                                  |
| Idempotency                        | no documented key                                         | `Idempotency-Key` header on `POST /emails` | no              | no                                                    |
| Message id in response             | yes                                                       | `id`                                       | yes             | yes                                                   |
| Ops burden                         | dashboard only                                            | dashboard + logs                           | dashboard       | IAM + sandbox                                         |

**Recommendation: Resend**, with a plain `fetch` adapter (no SDK dependency; matches the repo's
"existing libraries first, add deps only when necessary"). Rationale:

- Only candidate that offers a real free tier for customer recipients, and the owner's
  free-tier preference is explicit.
- Idempotency keys are first-class, which the outbox design depends on.
- Comparing with the prior decision (`docs/decisions.md:1276-1280` "stays on Cloudflare Email
  Service"): that decision predates the discovery that outbound sending to arbitrary recipients
  requires Workers Paid and an onboarded sending domain; it also predates the Pages binding
  limitation recorded in `wrangler.jsonc:25-28`. The replacement ADR must state this explicitly
  (see §10).
- The `EmailProvider` interface keeps the swap to Postmark/SES/Cloudflare cheap if deliverability
  proves bad.

**Domain dependency (hard blocker for any provider):** `noreply@beeking-etman-website.pages.dev`
(`email.ts:43`) is not a deliverable sender. Before any real send:

1. Acquire a domain (e.g. `beekingetman.com`) and add it to the provider with the DNS records they
   generate: SPF (`v=spf1 include:…`), DKIM (provider CNAME/TXT), and DMARC
   (`v=DMARC1; p=none; rua=…` initially, tighten to `quarantine` once aligned).
2. Verify with the provider's domain check, set `EMAIL_FROM` to
   `"Beeking Etman <orders@<domain>>"`, and keep the `pages.dev` fallback only for local dev.
3. This is a **business dependency** (domain purchase + DNS), not a code task; it blocks the
   "enable real sends" task, not the pipeline build.

### 3.7 App-side changes

| File                                                 | Change                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/checkout/+page.server.ts:124-129`        | Keep `await sendOrderConfirmation(...)` but it is now enqueue-only; the try/catch stays as defense until the helper is proven, then remove the swallow so an enqueue failure is a 500.                                                                  |
| `src/routes/admin/orders/[id]/+page.server.ts:64-69` | `sendOrderStatusUpdate` is enqueue-only; keep try/catch (audit log must still run).                                                                                                                                                                     |
| `src/lib/server/auth.ts:28-83`                       | `sendResetPassword` **awaits** `enqueueEmail(db, …, { type: "password_reset" })` instead of calling `sendEmail` fire-and-forget. Rationale in §8.3. On enqueue failure it logs and rethrows so Better Auth returns an error rather than a silent no-op. |
| `src/lib/server/email.ts`                            | `sendEmail` + `flushOutbox` deleted; HTML builders stay here (or move to `email-templates.ts` if the worker needs them — it does not today).                                                                                                            |
| `src/lib/server/env.ts`                              | Add: fail in production if `EMAIL_FROM` is missing or contains `pages.dev`; warn if `ADMIN_NOTIFY_EMAILS` is empty. (The stale `EMAIL_API_KEY`/`SMTP_HOST` warnings were removed in the 2026-09-13 cleanup.)                                            |

### 3.8 Password reset ownership

Keep token/session ownership in Better Auth; pipe only the **delivery** through the outbox. Better
Auth continues to generate the reset URL and call `sendResetPassword`; that callback now enqueues.
Provider-native SMTP (Better Auth's `emailAndPassword.sendResetPassword` alternative) was rejected
because it bypasses the outbox (no retry, no evidence, separate credential), and using the provider
SDK directly in `auth.ts` was rejected because it recreates the exact silent-failure class this
spec removes. Latency consequence: a reset link can take up to ~2 minutes (worker cron cadence +
backoff). Acceptable for this store; if it ever isn't, a bounded `waitUntil` trigger can be added
(§8.4).

### 3.9 Admin visibility & alerting

- **New page `/admin/emails`** (`src/routes/admin/emails/+page.server.ts` + `+page.svelte`), guarded
  by the existing admin layout (`src/routes/admin/+layout.server.ts:6-9`); each action re-checks
  `isAdminRole` and logs to the audit table, mirroring `admin/orders/[id]/+page.server.ts:33-34,72-78`.
  - Summary: pending / sending / failed / dead counts, oldest pending age, last 24 h sent/failed.
  - Table: failed + dead rows (type, recipient, subject, attempt_count, last_error, created_at,
    provider_message_id when present), newest first, paginated.
  - Actions: **Resend** a single row (set `status='pending'`, `next_attempt_at=now`,
    `attempt_count=0`, `locked_at=NULL`, clear `last_error` — **keep the same `idempotency_key`**);
    **Retry all failed** (bounded to 100 rows).
  - Completed (`sent`) rows are viewable read-only with their `provider_message_id` — this is the
    delivery evidence admins never had.
- **Alerting** inside the worker's scheduled run (no separate product):
  - Condition: `dead` count ≥ 1, or `pending` oldest age > 2 h, or `failed` in the last hour > 5.
  - Action: enqueue an `ops_alert` email to every `ADMIN_NOTIFY_EMAILS` address (through the same
    outbox, `type='ops_alert'`), throttled to at most one alert per condition per 6 h using a
    dedicated `ops_alert` row lookup instead of an extra table.
  - `provider_missing` park events: one `ops_alert` per hour while parked (bounded by the
    throttle), because parked rows mean _no email is going out at all_.

---

## 4. Migration & rollout

### 4.1 Migration

- File: `drizzle/0018_email_delivery.sql` (number frozen by the program roadmap; if drizzle-kit
  emits a different name suffix, keep the `0018` index and journal ordering after
  `0017_catalog_authority`).
- Type: table rebuild + backfill + indexes (DDL in §3.2), following the `0016` precedent that
  already rebuilds a table with CHECK constraints and survives D1 replay
  (`docs/todo.md:437-439`).
- Backfill: legacy rows keep `status='sent'`; `provider_message_id` stays NULL,
  `next_attempt_at = created_at`, `attempt_count = 0`, `locked_at = NULL`. No attempt is made to
  "recover" lost sends — they cannot be recovered; the migration comment records that all rows
  created before this migration are unverifiable.
- CI already replays every migration against throwaway SQLite
  (`.github/workflows/ci.yml:42-46`) and against local D1 during E2E setup
  (`scripts/e2e-setup.mjs:97-113`); both must pass before the migration reaches the
  `migrate-production` job (`.github/workflows/ci.yml:78-105`).

### 4.2 Deploy order

1. **Migration only** (normal CI to `main`): additive columns + rebuild; old app instances keep
   working (`INSERT` without the new columns uses defaults; their `flushOutbox` query still matches
   `pending` rows and their `status='sent'` update still satisfies the CHECK).
2. **Worker, monitoring-only:** deploy `beeking-email-sender` with `DRY_RUN=1`, which runs the
   claim/lease path and logs what it _would_ send without calling the provider. Verifies D1
   connectivity, cron firing, and that no rows are double-claimed. (`fetch` health endpoint
   smoke-checked.)
3. **App deploy:** enqueue-only calls, admin page, env validation. `EMAIL_PIPELINE_ENABLED=true`
   by default in the Pages env; while unset the app falls back to the old best-effort
   `flushOutbox` shim (kept temporarily) so a rollback needs only the flag.
4. **Enable provider:** `EMAIL_FROM` + `RESEND_API_KEY` configured, `DRY_RUN` removed. Because
   `provider_missing` parks rows instead of sending, step 3 can safely ship days before the domain
   is ready; nothing is lost and nothing is falsely marked sent.
5. **Overlap with old app instances:** old instances never see `sending`/`dead` rows (their query
   matches only `pending`/NULL) and cannot clobber a row the new worker is sending because the
   worker's `UPDATE … WHERE locked_at = :claim` guard fails for the old writer. The tail risk is
   two different senders (old app flush + new worker) both draining `pending` rows; that is why
   steps 2–3 deploy the worker in DRY_RUN before the app stops flushing. Once the Pages deploy has
   fully propagated (~minutes), remove the shim in a follow-up commit.

### 4.3 Rollback

- **App:** redeploy the previous commit; with `EMAIL_PIPELINE_ENABLED` unset, the shim flush
  resumes. The schema stays valid either way.
- **Worker:** `wrangler deployments` rollback, or set `DRY_RUN=1` to stop sends without a deploy.
- **Data:** no destructive migration; `sent`/`dead` states are reversible via the admin resend
  action. The rebuild in step 1 is the only operation that touches existing rows, and the previous
  table is recoverable from D1 time-travel/backups if a flaw is found during the drain window.

---

## 5. Testing strategy

Commands use the repo's declared runner (`package.json:14` — `vp test --run`; CI calls
`pnpm run test:unit -- --run`, `.github/workflows/ci.yml:41`).

### 5.1 Unit (server project, `src/**/*.spec.ts` with `vite-plus/test`)

- `src/lib/server/outbox-drain.spec.ts` against an in-memory libsql DB (the pattern used by
  `email.spec.ts` and the admin specs):
  - claim claims every due row exactly once and respects `next_attempt_at > now`;
  - `retryable_error` schedules the exact backoff (inject `now`, assert `next_attempt_at`);
  - 5th failure lands `dead` with `last_error` truncated/redacted;
  - `permanent_error` lands `dead` immediately with no further due query hit;
  - `provider_missing` parks (`next_attempt_at IS NULL`) and does not consume an attempt;
  - stale-lease reclaim: a row in `sending` older than the lease is re-claimed;
  - a row that already has `provider_message_id` is never re-sent;
  - concurrent-call simulation: two `drainOutbox` calls interleaved against the same DB produce one
    provider call per row.
- `src/lib/server/outbox.spec.ts`: enqueue validation (bad recipient rejected, CRLF rejected),
  idempotency collision inserts one row, `from_address` snapshot.
- `src/lib/server/email-provider.spec.ts`: Resend response mapping (200 with id, 4xx, 5xx, network
  throw) to the four `SendResult` kinds; adapter without key → `provider_missing`.
- Existing `src/routes/checkout/page.server.spec.ts:19` mock must change: assert
  `sendOrderConfirmation` is called and **no flush/provider call occurs** (the mock module loses
  `flushOutbox`); `src/routes/admin/orders/[id]` gains the same assertion for
  `sendOrderStatusUpdate`.
- Migration spec: a server test that runs `drizzle/0018_*.sql` against a temp libsql file and
  asserts the CHECK rejects an unknown status, the due index exists, and the partial unique index
  rejects a duplicate `idempotency_key` while allowing multiple NULLs.

### 5.2 Worker integration

- Extract `drainOutbox` so it is fully testable in the Node server project (no workerd needed) with
  a fake provider — this is the primary integration test.
- `workers/email-sender/src/index.spec.ts` under a dedicated config
  `workers/email-sender/vitest.config.ts` using `@cloudflare/vitest-pool-workers` (new dev
  dependency) to exercise `scheduled()` against local D1: empty queue, one due row sent and marked,
  provider error retried. Run with a new script `pnpm run test:worker` (kept separate from `vp test`
  so the SvelteKit server project is unaffected); wire it into CI as its own step.
- `wrangler dev --test-scheduled` + `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*+*+*+*+*"`
  documented in the worker README for manual verification.

### 5.3 E2E (Playwright, `tests/`)

- Extend `tests/checkout.e2e.ts`: after a successful checkout, query the isolated E2E D1 and assert
  a `store_notification` row exists with `type='order_received'`, `status='pending'`, and a non-null
  `idempotency_key` (no provider is configured in E2E, so the row can never be `sent` there).
- Add an admin E2E: with a seeded `failed` row, `/admin/emails` shows it and Resend flips it to
  `pending`.
- Keep the migration-replay E2E gate (`scripts/e2e-setup.mjs:97`) as the schema canary.

### 5.4 Quality gate (per repo standard)

`pnpm run check` → `pnpm exec vp check` → `pnpm run test:unit -- --run` → `pnpm run test:worker`
(new) → `pnpm run build` → `pnpm exec playwright test`, all green before merge.

---

## 6. Observability

- **Structured logs** (one JSON line per event) from the worker:
  `{ evt: "outbox_drain", claimed, sent, retried, dead, parked, ms }` and per-row
  `{ evt: "outbox_send", id, type, attempt, result: "sent|retryable|permanent|parked"|"provider_missing", providerMessageId|errorCode }`.
  No recipient address in logs; log the row `id` (and optionally a recipient hash) instead.
- **Metrics** for free-tier Workers: the per-run drain report doubles as the metric source; log it
  every run and alert on the thresholds in §3.9. Workers Logs in the dashboard is the first stop;
  a real metrics pipeline (Logpush/Analytics Engine) is deferred until volume justifies it.
- **Health:** `GET /` on the worker returns `200 {"ok":true,"pending":N,"dead":M}` (bounded and
  read-only) so a smoke check after deploy has something to assert.
- **Alert path:** dead letters / stalled pending / provider_missing emit `ops_alert` emails to
  `ADMIN_NOTIFY_EMAILS` through the outbox itself, so the alert channel is the same channel under
  observation — if the pipeline is dead, the absence of alert emails is itself detectable from
  `/admin/emails` and the health endpoint. A future external check (GitHub Actions scheduled job
  curling the health endpoint and failing loudly) is the follow-up when budget allows.

---

## 7. Security

- **Recipient validation at the boundary:** `isPlausibleEmail` (moved to a shared module) + explicit
  CRLF/header-injection rejection; `from_address` is config-controlled, never user input.
- **No PII in logs:** log row `id`, `type`, `attempt`, `errorCode`; never `recipient`, `subject`,
  body HTML, reset URLs, or the provider API key. `last_error` stores only provider error codes and
  truncated messages, never request content.
- **Secret storage:** `RESEND_API_KEY` exists only as a Worker secret (set via Wrangler, documented
  in the runbook); `CLOUDFLARE_API_TOKEN` already scoped in CI
  (`docs/production-runbook.md:105-108`) is reused for `wrangler deploy` of the worker. No provider
  secrets in `wrangler.jsonc`, repo, or Pages env (Pages holds only non-secret vars such as
  `EMAIL_FROM`/`ADMIN_NOTIFY_EMAILS`, checked by the ops preflight).
- **Least privilege:** the worker has exactly one binding (D1 `DB`) and no public HTTP API beyond a
  read-only health endpoint; no webhook receiver means no signature-verification surface.
- **Admin actions:** Resend/Retry-all re-check `isAdminRole` server-side and write to the audit log
  (`logAdminAction`), consistent with existing admin mutations.
- **Retention of secret-bearing payloads:** reset-email bodies contain one-time tokens; sent rows
  (including `body`) are deleted after 30 days by the worker prune step; dead/failed rows are kept
  until resolved, then pruned on the same schedule. This bounds the token-residue window.
- **Rate limiting:** checkout already rate-limits (10/min, `checkout/+page.server.ts:19,55`).
  Reset/verification endpoint throttling is **not** in place today; it is the ops spec's deliverable
  (ops spec §3.2), and this spec does not claim it as existing. No new unauthenticated surface is
  added.

---

## 8. Open decisions

### 8.1 Provider choice

**Recommendation: Resend** (§3.6). Fallback if the owner rejects a third-party processor: Workers
Paid + Cloudflare Email Service (costs ~$5/mo and still requires the domain). Decision needed
before task 2 starts.

### 8.2 Worker location

**Recommendation: in-repo `workers/email-sender/`** (single source of truth for the shared drain
logic and Drizzle schema, one CI pipeline, one secret store). Rejected: separate repository (needs
schema duplication or a published package), and Pages-Function-only (no cron on Pages). The cost
accepted: two deploy artifacts from one repo, and the worker needs its own `tsconfig` so
workerd types don't collide with `.svelte-kit` ambient types.

### 8.3 Reset email ownership

**Recommendation: same outbox pipeline, awaiting the enqueue in `sendResetPassword`** (§3.8). This
trades a few ms in the reset request for delivery evidence + retry; the user-visible consequence of
a failed enqueue is an error, which is correct — a reset that never arrives is worse. Rejected:
provider-native SMTP (bypasses the outbox).

### 8.4 Immediate-send vs cron latency

**Recommendation: cron only, every minute, both for orders and resets.** Simplicity wins; worst
case reset latency ~2 min. Rejected for now: an app→worker wake-up call (`waitUntil(fetch(...))`)
to trim latency — it adds an unauthenticated surface and a second failure mode for a latency class
this store does not have. Revisit only if the owner reports reset friction.

### 8.5 Failed-row auto-retry vs manual

**Recommendation: bounded automatic retry (5 attempts) + `dead` + manual resend from
`/admin/emails`.** Automatic retry from `dead` is rejected: a dead row failed a permanent test (bad
recipient/quota), and unbounded automatic resurrection generates noise and provider rejections. The
admin action is the escape hatch.

### 8.6 Claim mechanism on D1

**Recommendation: conditional `UPDATE` + lease (as specified), not `UPDATE … RETURNING` in a D1
batch.** The conditional update is a documented SQLite/D1 semantic; `RETURNING` support in D1 is not
relied on. Verify `meta.changes` semantics during task 3 with the libsql tests (libsql and D1 share
the SQLite dialect, and the repo already bridges them in `src/lib/server/db/index.ts:37-42`).

---

## 9. Ordered task breakdown

Sizes are implementation estimates (half-days). "Deps" are hard prerequisites; tasks marked ∥ can
run in parallel.

| #   | Task                                                                                                                                                                                   | Size  | Deps         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------ |
| 1   | Schema + migration `0018` (rebuild, columns, indexes, CHECK), Drizzle schema mirror, migration spec                                                                                    | 1.5 d | —            |
| 2   | Provider adapter (`email-provider.ts`, Resend fetch impl, result mapping) + unit specs                                                                                                 | 1 d   | 8.1 decision |
| 3   | `outbox.ts` enqueue helper + `outbox-drain.ts` (claim/lease/backoff/dead/park) + unit specs on libsql                                                                                  | 2 d   | 1            |
| 4   | `workers/email-sender/` scaffold: wrangler config (email cron + PAY's payment entries), health endpoint, `scheduled()` (drain + `runPaymentJobs` hook), tsconfig, `test:worker` wiring | 1 d   | 3            |
| 5   | App rewiring: `sendOrderConfirmation` / `sendOrderStatusUpdate` enqueue-only; delete `flushOutbox`; checkout + admin spec updates; temporary flag shim                                 | 1 d   | 3            |
| 6   | Password reset through the outbox in `auth.ts` + test                                                                                                                                  | 0.5 d | 3            |
| 7   | Env validation (`EMAIL_FROM` fail, remove stale warnings) + `.dev.vars.example`/runbook updates                                                                                        | 0.5 d | 5            |
| 8   | CI: worker typecheck, `test:worker`, worker deploy job; `CLOUDFLARE_API_TOKEN` permission check                                                                                        | 1 d   | 4            |
| 9   | `/admin/emails` page + resend/retry-all actions + audit + E2E                                                                                                                          | 2 d   | 3            |
| 10  | Alerting (`ops_alert` thresholds/throttle) + prune job + health check                                                                                                                  | 1 d   | 3, 4         |
| 11  | E2E: checkout enqueues assertion, admin resend flow                                                                                                                                    | 1 d   | 5, 9         |
| 12  | Rollout execution: migration → DRY_RUN worker → app → provider enable; runbook + todo correction; ADR                                                                                  | 1 d   | all          |

**Parallelization:** 1→3→{4,5,6,9}, then 8,10,11; task 2 can start as soon as 8.1 is decided
(∥ with 1). Everything else serializes behind 3.

**External dependencies (not tasks):** domain purchase + DNS (SPF/DKIM/DMARC), Resend account +
domain verification, `RESEND_API_KEY` secret, and `ADMIN_NOTIFY_EMAILS` confirmed in the Pages env.
These gate task 12 only.

**Documentation follow-ups (part of task 12, not this spec):**

- `docs/decisions.md`: new ADR replacing the "stays on Cloudflare Email Service" decision
  (`decisions.md:1276-1280`) with the evidence in §3.6.
- `docs/todo.md:462-464`: correct the "rows accumulate as `pending`" claim and point at this spec.
- `docs/production-runbook.md`: worker deploy/rollback, secret setup, cron cadence dial, and the
  `DRY_RUN` / `EMAIL_PIPELINE_ENABLED` flags.
- `docs/architecture.md`: add the delivery pipeline + worker to the component map.
