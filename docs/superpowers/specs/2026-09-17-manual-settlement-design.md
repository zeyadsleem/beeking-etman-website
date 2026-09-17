# Order Lifecycle & Manual Settlement — Design Spec

**Date:** 2026-09-17
**Status:** Proposed — awaiting owner approval.
**Scope:** Replace the simulated payment path with cash on delivery plus manual transfers (InstaPay
and Vodafone Cash) under admin-verified payment. Separate the fulfillment and payment state
machines. Hold stock with a deadline and release it exactly once. Add an admin review queue with a
durable audit trail. Use WhatsApp as the communication channel, not as an order system. Defer
Paymob to phase 2.
**Ownership:** This spec owns the order and payment vocabulary and migration `0019` for v1
(roadmap §3.2 amended). The 2026-09-13 Paymob spec is deferred to phase 2 and is not a build plan.
**Related:** AgDR-0001 (settlement decision), AgDR-0002 (blend studio retirement).
**Roadmap:** `docs/superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md` arbitrates
cross-spec sequencing. This spec's migration is frozen at `0019_settlement.sql`.

Money is integer piasters (1/100 EGP) everywhere, as today (`docs/decisions.md` 2026-08-13).

---

## 1. Context & current state

The end-to-end current-state narrative, the simulated path, and the legacy `placed`/`paid`
semantics are analysed in the deferred spec (`2026-09-13-order-lifecycle-payments-design.md` §1).
This section records only the delta and the facts this design depends on.

1. **Simulated payment.** `createOrder` writes `status = "paid"` and `payment_status = "simulated"`
   and the success page shows the simulated-payment copy
   (`src/lib/server/orders.ts:337-339`, `src/routes/checkout/success/[id]/+page.svelte`).
2. **Trigger-owned stock.** The `BEFORE INSERT` trigger on `store_order_item`
   (`drizzle/0016_order_hardening.sql:24-39`) decrements `store_product_variant.stock` per unit when
   `stock_version = 'atomic'` and aborts on shortage. Cancel-restock is an `AFTER UPDATE OF status`
   sibling trigger (lines 58-69). Application code never decrements stock for new orders.
3. **Blend expansion.** `createOrder` expands a composed blend into base + additive variant units
   (`src/lib/server/orders.ts:125-192`). AgDR-0002 retires the studio, so this path is removed in
   the same milestone. After removal, orders carry product and variant lines only.
4. **No gateway, no card data.** Production has no payment provider configured. The store holds no
   card data, so PCI scope is zero today and stays zero in v1.
5. **Admin audit exists.** `store_admin_audit` and `logAdminAction` are in place
   (`src/lib/server/admin/audit.ts`), with an index on target type and id. Not every order or
   payment mutation writes an audit row yet.
6. **Email is best-effort until M0 ships.** The outbox exists but the Pages project has no email
   binding. This spec declares email triggers and consumes the M0 interface; the WhatsApp CTA is
   the launch-critical channel while delivery is being repaired.

---

## 2. Goals / Non-goals

### Goals

1. Record real orders for payment methods the shop actually uses: cash on delivery, InstaPay
   transfer, and Vodafone Cash transfer.
2. Separate fulfillment from payment. Neither state machine blocks the other, and the admin sees
   both plainly.
3. Treat every customer claim as untrusted. Only the shop sets `paid`, after verifying the money in
   the receiving account or in hand.
4. Reserve stock at placement with a deadline. Release the hold exactly once on cancellation or
   expiry, and never restock shipped goods.
5. Give the shop one review queue for transfer claims, with a durable event trail and an audit row
   per action.
6. Give the customer a clear path: order number, exact amount, receiving account, a claim step,
   and a WhatsApp message with the order number prefilled.
7. Keep the payment lifecycle gateway-ready so phase 2 (Paymob) adds an adapter without reworking
   the order model.

### Non-goals

- **No gateway in v1.** Paymob, card acceptance, intention APIs, HMAC webhooks, and gateway
  reconciliation are phase 2 (`2026-09-13-order-lifecycle-payments-design.md`, deferred).
- No payment-proof uploads in v1. The customer sends the transfer screenshot over WhatsApp; the
  claim form carries an optional reference text. This avoids a new public media surface.
- No partial refunds in v1. Refunds are full, manual, and recorded with a reason and a reference.
- No shipping integration, returns/RMA workflow, or exchange logic. The M3 COM spec owns returns.
  Post-shipment reversals are refunds with no status flip and no restock.
- No multi-currency; EGP only.
- No change to the checkout form transport (SvelteKit server actions), the oRPC search boundary,
  or the signed cart cookie.

---

## 3. Proposed design

### 3.1 Fulfillment state machine — `order.status`

| Value                  | Meaning                                                           | Written by            |
| ---------------------- | ----------------------------------------------------------------- | --------------------- |
| `pending_confirmation` | Order recorded; the shop has not accepted it yet; stock is held   | checkout              |
| `confirmed`            | The shop accepted the order (WhatsApp or call)                    | admin                 |
| `processing`           | The shop is preparing the order                                   | admin                 |
| `shipped`              | Dispatched                                                        | admin                 |
| `delivered`            | Handed to the customer; COD cash collected if applicable          | admin                 |
| `cancelled`            | Terminal; the hold is released if the order never shipped         | admin / expiry job    |
| `placed`, `paid`       | **Legacy read aliases of `confirmed`**; never written by new code | pre-pivot builds only |

Transition table, enforced by `allowedTransitions` plus conditional `UPDATE`s in the admin service
(following `src/lib/server/admin/orders.ts:193-231`):

| From                   | To           | Trigger            | Notes                                                     |
| ---------------------- | ------------ | ------------------ | --------------------------------------------------------- |
| `pending_confirmation` | `confirmed`  | admin              | The normal first step for every method                    |
| `pending_confirmation` | `cancelled`  | admin / expiry job | Restock trigger fires                                     |
| `confirmed`            | `processing` | admin              |                                                           |
| `confirmed`            | `shipped`    | admin              | Small ops may skip `processing`                           |
| `confirmed`            | `cancelled`  | admin              | Pre-shipment only; restock trigger fires                  |
| `processing`           | `shipped`    | admin              |                                                           |
| `processing`           | `cancelled`  | admin              | Pre-shipment only; restock trigger fires                  |
| `shipped`              | `delivered`  | admin              |                                                           |
| `shipped`              | —            | —                  | Post-shipment reversal is a refund (§3.5); no status flip |
| `delivered`            | —            | —                  | Terminal in v1; the returns spec may add states           |
| `cancelled`            | —            | —                  | Terminal                                                  |

Rules:

- Payment never blocks a transition. The admin may ship a prepaid order whose payment is not yet
  `paid`; the admin detail page shows a warning. COD orders ship unpaid by design.
- New code writes `pending_confirmation` and `unpaid` explicitly. The Drizzle schema defaults
  change to match; the physical SQLite defaults stay `paid`/`simulated` until the data-integrity
  `store_order` rebuild (§4.4).
- Every transition writes an audit row with the admin user id, the from and to values, and the
  note when one is supplied.

### 3.2 Payment state machine — `payment_status`

| Value            | Arabic label     | Meaning                                                         | Written by         |
| ---------------- | ---------------- | --------------------------------------------------------------- | ------------------ |
| `unpaid`         | بانتظار الدفع    | No verified payment yet. COD stays here until cash is collected | checkout           |
| `pending_review` | بانتظار المراجعة | The customer claims a transfer; the shop has not verified it    | claim action       |
| `paid`           | مدفوع            | Verified by the shop, in the account or in hand                 | admin              |
| `failed`         | مرفوض            | A claim was rejected, or the payment window closed              | admin / expiry job |
| `refunded`       | مسترد            | Full refund recorded                                            | admin              |
| `simulated`      | —                | Legacy only; pre-pivot rows                                     | pre-pivot builds   |

Transition table:

| From                        | To               | Trigger            | Guards                                                     |
| --------------------------- | ---------------- | ------------------ | ---------------------------------------------------------- |
| —                           | `unpaid`         | checkout           | New rows only                                              |
| `unpaid` / `failed`         | `pending_review` | customer claim     | Method is `instapay` or `wallet`; order not cancelled      |
| `pending_review`            | `paid`           | admin verification | Reference or note required                                 |
| `unpaid` / `pending_review` | `paid`           | admin verification | Reference or note required; covers cash collection for COD |
| `pending_review`            | `failed`         | admin rejection    | Note required                                              |
| `unpaid` / `pending_review` | `failed`         | expiry job         | Transfer methods only, or a claim left open                |
| `paid`                      | `refunded`       | admin refund       | Reason and reference required; full amount only            |
| `refunded`                  | —                | —                  | Terminal in v1                                             |

Rules:

- A claim, a screenshot, or a button press never sets `paid`. Only the `paid` transition above,
  performed by an authenticated admin, does.
- Amount truth is server-side. The order stores the total at placement; the shop compares the
  received amount to it during verification. The claim form does not accept an amount.
- Combination rules, enforced by a `store_order` trigger plus service guards:
  - A refund requires a prior `paid` value. A cancelled order can still be refunded.
  - A late transfer payment on a cancelled order can be recorded as `paid` and then refunded. The
    customer cannot submit a new claim on a cancelled order.
  - The trigger accepts the legacy `placed`/`paid`/`simulated` values during the drain window.

### 3.3 Stock hold, deadline, and release

**Decision: reserve at placement, hold until a deadline, release exactly once.** The existing 0016
trigger path stays as-is.

- `createOrder` keeps inserting `stock_version = 'atomic'`; the reserve trigger decrements each
  variant unit atomically and aborts the batch on shortage.
- Every new order gets `hold_expires_at = placed_at + ORDER_HOLD_MINUTES` (default 1440 minutes,
  24 hours, env-tunable). COD orders may use `COD_HOLD_MINUTES` when it is set.
- The expiry job runs every 5 minutes with a 5-minute grace and cancels orders that meet either
  rule:
  1. `status = 'pending_confirmation'` and `hold_expires_at <= now - grace` (the shop never
     accepted the order; applies to every method), or
  2. `payment_method IN ('instapay','wallet')`, `status IN ('confirmed','processing')`,
     `payment_status IN ('unpaid','pending_review')`, and `hold_expires_at <= now - grace`
     (the shop accepted but the money never arrived).
- The cancellation is a conditional `UPDATE ... WHERE id = ? AND status IN (...) AND
hold_expires_at <= ?` followed by the existing restock trigger. The conditional guard makes
  concurrent runs idempotent, and the trigger releases the reservation exactly once.
- The job writes a `store_payment_event` row (`type = 'expiry'`, `actor = 'system'`) per cancelled
  order. It also sets `payment_status = 'failed'` when a claim was open (`pending_review`); an
  untouched `unpaid` row stays `unpaid` so the funnel stays honest.
- COD orders in `confirmed`/`processing` are never cancelled by payment state; they are unpaid by
  design. The shop moves them forward or cancels them.
- The admin can extend a hold by 24 hours from the order detail page while the order is in
  `pending_confirmation`, `confirmed`, or `processing`. The action is audited.

**Rejected alternative: reserve at payment verification.** It holds no stock for unpaid orders,
but the shop would sell jars it cannot ship after a late transfer, and the remedy is a refund after
the money moved. A bounded hold is the cheaper failure.

### 3.4 Payment methods and flows

Checkout shows the shipping estimate and the total before submission, as today. The customer
selects exactly one method:

| Method            | Value      | Label (AR)              | What the customer sees next                                                            |
| ----------------- | ---------- | ----------------------- | -------------------------------------------------------------------------------------- |
| Cash on delivery  | `cod`      | الدفع عند الاستلام      | The shop will contact you to confirm; the amount is due on delivery                    |
| InstaPay transfer | `instapay` | تحويل إنستاباي          | The receiving InstaPay address, the exact amount, the order number, and the claim form |
| Vodafone Cash     | `wallet`   | تحويل محفظة فودافون كاش | The receiving wallet number, the exact amount, the order number, and the claim form    |

#### 3.4.1 COD

The order is created `pending_confirmation` / `unpaid` / `cod`. The success page carries the order
number, the amount due on delivery, and the WhatsApp CTA. The shop confirms by WhatsApp or phone,
moves the order through fulfillment, collects cash at handover, and marks `paid` on the order
detail page. A refusal at the door is a cancellation with a note; restocking happens only after
inspection, through the admin stock adjustment, never automatically.

#### 3.4.2 InstaPay and Vodafone Cash

The order is created `pending_confirmation` / `unpaid` / `instapay` or `wallet` with the hold set.
The success page and the customer order page show:

1. The order number and the exact amount, in piasters formatted for display.
2. The receiving account, from configuration (§3.8).
3. Step-by-step instructions: transfer the exact amount, then press "تم التحويل" and send the
   screenshot on WhatsApp.
4. The claim form: an optional `payment_reference` text field (for example the transfer reference
   the bank app shows) and a submit action.
5. The WhatsApp CTA with a prefilled message containing the order number.

#### 3.4.3 The customer claim

- The claim action is a SvelteKit form action on the order access surface; authorization follows
  the existing order-access capability cookie or owner session
  (`src/lib/server/order-access.ts`, `src/routes/checkout/success/[id]/+page.server.ts:11-36`).
- Guards: the order method is `instapay` or `wallet`; the order is not `cancelled`; the current
  payment status is `unpaid` or `failed` (a `pending_review` order shows "قيد المراجعة" and rejects
  duplicate claims with a friendly message, adding no event).
- The action sets `payment_status = 'pending_review'`, stamps `payment_claimed_at`, and inserts a
  `store_payment_event` (`type = 'claim'`, `actor = 'customer'`, reference when supplied).
- Rate limit: 5 claims per order per hour and 20 per IP per hour, on the existing DB-backed
  limiter pattern (`src/lib/server/rate-limit.ts`).
- The action enqueues the admin notification and the customer acknowledgement through the M0
  outbox interface when it is live. Email failure must not fail the claim.

#### 3.4.4 Admin verification and rejection

- `mark_paid`: visible for `unpaid` and `pending_review` orders. Requires a reference or a note.
  Sets `payment_status = 'paid'`, `paid_at`, `payment_reviewed_at`, `payment_reviewed_by`, inserts
  a `verified` event, and writes an audit row. This is the only path to `paid`.
- `reject_claim`: visible for `pending_review` orders. Requires a note. Sets
  `payment_status = 'failed'`, inserts a `rejected` event, and writes an audit row. The customer
  can submit a corrected claim afterwards.
- `refund`: visible for `paid` orders. Requires a reason and a reference. Sets
  `payment_status = 'refunded'`, inserts a `refund` event, and writes an audit row. No restock; no
  status flip.
- `extend_hold`: adds 24 hours to `hold_expires_at`; audited.

### 3.5 Cancellations, refunds, and returns

- **Pre-shipment cancellation** (admin or expiry job): status becomes `cancelled`; the restock
  trigger returns the held units exactly once.
- **Post-shipment reversal**: refund only. No status flip and no automatic restock. Migration 0019
  recreates the cancel-restock trigger with an `OLD.status` allowlist
  (`pending_confirmation`, `confirmed`, `processing`, `placed`, `paid`) so a shipped or delivered
  order can never restock through a status change.
- **Returned goods**: the admin inspects them and adjusts stock manually with a note. The M3
  returns spec owns line-level RMA and inspected-good restocking.
- **Refunds** move on the same rails the money arrived on, outside the system. The system records
  the decision, the actor, and the reference.

### 3.6 Admin surfaces and audit

- **Orders list**: gains a payment method column, a payment status badge, and a `payment` filter
  (`unpaid | pending_review | paid | failed | refunded | simulated`). A "قيد المراجعة" shortcut
  filters the review queue. CSV export and its label map update in the same change.
- **Order detail**: a settlement panel with the method, payment status, amount, claim reference,
  hold deadline, paid-at, reviewer, and the event timeline. Actions from §3.4.4 plus the
  fulfillment transitions from §3.1, each re-checking `isAdminRole` server-side and writing
  `logAdminAction`.
- **Audit coverage**: every fulfillment transition, verification, rejection, refund, hold
  extension, and manual stock adjustment writes an audit row with the admin user id.
- No `/admin/payments` reconciliation page in v1. The review queue, the event timeline, and the
  daily digest cover the manual model.

### 3.7 Customer communication and WhatsApp

Email rides the M0 outbox interface and the email spec's worker. This spec adds triggers and copy
only.

| Lifecycle event                | Email type          | Recipient        | Notes                                                       |
| ------------------------------ | ------------------- | ---------------- | ----------------------------------------------------------- |
| Order created, transfer method | `order_received`    | customer         | Order number, exact amount, receiving account, claim link   |
| Order created, COD             | `order_received`    | customer         | Order number, amount due on delivery                        |
| Claim submitted                | `payment_claimed`   | customer + admin | Acknowledgement to the customer; review prompt to the admin |
| Payment verified               | `payment_confirmed` | customer         | Order number, paid amount                                   |
| Claim rejected                 | `payment_failed`    | customer         | Reason label and a retry path                               |
| Hold expired / cancelled       | `status_update`     | customer         | Existing status-update template with new labels             |
| Shipped / delivered            | `status_update`     | customer         | Existing `sendOrderStatusUpdate`                            |
| Refund recorded                | `refund`            | customer         | Amount and reference                                        |

WhatsApp rules:

- The shop number comes from `PUBLIC_WHATSAPP_NUMBER`. Links use `https://wa.me/<number>?text=...`
  with a URL-encoded, prefilled message.
- The customer CTA appears on the success page and the customer order page. The message contains
  the order number, the total, and the method.
- The admin order detail has a WhatsApp CTA to the customer phone for confirmation and follow-up.
- WhatsApp carries communication and screenshots. It owns no order state, and the system never
  claims that a WhatsApp message confirms payment.

### 3.8 Configuration and secrets

| Variable                  | Purpose                                                         | Required                   |
| ------------------------- | --------------------------------------------------------------- | -------------------------- |
| `PUBLIC_WHATSAPP_NUMBER`  | Shop WhatsApp number for CTAs, international format without `+` | yes                        |
| `PUBLIC_INSTAPAY_ADDRESS` | Receiving InstaPay address shown on transfer orders             | when InstaPay is enabled   |
| `PUBLIC_WALLET_NUMBER`    | Receiving Vodafone Cash number shown on transfer orders         | when the wallet is enabled |
| `ORDER_HOLD_MINUTES`      | Hold window for all new orders; default `1440`                  | no                         |
| `COD_HOLD_MINUTES`        | Optional override for COD orders                                | no                         |
| `PAYMENTS_COD_ENABLED`    | `true` disables/enables the COD option; default `true`          | no                         |
| `PAYMENTS_WALLET_ENABLED` | Enables the Vodafone Cash option; default `true`                | no                         |

- Validation lives in `src/lib/server/env.ts` with the existing fail-fast pattern. Production must
  refuse to boot when an enabled method is selected and its receiving account is missing.
- No new secrets. Receiving accounts are public by design (customers must see them) and carry no
  credential.
- The deferred `PAYMOB_*` variables are not introduced in v1. Phase 2 reintroduces them with the
  gateway adapter.
- `.dev.vars.example` gains the variables above with dummy values.

### 3.9 Module layout

New server modules:

- `src/lib/server/settlement/types.ts` — shared vocabulary, label maps, and normalized event
  shapes.
- `src/lib/server/settlement/lifecycle.ts` — transition guards, `parsePaymentStatus`,
  `parseOrderStatus` alias handling, conditional updates for verify/reject/refund.
- `src/lib/server/settlement/claims.ts` — claim submission, guards, rate limits, event writes.
- `src/lib/server/settlement/expiry.ts` — `releaseExpiredHolds(db, now)` used by the worker's
  `scheduled()` handler through the M0 hook.

Existing files touched: `orders.ts` (method, hold, vocabulary, blend expansion removal),
`checkout` routes (method selection, instructions, claim action), success and customer order pages,
`admin/orders.ts` and admin routes (filters, actions, audit), `email.ts` (types and copy),
`admin-order-status.ts` (vocabulary), i18n messages, `env.ts`, schema, migration `0019`, seed data,
and docs.

---

## 4. Migration & rollout

### 4.1 Migration `0019_settlement` (number frozen by the program roadmap; journal ends at `0017_catalog_authority`)

Contents:

1. `ALTER TABLE store_order ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'simulated'`,
   `payment_reference TEXT`, `payment_claimed_at INTEGER`, `payment_reviewed_at INTEGER`,
   `payment_reviewed_by TEXT`, `hold_expires_at INTEGER`, `paid_at INTEGER`.
2. `CREATE TABLE store_payment_event` (append-only settlement log): `id`, `order_id`, `type`,
   `actor`, `actor_user_id`, `method`, `reference`, `note`, `created_at`; index on
   `(order_id, created_at)`.
3. Partial index `store_order_hold_idx ON store_order(hold_expires_at) WHERE status IN
('pending_confirmation','confirmed','processing')`.
4. `DROP TRIGGER trg_order_status_cancel_restock` and recreate with the §3.5 `OLD.status`
   allowlist.
5. `CREATE TRIGGER trg_order_settlement_values_valid` — enum guard for `status`, `payment_status`,
   and `payment_method`, accepting legacy `placed`/`paid`/`simulated` values during the drain.
6. No backfill. Pre-pivot rows keep `placed`/`paid`/`simulated` and read as confirmed, paid rows.

Also in the same change: the Drizzle schema defaults become `pending_confirmation`/`unpaid`, the
frozen DDL copies in the spec test suite gain the 0019 shape, and the migration replay spec covers
the new migration.

### 4.2 Rollout stages

1. **Stage 0 — today.** Production runs the simulated path. No order rows exist beyond test data
   (`docs/todo.md` archive records 0 orders).
2. **Stage 1 — ship the schema and the new code.** Migration 0019 is additive; old instances keep
   working. New orders write the new vocabulary. The expiry job runs with `ORDER_HOLD_MINUTES` set.
3. **Stage 2 — drain and clean up.** After the deploy drains, verify with the OPS health/version
   gate, then run the staged `placed`→`confirmed`/`paid` read-alias cleanup and tighten the value
   trigger. Not required for launch.
4. **Stage 3 — launch.** Owner supplies the receiving accounts, the WhatsApp number, and the COD
   decision. The runbook gains the settlement checklist.

### 4.3 In-flight and legacy orders

- Pre-pivot rows (`placed`/`paid`/`simulated`, `hold_expires_at IS NULL`) are terminal for the
  expiry job. Admin actions still work through the alias mapping.
- Cancels of `stock_version = 'legacy'` rows keep using `cancelLegacyOrder`
  (`src/lib/server/admin/orders.ts:153-191`). Old atomic rows restock through the trigger because
  `placed` is in the allowlist.
- A rollback to an old build cannot encounter new status values in the admin filters; the filters
  match both vocabularies during the drain.

### 4.4 Known schema hazard: physical defaults

SQLite cannot alter a column default in place. `schema.ts` changes the application-facing defaults
to `pending_confirmation`/`unpaid`, but the physical `store_order` defaults stay `paid`/`simulated`
until data-integrity's single `store_order` rebuild (D1). Per the roadmap, D1 ships as
`0021_order_status_default.sql` when settlement has not been applied; when settlement lands first,
D1's rebuild content folds into 0019 once and 0021 is never created. Runtime code always writes
both columns explicitly.

### 4.5 Interaction with the catalog pivot

AgDR-0002 requires no schema change. Blend tables (`store_blend_benefit`, migration 0013) lose
their readers; their drop is a drain-gated staged migration outside this spec's scope.

---

## 5. Testing strategy

### 5.1 Unit tests (Vitest node project, `src/**/*.spec.ts`)

- `settlement/lifecycle.spec.ts` — the full transition matrix for both state machines, every guard,
  alias parsing (`placed`/`paid`), and rejection cases.
- `settlement/claims.spec.ts` — claim guards per method and status, duplicate handling, rate-limit
  behavior, event shapes.
- `settlement/expiry.spec.ts` — selection rules per method and status, grace window, and
  idempotency of concurrent runs against a fake clock.
- `env.spec.ts` — required configuration per enabled method and the production refusal.
- Checkout schema and route component specs for the method selector and the claim form.

### 5.2 DB-backed specs and DDL copies

- Trigger specs: reserve on insert, no restock for shipped/delivered cancellations, one restock per
  cancellation, value-guard acceptance of legacy values.
- DDL copies: the frozen spec files under `src/lib/server/db/spec-ddl/` gain the 0019 shape so
  libsql specs run the real triggers.

### 5.3 Migration replay

`src/lib/server/db/migration-replay.spec.ts` replays the full chain including `0019_settlement`
and asserts the new columns, table, indexes, and triggers.

### 5.4 Route tests

Checkout method selection, claim submission (auth, guards, rate limits), admin verify/reject/
refund/extend actions (role checks, audit rows), and the success and order pages.

### 5.5 E2E (Playwright, `E2E_USE_BUILD=1`)

- COD journey: add to cart, checkout with COD, order recorded `unpaid`, admin confirms, ships,
  delivers, marks paid.
- Transfer journey: select InstaPay, see the receiving account and amount, submit a claim, admin
  verifies, order proceeds.
- Expiry: seed an overdue hold, run the job (exposed through a test hook or the worker stub),
  assert cancellation and one restock.
- Blend retirement: `/blends` returns 301 to the blends category; a blend product page adds to the
  cart and checks out as a normal variant line.

### 5.6 Coverage reporting

The handover listed coverage reporting as a prerequisite for the first payment feature. Add a
coverage step to CI and a threshold floor for the settlement modules before the first production
order. The project declares the number in the PR.

### 5.7 Quality gate

`vp check`; `vp test --run`; `vp build`; `vp run test:e2e`; migration replay on libsql; the runbook
go-live checklist signed.

---

## 6. Observability

- Structured logs with a `[settlement]` prefix: `orderId`, `method`, `from`, `to`, `actor`,
  `durationMs`. Never log transfer references in full; mask them.
- Durable trail: `store_payment_event` plus `store_admin_audit` reconstruct every money-affecting
  action without logs.
- Review queue counters: claims older than 1 hour, holds expiring within 6 hours, unverified
  payments past the deadline, refunds recorded this week.
- Daily digest (Cairo 09:00 through the worker when M0 lands): counts by method and state, expired
  holds, refunds, and legacy rows.
- PostHog: `order_placed`, `payment_claim_submitted`, `payment_verified`, `hold_expired` with the
  order id and method; keep `purchase` as the success event.
- Dashboard: KPI splits collected (`paid`), awaiting review, and legacy simulated, using
  `payment_method` filters.

---

## 7. Security

- **Claims are untrusted input.** They can only move `unpaid`/`failed` to `pending_review`. No
  customer-controlled path reaches `paid`.
- **Authorization.** Claims require the order-access capability cookie or the owner session; admin
  actions re-check the role server-side on every request. Uniform 404s for unauthorized order
  access, as today.
- **Amount integrity.** Totals are computed server-side at placement and never accepted from the
  client. The claim form carries no amount.
- **PII.** The reference and note fields are free text and may contain personal data; render them
  escaped, keep them out of logs, and mask them in digests.
- **CSRF and bots.** Form actions keep the existing origin and nonce protections; the claim
  endpoint adds the rate limits from §3.4.3.
- **No new media surface.** No uploads in v1, so no new public object storage path and no
  content-type risk. The KV media route is unchanged.
- **No secrets.** Receiving accounts and the WhatsApp number are public by design. No credentials
  enter the client bundle.
- **Audit.** Every admin mutation writes `logAdminAction`; the event table is append-only by
  convention and trigger-guarded against updates and deletes where practical.
- **Legacy hygiene.** The `simulated` rows stay visible and excluded from collected-money KPIs.

---

## 8. Open decisions (each with a recommendation)

| #   | Decision               | Recommendation                                 | Alternative and why rejected                                                               |
| --- | ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| O1  | COD offered            | Yes, with `PAYMENTS_COD_ENABLED` as the switch | Drop COD: loses the owner's main channel                                                   |
| O2  | Hold window            | 24 hours, env-tunable, 5-minute grace          | 30 minutes: too short for a human transfer; 72 hours: holds jars too long for a small shop |
| O3  | Transfer proof         | No uploads; screenshot over WhatsApp           | Upload to KV: new public surface, PII handling, and review load with no verification gain  |
| O4  | WhatsApp number source | `PUBLIC_WHATSAPP_NUMBER` env                   | Hardcode: breaks staging and forks                                                         |
| O5  | Hold extension         | Admin action, +24 hours, audited               | No extension: forces cancel-and-reorder when a customer is late                            |
| O6  | Partial refunds        | Out of v1; full refunds only                   | Amount-based ledger now: complexity without a current use case                             |
| O7  | COD collection timing  | Mark `paid` at handover, after cash is in hand | Mark at confirmation: records money that may never arrive                                  |
| O8  | Receiving accounts     | Env configuration, one per method              | In-app settings table: no need at this size                                                |

---

## 9. Ordered task breakdown (0.5–2 days each)

| ID     | Task                                                                                                                                     | Est. | Depends on       | Deliverable / verification                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------- | ----------------------------------------------------- |
| SET-1  | Approve this spec; AgDR-0001 lands; roadmap/todo/decisions updates                                                                       | 0.5d | —                | Merged docs PR                                        |
| SET-2  | Migration `0019_settlement` + schema defaults + snapshot + replay spec + DDL copies                                                      | 1.5d | SET-1            | CI replay green; trigger specs pass                   |
| SET-3  | Settlement lifecycle core (`lifecycle.ts`, `types.ts`) plus the order/payment vocabulary rework across admin/i18n/email/export consumers | 2d   | SET-2            | Unit matrix green; `vp check` clean                   |
| SET-4  | Checkout method selection, transfer instructions, and the claim flow                                                                     | 1.5d | SET-3            | Route tests green; no amount accepted from the client |
| SET-5  | Success and order pages: order number, amount, claim form, WhatsApp CTA                                                                  | 1d   | SET-4            | Page specs green; CTA uses the configured number      |
| SET-6  | Admin review queue, settlement panel, and audited actions (verify, reject, refund, extend)                                               | 2d   | SET-3            | Action tests + audit rows asserted                    |
| SET-7  | Expiry job (`releaseExpiredHolds`) wired to the worker hook or its stub                                                                  | 1d   | SET-3            | Expiry tests + one-restock assertion                  |
| SET-8  | Email triggers and copy for the settlement states                                                                                        | 1d   | SET-3, M0 outbox | Outbox rows asserted per trigger                      |
| SET-9  | E2E journeys (COD, transfer, expiry, blend retirement)                                                                                   | 2d   | SET-4…SET-8      | Playwright suite green against the built artifact     |
| SET-10 | Coverage reporting and threshold for settlement modules                                                                                  | 1d   | SET-3            | CI coverage step + recorded floor                     |
| SET-11 | Security review pass and fixes                                                                                                           | 1d   | SET-6, SET-9     | Checklist signed; no blockers                         |
| SET-12 | Docs truth pass: architecture, runbook, data model, go-live checklist                                                                    | 0.5d | SET-11           | Docs match the shipped behavior                       |

**Tickets on `zeyadsleem/beeking-etman-website` (M1 series):** #4 docs, #5 migration, #6
lifecycle, #7 checkout, #8 order pages, #9 admin queue, #10 expiry, #11 notifications, #12 blend
retirement, #13 blend products, #14 coverage, #15 security and docs pass.

---

## 10. Phase 2 — Paymob (deferred)

`2026-09-13-order-lifecycle-payments-design.md` holds the gateway design: intention API, HMAC
webhook, idempotency ledger, reconciliation jobs, and refunds. Phase 2 must rebase it on this
spec's lifecycle:

- Reuse: `pending_review` extends naturally into a gateway-attempt state; `store_payment_event`
  absorbs webhook events; the hold and expiry mechanics stay.
- Replace: the `pending_payment` and 30-minute expiry vocabulary; provider intention ids;
  `store_payment_refund` if a ledger becomes necessary.
- Trigger: owner decision on Paymob merchant onboarding. Until then, no gateway code ships.

---

_This spec supersedes the payment goals, provider choice, and non-goals of the 2026-09-13 Paymob
spec for v1. Amendments require a dated ADR in `docs/decisions.md` and a corresponding update to
roadmap §3._
