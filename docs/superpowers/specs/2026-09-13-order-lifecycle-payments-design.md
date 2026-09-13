# Order Lifecycle & Payments (Paymob) — Design Spec

**Date:** 2026-09-13
**Status:** Proposed — awaiting owner approval
**Scope:** Replace simulated checkout with real Paymob payments (cards + Egyptian wallets), split the
order lifecycle into payment and fulfillment state machines, make stock reservation safe under
unpaid orders, add refunds/partial refunds, admin reconciliation, and a zero-overlap rollout plan.
**Owner decisions already locked:** Paymob committed; COD permanently removed; payments are the #1
launch blocker; the custom blend feature must survive unchanged (server-side expansion into
base + additive order units with per-variant stock decrement).

Money is integer piasters (1/100 EGP) everywhere; the codebase also calls these "qirsh"
(`docs/decisions.md` 2026-08-13). All amounts in this document are piasters.

**Roadmap:** `docs/superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md` is
authoritative for cross-spec arbitration (migration numbering, single ownership); this spec's
migration is frozen at `0019_payments.sql`.

---

## 1. Context & current state

### 1.1 The simulated payment path, end to end

1. **Checkout load** (`src/routes/checkout/+page.server.ts:26-47`) resolves the signed cart cookie,
   re-prices every line from the DB via `resolveCartItems`, computes totals with
   `computeTotals(items)` (`src/lib/cart.ts:133-141`), and issues a per-nonce proof cookie
   (`issueCheckoutNonce`).
2. **Submit action** (`src/routes/checkout/+page.server.ts:50-132`) rate-limits the IP
   (`CHECKOUT_LIMIT`, line 19), validates the shipping-only form
   (`createCheckoutSchema(lang)`, `src/lib/server/checkout-schema.ts:5-23`), verifies the nonce
   proof (line 68), and calls `createOrder` (line 77).
3. **`createOrder`** (`src/lib/server/orders.ts:273-397`) is idempotent per nonce
   (`findOrderByNonce` pre-check at line 281; UNIQUE catch at line 364), re-reads variant snapshots
   and re-prices from the DB (`loadVariantSnapshots` line 90, `validateCart` line 115), expands each
   blend into base + additive units (`orders.ts:125-192`), and writes order + items in one
   `db.batch` (lines 324-354). The order is written with `status = "placed"`,
   `payment_status = "simulated"`, `stock_version = "atomic"` (lines 337-339).
4. **Stock reservation** is owned by the `BEFORE INSERT` trigger on `store_order_item`
   (`drizzle/0016_order_hardening.sql:24-39`): when the parent order's `stock_version = 'atomic'`,
   it decrements `store_product_variant.stock` per unit and aborts the whole batch with
   `OUT_OF_STOCK` on shortage. Cancel-restock is a sibling `AFTER UPDATE OF status` trigger
   (`0016_order_hardening.sql:58-69`). App code never decrements stock for new orders.
5. **After creation** the action mints the order-access capability cookie (line 100), clears the
   cart (line 104), optionally saves the address (lines 105-122), sends the confirmation email
   (lines 124-129), and redirects to `/checkout/success/{id}` (line 131). Replays skip
   cart-clear/address/email (lines 101-103).
6. **Success page** (`src/routes/checkout/success/[id]/+page.server.ts:11-36`) grants access to the
   owner session or a valid capability cookie and shows `t("success.simulated")`
   (`src/routes/checkout/success/[id]/+page.svelte:33`).
7. **Emails** go through a durable outbox (`enqueueEmail`/`flushOutbox`,
   `src/lib/server/email.ts:70-120`) and the templates hard-code "Payment was simulated"
   (`email.ts:482`). The Pages project has no `EMAIL` binding (`wrangler.jsonc:25-28`), so
   `flushOutbox` marks rows `sent` after a silent no-op — silent loss, not a backlog (production
   `store_notification` count is 0; email spec §1.1). The separate email spec owns reliability and
   the Cron worker; this spec enqueues only via
   `enqueueEmail(db, payload, { type: OutboxType, idempotencyKey })` (§3.6) and never flushes inline.

### 1.2 What "paid" and "placed" mean today (legacy semantics)

- The physical `store_order.status` default is `"paid"` (`src/lib/server/db/schema.ts:110`) — a
  dangerous default; runtime code always writes `"placed"` explicitly (`orders.ts:337`).
- Pre-0016 rows can store `status = "paid"`; 0016+ rows store `"placed"`. `parseOrderStatus` aliases
  stored `"paid"` to display `"placed"` (`src/lib/admin-order-status.ts:8-11`), and the admin
  `placed` filter matches both stored values (`src/lib/server/admin/orders.ts:83-89`). **Neither
  value means money was collected.** They mean "order accepted and immediately fulfillable".
- `payment_status = "simulated"` (`schema.ts:111`, `orders.ts:338`) is the only other value in the
  wild. `stock_version` is `"atomic"` for 0016+ rows and `"legacy"` for older ones
  (`schema.ts:112`); the `legacy` path exists only for old-instance overlap (see
  `docs/decisions.md` 2026-09-09 and `docs/production-runbook.md` "Legacy catalog columns" section).
- Status vocabulary is shared client/server (`src/lib/admin-order-status.ts:3-22`), used by admin
  list/detail/export (`src/routes/admin/orders/export/+server.ts:42-43,90`), stats
  (`src/lib/server/admin/stats.ts:48`), invoices (`src/lib/server/invoice.ts:33`), email
  (`src/lib/server/email.ts:517-522`), and i18n (`orders.*`, `admin.orders.*` in
  `src/lib/i18n/messages.ts`).
- No payment provider code, no `PAYMOB_*` env vars, no webhook or ledger exists. Production
  validation only covers auth/order secrets (`src/lib/server/env.ts:19-42`).

### 1.3 Constraints this design must respect

- **D1 has no interactive transactions**; the project uses `db.batch` + conditional updates +
  triggers (`docs/decisions.md` 2026-08-23, 2026-09-09).
- **Cloudflare Pages cannot host scheduled handlers.** Cron Triggers are exclusively a Workers
  feature with a `scheduled()` handler (`https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/`).
  Expiry and reconciliation therefore run in the **shared Cron worker owned by the email spec**, or
  a dedicated Worker if that spec chooses one.
- Migrations are applied to remote D1 by CI **before** the Pages deploy
  (`.github/workflows/ci.yml:78-105` then `:107-144`), so old and new app instances overlap and every
  schema/write change must be readable by both builds (`docs/production-runbook.md:60-68`).
- The email outbox interface (`enqueueEmail`) is the only email integration point this spec uses;
  retry/backoff/dead-letter mechanics belong to the email spec.

---

## 2. Goals / Non-goals

### Goals

1. Collect real money via Paymob (cards + Egyptian wallets) with the **webhook/reconciliation as the
   only source of truth**; the browser redirect never proves payment.
2. Separate fulfillment from payment: a real `order.status` state machine and a real
   `payment_status` state machine, with explicit legacy mapping for `paid`/`placed`/`simulated`.
3. Reserve stock safely at order placement, release it automatically when payment is not completed,
   and restock exactly once on cancellation — without changing blend expansion.
4. Idempotent, HMAC-verified event processing; retries and missed webhooks recoverable via Paymob
   transaction inquiry.
5. Full and partial refunds with an auditable ledger and correct order/payment status effects.
6. Admin reconciliation surface and guarded manual payment actions.
7. Customer communication through the existing outbox at every lifecycle step.
8. A rollout that never breaks the currently deployed build and keeps a simulated mode for
   non-production.

### Non-goals

- **COD at any stage** — permanently removed per the owner decision (`docs/decisions.md`
  2026-09-02).
- Saved-card tokenization, subscriptions, Apple Pay/Google Pay, BNPL, kiosk, or Fawry flows; v1 is
  card + wallet integration IDs only.
- Multi-currency; EGP only.
- Returns/RMA workflow, exchange logic, or post-delivery refund restocking — a later returns spec
  owns line-level returns. This spec only defines the refund boundary (section 3.4).
- Email delivery internals (retry, backoff, dead-letter); the email spec owns them.
- Replacing the checkout form transport (SvelteKit server actions stay) or the oRPC search
  boundary.
- Changing blend pricing, composition, cart model, or expansion logic.

---

## 3. Proposed design

### 3.1 Two state machines

#### 3.1.1 `order.status` — fulfillment lifecycle

Canonical values and the alias:

| Value             | Meaning                                                      | Written by                        |
| ----------------- | ------------------------------------------------------------ | --------------------------------- |
| `pending_payment` | Order created; stock reserved; awaiting gateway confirmation | new checkout                      |
| `paid`            | Payment captured (or simulated); fulfillment queue           | webhook / reconciliation / manual |
| `processing`      | Admin has started preparing the order (optional hop)         | admin                             |
| `shipped`         | Dispatched                                                   | admin                             |
| `delivered`       | Handed to customer                                           | admin                             |
| `cancelled`       | Terminal; stock released if not yet shipped                  | expiry worker / admin             |
| `placed`          | **Legacy alias for `paid`; never written by new code**       | pre-change builds only            |

**Definitive rule (roadmap §3.2):** `placed` is a read alias of `paid`; new code never writes it,
and the only stored-value cleanup is this spec's one-way `placed`→`paid` rewrite staged after drain
(§4.2 stage 2). The single `store_order` rebuild belongs to data-integrity D1 (§4.4); this spec owns
the status vocabulary, not a rebuild.

`parseOrderStatus` (`src/lib/admin-order-status.ts:8-11`) changes:
`"placed"` → `"paid"` (legacy alias), `"paid"` → `"paid"`. The physical DB default at
`schema.ts:110` changes to `"pending_payment"` in the Drizzle schema (see section 4.4 for why the
physical default is only aligned later). All status consumers listed in section 1.2 must be
updated in the same change: `ORDER_STATUSES`, `TRANSITIONS`, `STATUS_ORDER`, label/badge/bar maps,
email `STATUS_LABELS` (`email.ts:517-522`), invoice labels (`invoice.ts:33`), CSV export
(`export/+server.ts:42-43,90`), stats (`stats.ts`), i18n keys `orders.*`/`admin.orders.*`, and the
8 spec DDL copies enumerated in section 5.1.

Transition table (enforced by `allowedTransitions` + the service's conditional UPDATE, following
`src/lib/server/admin/orders.ts:193-231`):

| From              | To           | Trigger                                                               | Enforcement                                                                                             |
| ----------------- | ------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pending_payment` | `paid`       | verified webhook success; reconciliation; guarded manual mark-paid    | conditional UPDATE `WHERE status='pending_payment' AND payment_status IN ('unpaid','pending','failed')` |
| `pending_payment` | `cancelled`  | expiry worker; admin                                                  | conditional UPDATE; restock trigger fires                                                               |
| `paid`            | `processing` | admin                                                                 | conditional UPDATE                                                                                      |
| `paid`            | `shipped`    | admin (skip processing for small ops)                                 | conditional UPDATE                                                                                      |
| `paid`            | `cancelled`  | admin, only via refund-first flow (3.4)                               | conditional UPDATE; restock trigger fires                                                               |
| `processing`      | `shipped`    | admin                                                                 | conditional UPDATE                                                                                      |
| `processing`      | `cancelled`  | admin, refund-first                                                   | conditional UPDATE; restock trigger fires                                                               |
| `shipped`         | `delivered`  | admin                                                                 | conditional UPDATE                                                                                      |
| `shipped`         | —            | post-shipment reversal is a refund/returns concern, not a status flip | v1 disallows `shipped → cancelled`                                                                      |
| `delivered`       | —            | terminal (returns spec may add states)                                | —                                                                                                       |
| `cancelled`       | —            | terminal                                                              | —                                                                                                       |

**Rejected alternative:** keeping `placed` as the fulfillment state and adding only
`pending_payment` (smaller rename). Rejected because `placed` never distinguished payment from
fulfillment, and the owner's locked plan calls for an explicit payment-confirmed state; keeping it
would preserve the ambiguity this redesign exists to remove. Cost accepted: vocabulary churn in
admin/email/i18n and the `placed` alias for the old-instance overlap window.

**Rejected alternative:** dropping `processing` (paid → shipped directly). The state remains
allowed to skip, but the state exists so multi-step operations can queue work without pretending it
has shipped.

#### 3.1.2 `payment_status` — money lifecycle

| Value                | Meaning                                                       | Written by                        |
| -------------------- | ------------------------------------------------------------- | --------------------------------- |
| `unpaid`             | No payment attempt yet                                        | new checkout                      |
| `pending`            | A Paymob intention/attempt is in flight                       | pay page on intention creation    |
| `paid`               | Captured by the gateway (verified)                            | webhook / reconciliation / manual |
| `failed`             | Declined, errored, or in-flight attempt window closed         | webhook / expiry                  |
| `partially_refunded` | Some money returned; `Σ refunds < captured amount`            | refund service                    |
| `refunded`           | All captured money returned; `Σ refunds == captured amount`   | refund service                    |
| `simulated`          | Demo/legacy: no real money; excluded from reconciliation/KPIs | simulated mode / pre-gateway rows |

New-column additions on `store_order` (all additive):

| Column                  | Type                           | Notes                                             |
| ----------------------- | ------------------------------ | ------------------------------------------------- |
| `payment_provider`      | TEXT NOT NULL DEFAULT `'none'` | `none` \| `paymob` \| `simulated`                 |
| `payment_expires_at`    | INTEGER NULL                   | epoch ms; set on `pending_payment` rows           |
| `paid_at`               | INTEGER NULL                   | set when `payment_status` becomes `paid`          |
| `provider_intention_id` | TEXT NULL                      | Paymob intention `id`, for support/reconciliation |

`payment_status` transition table:

| From                              | To                   | Trigger                                               |
| --------------------------------- | -------------------- | ----------------------------------------------------- |
| — (row created)                   | `unpaid`             | checkout                                              |
| `unpaid` / `failed`               | `pending`            | pay page creates a Paymob intention                   |
| `unpaid` / `pending` / `failed`   | `paid`               | verified success (webhook, reconciliation, manual)    |
| `unpaid`                          | `simulated` → `paid` | simulated mode auto-confirms at order creation        |
| `pending`                         | `failed`             | verified failure webhook; expiry of in-flight attempt |
| `paid`                            | `partially_refunded` | refund success while `Σ refunds < captured`           |
| `paid` / `partially_refunded`     | `refunded`           | refund success while `Σ refunds == captured`          |
| `refunded` / `partially_refunded` | —                    | terminal in v1; further refunds are rejected          |

Combination invariants (enforced by a `store_order` trigger on INSERT/UPDATE plus service-level
guards):

- `status = 'pending_payment'` requires `payment_status IN ('unpaid','pending','failed','simulated')`.
- `status IN ('paid','processing','shipped','delivered')` requires
  `payment_status IN ('paid','partially_refunded','refunded','simulated')`.
- A success event may only set `payment_status='paid'`; it must never silently apply to a
  `cancelled` order (section 3.3.7).

**Migration from `simulated`:** no data rewrite. `simulated` remains the honest value for every
order created before the gateway existed and for simulated-mode orders; reconciliation and money
KPIs filter it out via `payment_provider` (`none`/`simulated`). Production Paymob mode never writes
it. This is deliberately simpler than rewriting rows to a `legacy_simulated` value and dropping it
later; the information is carried by `payment_provider`, and rewriting rows would add migration
risk for zero behavioral gain.

### 3.2 Stock reservation semantics

**Decision: reserve at order placement; release on expiry; restock on cancellation.** This keeps
the existing 0016 trigger path exactly as-is for the blend expansion flow.

- `createOrder` continues to insert `stock_version = 'atomic'`; the
  `trg_order_item_reserve_stock` trigger (`0016_order_hardening.sql:24-39`) decrements each
  expanded variant unit atomically and aborts the batch on shortage. No new app-side stock code.
- New `pending_payment` rows get `payment_expires_at = now + expiry` (default 30 minutes;
  `PAYMENT_EXPIRY_MINUTES` env, section 3.7). The Paymob intention `expiration` is set to the same
  window so the hosted checkout link dies with the hold.
- The Cron worker runs `releaseExpiredPayments(db, now)` every 5 minutes: selects up to 100 orders
  with `status='pending_payment' AND payment_expires_at <= now - 300_000` (5-minute grace) using the
  partial index, and per order runs a conditional UPDATE
  `SET status='cancelled', payment_status = CASE WHEN payment_status='pending' THEN 'failed' ELSE payment_status END`
  `WHERE id=? AND status='pending_payment' AND payment_expires_at <= ?`. The existing cancel-restock
  trigger returns the reserved units exactly once; the conditional guard makes concurrent runs
  idempotent.
- Restock guard fix (required): the current cancel-restock trigger restocks on **every** atomic
  cancellation, including a hypothetical post-shipment cancel. Migration 0019 recreates it with
  `AND OLD.status IN ('pending_payment','paid','processing','placed')` so shipped/delivered
  reversals never restock. (`placed` is included so old instances cancelling their own
  atomic orders still restock during overlap.)
- Expired rows with `payment_status='unpaid'` stay `unpaid` (abandoned before an attempt); rows with
  `pending` become `failed` (attempt window closed). This keeps funnel semantics honest without
  inventing an `expired` value outside the agreed enum.

**Rejected alternative: reserve at payment success.** It holds no stock for unpaid orders, but a
customer can pay for an item that sold out between intention and webhook; the only remedy is an
immediate refund (fees, support load, bad UX), and it would force a new debit path outside the
0016 trigger with compensation logic. The 30-minute hold is an acceptable cost for a small catalog.

### 3.3 Paymob integration

Verified against Paymob's current documentation (June 2026): Intention API
(`https://developers.paymob.com/paymob-docs/developers/intention-apis/create-intention`), Unified
Checkout redirect, and the HMAC field order
(`https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback`).

#### 3.3.1 Checkout flow

```
customer submits shipping form
  └─ createOrder → status=pending_payment, payment_status=unpaid, stock reserved (trigger)
     └─ redirect 303 → /checkout/pay/{orderId}      (order-access capability cookie set)
        └─ customer clicks "Pay now" (POST ?/pay)
           ├─ server creates Paymob intention (amount = stored order.total)
           ├─ payment_status=pending, provider_intention_id saved
           └─ redirect 303 → https://accept.paymob.com/unifiedcheckout/?publicKey=…&clientSecret=…
              └─ hosted checkout (card or wallet) completes
                 ├─ Paymob POSTs notification_url → /api/payments/paymob/webhook  ← source of truth
                 └─ Paymob redirects browser → /checkout/pay/{orderId}?returned=1 ← UX only
                    └─ page polls GET /checkout/pay/{orderId}/status until paid → redirect success
```

In simulated mode (`PAYMENTS_PROVIDER=simulated`, non-prod/pre-launch), the checkout skips the pay
page entirely: `createOrder` immediately sets `status='paid'`, `payment_status='simulated'`,
`payment_provider='simulated'`, and the flow redirects straight to `/checkout/success/{id}` as
today. That keeps existing e2e journeys working and production pre-launch non-transactable in the
same way it is now.

**Redirect, not iframe.** Recommendation: redirect to Paymob's hosted Unified Checkout.
Rejected iframe/pixel embedding: no PCI benefit (both keep card fields on Paymob), and embedding
adds third-party cookie/CSP/mobile-viewport failure modes. Trade-off accepted: the customer leaves
the site, and the return URL is unsigned — which is exactly why the webhook is the only state
authority.

#### 3.3.2 Intention creation (`POST /v1/intention/`)

Adapter module: `src/lib/server/payments/paymob.ts` (server-only). Request:

```json
{
  "amount": 123450,
  "currency": "EGP",
  "payment_methods": [<PAYMOB_INTEGRATION_ID_CARD>, <PAYMOB_INTEGRATION_ID_WALLET>],
  "items": [
    { "name": "<order item name>", "amount": 12300, "quantity": 1, "description": "" },
    { "name": "Shipping", "amount": 4500, "quantity": 1, "description": "" }
  ],
  "billing_data": {
    "first_name": "<first token>", "last_name": "<rest or '.'>", "phone_number": "<order.phone>",
    "email": "<order.email>", "street": "<order.address>", "building": "NA", "floor": "NA",
    "apartment": "NA", "city": "<order.city>", "state": "<order.city>", "country": "EGY",
    "postal_code": "NA"
  },
  "customer": { "first_name": "<first token>", "last_name": "<rest or '.'>", "email": "<order.email>" },
  "special_reference": "<order.id>",
  "notification_url": "<ORIGIN>/api/payments/paymob/webhook",
  "redirection_url": "<ORIGIN>/checkout/pay/<order.id>?returned=1",
  "expiration": 1800
}
```

- Header: `Authorization: Token <PAYMOB_SECRET_KEY>` (Intention API uses the secret key; the
  legacy Accept API — refunds/inquiry — uses `PAYMOB_API_KEY` to obtain a 60-minute bearer token).
- `amount` and every item amount are re-derived server-side from the stored order; the client never
  supplies an amount. `items` includes a shipping line when `shipping_cost > 0` so item amounts sum
  to `total`.
- `special_reference` is the internal order id and comes back in callbacks as
  `order.merchant_order_id`.
- Response `201` gives `id` (intention id) and `client_secret`; persist `id` to
  `provider_intention_id`, set `payment_status='pending'`, then redirect to
  `https://accept.paymob.com/unifiedcheckout/?publicKey=<PAYMOB_PUBLIC_KEY>&clientSecret=<client_secret>`.
- One intention per "Pay now" click. Old intentions expire on their own; a failed/expired attempt
  can start a new one (section 3.3.6). Rate limit intention creation: 5 per 10 minutes per order id
  and 10 per 10 minutes per IP, via `createDbRateLimiter` (`src/lib/server/rate-limit.ts`), keys
  `pay-order:{orderId}` and `pay-ip:{ip}`.

#### 3.3.3 Webhook route (source of truth)

Route: `src/routes/api/payments/paymob/webhook/+server.ts` — POST only (405 otherwise), exported as
a SvelteKit `+server.ts` so Pages serves it at
`https://<origin>/api/payments/paymob/webhook`.

Processing order:

1. Reject bodies over 100 KB. Read the **raw body text** (the HMAC is over field values, not raw
   bytes, but parse only after verification).
2. Read `hmac` from the URL query (`?hmac=<hex>`); verify before parsing or logging anything else.
3. Parse JSON; accept the wrapper `{ "type": "TRANSACTION", "obj": {…} }`; reject other types.
4. Validate values (amount, currency, integration, flags) before any state write (section 3.3.4).
5. Insert the event idempotently into `store_payment_event` (section 3.3.5).
6. Apply the state transition; mark the event `processed`, `ignored`, or leave `received` for retry.
7. Enqueue customer/admin emails through `enqueueEmail` only — the email spec's worker owns
   delivery and this route never flushes inline.
8. Respond: `200` for processed/replay/ignored events (Paymob retries on non-2xx), `401` invalid
   HMAC, `400` malformed, `500` only for transient DB failures so the provider retries.

#### 3.3.4 HMAC verification algorithm

Per Paymob's transaction callback documentation, concatenate these 20 values in this exact order,
with no separators, using the POST (`obj.*`) shape:

```
amount_cents
created_at
currency
error_occured
has_parent_transaction
obj.id
integration_id
is_3d_secure
is_auth
is_capture
is_refunded
is_standalone_payment
is_voided
order.id
owner
pending
source_data.pan
source_data.sub_type
source_data.type
success
```

- Booleans stringify lowercase (`true`/`false`); numbers stringify as JSON numbers; missing optional
  values stringify as empty strings (match Paymob's sample, e.g. `null` → `""` for source_data
  fields where applicable).
- Compute HMAC-SHA512 with `PAYMOB_HMAC_SECRET` using WebCrypto
  (`crypto.subtle.importKey("raw", secret, {name:"HMAC",hash:"SHA-512"}…)` then `sign`, hex-encode).
- Compare with the `hmac` query parameter in constant time (decode the provided hex and use
  `crypto.subtle.verify`, or a fixed-time XOR compare over equal-length buffers). Mismatch → `401`
  and a metrics counter; never process.
- GET/response callbacks (`id`/`order_id` fields) are not accepted; only the POST
  transaction-processed shape is a valid state source.

#### 3.3.5 `store_payment_event` — idempotency ledger

| Column            | Type                               | Notes                                                            |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `id`              | TEXT PK                            | `crypto.randomUUID()`                                            |
| `order_id`        | TEXT NULL FK → `store_order(id)`   | null until resolved from merchant_order_id                       |
| `provider`        | TEXT NOT NULL DEFAULT `'paymob'`   | `paymob` \| `manual`                                             |
| `provider_txn_id` | TEXT NOT NULL                      | Paymob `obj.id` (or manual UUID)                                 |
| `type`            | TEXT NOT NULL                      | `transaction` \| `refund` \| `manual`                            |
| `success`         | INTEGER NULL                       | 0/1                                                              |
| `pending`         | INTEGER NULL                       | 0/1                                                              |
| `amount_cents`    | INTEGER NULL                       | from the payload, for mismatch detection                         |
| `currency`        | TEXT NULL                          | expected `EGP`                                                   |
| `raw_payload`     | TEXT NOT NULL                      | JSON as received (masked PAN only)                               |
| `status`          | TEXT NOT NULL DEFAULT `'received'` | `received` \| `processed` \| `ignored` \| `rejected` \| `manual` |
| `note`            | TEXT NULL                          | mismatch/edge classification                                     |
| `received_at`     | INTEGER NOT NULL                   | epoch ms                                                         |
| `processed_at`    | INTEGER NULL                       | epoch ms                                                         |

Constraints/indexes: `UNIQUE(provider, provider_txn_id)` (idempotency), index on `order_id`,
index on `(status, received_at)`.

Idempotent insert: `INSERT … ON CONFLICT(provider, provider_txn_id) DO NOTHING`. If no row is
inserted, the event is a replay or a legitimate later event on the same transaction; acknowledge
`200` without re-applying. Process event-first, then the order UPDATE, then mark
`processed`: a crash in between leaves `received`, which reconciliation re-drives. Refund callbacks
are separate transactions with their own ids (`parent_transaction` links them), so the unique key
does not block them.

#### 3.3.6 Payment attempt / retry UX

- `GET /checkout/pay/[id]` (load): access gate identical to the success page (owner session OR
  `order-access` capability; uniform 404 otherwise — pattern at
  `src/routes/checkout/success/[id]/+page.server.ts:34-36`). Renders order summary and state:
  - `pending_payment` + not expired → "Pay now" form (`POST ?/pay`).
  - `pending` + not expired → "awaiting confirmation" with a polling status check.
  - `failed` + not expired → "payment failed" + "Pay again" (new intention).
  - expired → explain the hold was released and stock returned; offer a fresh checkout (cart was
    cleared at order creation; the pay page links back to the catalog and, for logged-in users,
    order history). No re-pay on an expired order because the reservation is gone.
  - `paid` → redirect 303 to `/checkout/success/{id}`.
- `POST ?/pay` action: re-checks state transactionally before creating an intention; a pay click on
  an already-paid order redirects to success; on cancelled/expired redirects to the expired view.
- `GET /checkout/pay/[id]/status` (`+server.ts`): access-gated JSON
  `{ orderStatus, paymentStatus }`, rate-limited 60/min per IP; the page polls every 4 s while
  `pending` or after `?returned=1`, then redirects to success when `payment_status='paid'`.
- `/checkout/success/[id]` keeps its capability gate and becomes the paid confirmation page; its
  load redirects `pending_payment` orders to the pay page. The simulated banner is shown only when
  `payment_provider='simulated'`.
- Wallet caveat: `redirection_url` is documented as supported for cards and wallets, but if a wallet
  flow does not return the browser, the customer still gets the confirmation email; the pay page is
  reachable from the existing order link.

#### 3.3.7 Late success after expiry, and reconciliation

- Intention expiration equals the hold window, so a successful payment after our cancellation
  should be rare. If a verified success event arrives for an order cancelled by expiry: record the
  event with `status='processed'`, `note='paid_after_cancel'`, leave the order cancelled, and raise
  a high-priority admin notification. Rule: **money is never silently dropped** — an admin either
  re-activates the order (if stock can be re-reserved) or refunds it from the order detail.
- `reconcilePendingPayments(db, paymob, { maxAgeMs: 24h, limit: 50 })` (Cron worker, section 3.7):
  selects `status='pending_payment'` orders in the window and queries Paymob transaction inquiry by
  `merchant_order_id` (legacy Accept API: `PAYMOB_API_KEY` → bearer token, then inquiry). Any
  successful transaction is normalized into the same `processPaymobTransaction` function used by the
  webhook, so idempotency and transitions are shared. Missed failures mark events `ignored`.
- `payment_event` makes reconciliation auditable: a payment is never applied twice, whether it
  arrives by webhook, replay, or inquiry.

### 3.4 Refunds & partial refunds

Table `store_payment_refund`:

| Column                   | Type                                 | Notes                                  |
| ------------------------ | ------------------------------------ | -------------------------------------- |
| `id`                     | TEXT PK                              | `crypto.randomUUID()`                  |
| `order_id`               | TEXT NOT NULL FK → `store_order(id)` |                                        |
| `payment_txn_id`         | TEXT NOT NULL                        | original captured Paymob `obj.id`      |
| `provider_refund_txn_id` | TEXT UNIQUE NULL                     | set on provider success                |
| `amount_cents`           | INTEGER NOT NULL CHECK > 0           |                                        |
| `reason`                 | TEXT NOT NULL                        | required admin note                    |
| `status`                 | TEXT NOT NULL DEFAULT `'requested'`  | `requested` \| `succeeded` \| `failed` |
| `error`                  | TEXT NULL                            | provider error on failure              |
| `requested_by`           | TEXT NULL                            | admin `user.id`                        |
| `created_at`             | INTEGER NOT NULL                     |                                        |
| `completed_at`           | INTEGER NULL                         |                                        |

Index on `order_id`. Provider call: legacy Accept API refund
(`POST /api/acceptance/void_refund/refund` with the bearer token, original `transaction_id`, and
`amount_cents`; void is the same-day alternative for fee avoidance and is out of scope for v1
beyond a documented option). Requested refunds are persisted before the provider call so a crash
mid-call leaves an auditable `requested` row.

Rules:

- Refundable amount = captured amount (for real Paymob payments: the verified `amount_cents`) minus
  `SUM(amount_cents)` of succeeded refunds. Over-refund attempts are rejected with `409`.
- On success: set `provider_refund_txn_id`, `status='succeeded'`, `completed_at`, then recompute
  `payment_status` (`partially_refunded` or `refunded`) in the same conditional update, audit, and
  enqueue the refund email.
- On failure: `status='failed'` + `error`; order state unchanged; a retry is a new request row.
- **Restock policy (boundary with the returns spec):** refunds never restock by themselves.
  Order-level cancellation restocks through the existing cancellation trigger; an inspected return
  restocks only `good` quantities through the commerce spec's stock-adjustment service
  (`reason_code='return_restock'`, data-integrity movement schema) — the explicit exception. The
  admin UI offers "Cancel & refund" for
  `paid`/`processing` orders, which calls the refund first and only cancels (trigger restocks) after
  the refund succeeds; if the cancel step fails after a successful refund, the order stays active
  with `payment_status=refunded`/`partially_refunded` and appears in reconciliation for a manual
  retry. Post-`shipped` refunds change only `payment_status`; line-level returns/restock are the
  later returns spec's job.
- Partial refunds are **amount-based** in v1: the ledger records no line allocation. Trade-off
  accepted: simpler schema and math now; the returns spec can add `store_return` + line links later
  without rewriting refund rows. Admin UI shows the remaining refundable amount.

The single exported refund entry point — every caller (including the commerce spec §3d) copies this
signature exactly:

```ts
// src/lib/server/payments/refunds.ts
export interface RefundResult {
  refundId: string;
  status: "succeeded" | "failed";
  error?: string;
}

export async function refundOrder(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  amountCents: number,
  reason: string,
  adminUserId: string,
): Promise<RefundResult>;
```

### 3.5 Admin

- **Orders list** (`src/lib/server/admin/orders.ts:77-121`, `src/routes/admin/orders/+page.server.ts`)
  gains a payment badge column and a `payment` filter (`unpaid|pending|paid|failed|refunded|
partially_refunded|simulated`) alongside the status filter; `listOrders` conditions extend
  accordingly. The status filter for `paid` matches stored `['paid','placed']` during the overlap
  (replaces today's `placed` filter at `admin/orders.ts:83-89`). CSV export
  (`export/+server.ts:42-43`) and the export status label map update in lockstep.
- **Order detail** (`src/routes/admin/orders/[id]/+page.server.ts`) gains a payment panel: payment
  status, provider, paid-at, expiry, intention/transaction references, event history link, and
  refund history. New actions, all re-checking `isAdminRole` server-side like the existing action
  (lines 31-34) and writing `logAdminAction` (`src/lib/server/admin/audit.ts`):
  - `mark_paid` — guardrails: only when `status='pending_payment'` and `payment_status IN
('unpaid','failed')`; requires a provider reference (Paymob transaction id) and a note; inserts
    a `store_payment_event` row (`provider='manual'`, `type='manual'`, `status='manual'`) and applies
    the same conditional paid update. Manual events are visibly flagged in reconciliation. Rejected
    alternative: banning manual mark-paid entirely (blocks legitimate offline reconciliation) and
    free-form marking without a reference (unauditable/fraud-prone).
  - `refund` — amount (defaults to full remaining) + required reason; calls the refund service
    (3.4).
  - `cancel_refund` — the composite refund-first flow for `paid`/`processing` orders.
- **Reconciliation page** `/admin/payments`: filterable list of `store_payment_event` and
  `store_payment_refund` rows with status, mismatch notes, manual events, and links to orders;
  plus counters for `received` older than 15 minutes and refunds `failed`. No charting in v1.

### 3.6 Customer communication triggers

All emails go through the canonical interface
`enqueueEmail(db, { recipient, subject, html, text }, { type: OutboxType, idempotencyKey })` from
the email spec, and the email spec's worker drains; this spec only adds calls and copy. The `type`
values below are members of the canonical `OutboxType` union (email spec §3.3).

| Lifecycle event                 | Email type          | Recipient        | Notes                                                                 |
| ------------------------------- | ------------------- | ---------------- | --------------------------------------------------------------------- |
| Order created, awaiting payment | `order_received`    | customer         | Replaces today's confirmation; clearly states payment is not complete |
| Payment confirmed               | `payment_confirmed` | customer + admin | Admin new-order digest moves here from order creation                 |
| Payment failed                  | `payment_failed`    | customer         | Includes a "Pay again" link while the hold is valid                   |
| Expiry after a pending attempt  | `payment_failed`    | customer         | Sent only when `payment_status` was `pending`; silent if `unpaid`     |
| Shipped / delivered / cancelled | `status_update`     | customer         | Existing `sendOrderStatusUpdate` (`email.ts:524-560`) with new labels |
| Refund completed                | `refund`            | customer         | Includes amount returned                                              |
| Paid after cancel (edge)        | `admin_alert`       | admin            | "Money received for cancelled order" (section 3.3.7)                  |

Copy rule: the "Payment was simulated" line (`email.ts:482`,
`messages.ts:260/990`) moves behind the simulated provider; Paymob-mode emails must not claim
simulation, and simulated-mode emails must not claim a charge.

### 3.7 Environment & secrets

| Variable                       | Purpose                                                                      | Required when              |
| ------------------------------ | ---------------------------------------------------------------------------- | -------------------------- |
| `PAYMENTS_PROVIDER`            | `simulated` (default) \| `paymob`                                            | always (default simulated) |
| `PAYMOB_SECRET_KEY`            | Intention API `Authorization: Token …`                                       | `paymob`                   |
| `PAYMOB_PUBLIC_KEY`            | Unified Checkout redirect URL                                                | `paymob`                   |
| `PAYMOB_API_KEY`               | Accept API bearer token (refund/inquiry)                                     | `paymob`                   |
| `PAYMOB_INTEGRATION_ID_CARD`   | card integration id (numeric)                                                | `paymob`                   |
| `PAYMOB_INTEGRATION_ID_WALLET` | wallet integration id (numeric)                                              | `paymob`                   |
| `PAYMOB_HMAC_SECRET`           | callback HMAC-SHA512 secret                                                  | `paymob`                   |
| `PAYMOB_BASE_URL`              | default `https://accept.paymob.com`; must be `https` and a known Paymob host | `paymob`                   |
| `PAYMENT_EXPIRY_MINUTES`       | optional, default `30`                                                       | —                          |

- `src/lib/server/env.ts:19-42` gains: when `PAYMENTS_PROVIDER === 'paymob'`, require every
  `PAYMOB_*` above; integration ids must be numeric strings; `PAYMOB_BASE_URL` must start with
  `https://` and its host must be in an allowlist (`accept.paymob.com`, `uae.paymob.com`,
  `oman.paymob.com`, `sa.paymob.com`) to prevent a mis-set env from becoming an SSRF vector.
  `simulated` mode (the default, including dev/test/build) requires none of them.
- Secrets live in the Pages project's Settings → Variables and Secrets
  (`docs/production-runbook.md:110-113`) and, because Pages has no scheduled handlers, in the Cron
  worker's own secret store with its own D1 binding to the same `beeking` database. CI needs no
  Paymob secrets. `.dev.vars.example` gains dummy entries (implementation task). The ops spec's
  secret preflight (ops spec §3.5.3) conditionally checks every `PAYMOB_*` key above for presence
  when `PAYMENTS_PROVIDER=paymob` (presence only; the API never returns values).

### 3.8 Module layout

New server modules (single responsibility, testable without routes):

- `src/lib/server/payments/paymob.ts` — intention creation, transaction inquiry, refund, HMAC
  verification, base-URL allowlist, redaction-safe errors.
- `src/lib/server/payments/lifecycle.ts` — payment/order transition guards, `parsePaymentStatus`,
  `applyPaymentOutcome(db, normalized)` shared by webhook/reconciliation/manual, expiry release,
  reconciliation selection.
- `src/lib/server/payments/refunds.ts` — refund request/complete/recompute.
- `src/lib/server/payments/types.ts` — shared shapes for normalized events.
- Routes: `src/routes/api/payments/paymob/webhook/+server.ts`,
  `src/routes/checkout/pay/[id]/+page.server.ts`, `.../+page.svelte`,
  `.../status/+server.ts`.
- Cron entry: exported `runPaymentJobs(db, paymob, now)` called by the shared worker's
  `scheduled()` handler.

Existing files touched: `orders.ts` (status/payment status/expiry/provider writes,
`CreateOrderResult.requiresPayment`), `email.ts` (types/copy), `admin-order-status.ts` (vocabulary),
`admin/orders.ts` (filter/transitions), admin routes, env, i18n, schema, migrations, specs.

---

## 4. Migration & rollout

### 4.1 Migration `0019_payments` (number frozen by the program roadmap; journal currently ends at `0017_catalog_authority`, `drizzle/meta/_journal.json:124-130`)

Generated with `drizzle-kit generate` and hand-reviewed (project convention), contents:

1. `ALTER TABLE store_order ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'none'`,
   `payment_expires_at INTEGER`, `paid_at INTEGER`, `provider_intention_id TEXT` (all additive).
2. `CREATE TABLE store_payment_event` + `UNIQUE(provider, provider_txn_id)` + indexes.
3. `CREATE TABLE store_payment_refund` + `UNIQUE(provider_refund_txn_id)` + index.
4. Partial index `store_order_pending_payment_idx ON store_order(payment_expires_at) WHERE status='pending_payment'`.
5. `DROP TRIGGER trg_order_status_cancel_restock`; recreate with the
   `OLD.status IN ('pending_payment','paid','processing','placed')` guard (section 3.2).
6. `CREATE TRIGGER trg_order_payment_values_valid` (INSERT/UPDATE enum guard for `status` +
   `payment_status`, accepting the legacy `placed`/`simulated` values during overlap) and
   `CREATE TRIGGER trg_order_payment_consistency` (combination invariants from 3.1.2).
7. No backfill of existing rows: legacy `placed`/`paid`/`simulated` rows keep their stored values
   and are interpreted by the read mapping (section 3.1.1). This mirrors the 0016 no-rewrite
   decision so old and new builds coexist.

Also required in the same change: update the pre-0016 DDL in
`src/lib/server/db/migration-replay.spec.ts` only if it starts the replay after 0017 (it currently
tests 0016 in isolation), and add a new replay test for 0019 (section 5.3).

### 4.2 Rollout stages (zero-overlap, flag-driven)

1. **Stage 0 — today.** Production has no Paymob secrets; simulated path unchanged.
2. **Stage 1 — ship the schema + code with `PAYMENTS_PROVIDER=simulated`.** CI applies 0019
   (additive; old instances keep working), then deploys the new build. New simulated orders write
   `status='paid'`, `payment_status='simulated'`; old instances understand `paid` (legacy alias) and
   never read `payment_status`, and the status filter still matches. Expiry/reconciliation jobs skip
   `payment_provider != 'paymob'`.
3. **Stage 2 — drain old instances.** After the Pages deploy rollout completes, verify the drain via
   the ops spec's `/api/health` version check and `verify-production` SHA gate (ops spec
   §3.5.1-3.5.2); the `placed` alias remains for stored rows but no live writer emits it. Then this
   spec's staged `placed`→`paid` cleanup (outside the journal, mirroring
   `drizzle/staged/0017_drop_legacy_product_columns.sql`): rewrite `status='placed'` → `'paid'` and
   tighten the value trigger. Not required for launch; the single `store_order` rebuild is
   data-integrity D1 (§4.4).
4. **Stage 3 — sandbox verification.** Owner provides Paymob **test** credentials; set
   `PAYMENTS_PROVIDER=paymob` with test keys and run the manual checklist (section 5.5): intention,
   card success, wallet success, failure, expiry, webhook replay, refund.
5. **Stage 4 — go live.** Replace with live keys in Pages + Cron worker, keep
   `PAYMENTS_PROVIDER=paymob`, smoke-test one low-value real payment and refund. This is config-only
   (runtime `$env/dynamic/private`), so rollback to simulated is a single env change.

### 4.3 In-flight orders during each deploy

- Old simulated orders (`placed`/`simulated`, `payment_expires_at IS NULL`) are terminal for the
  expiry job and render as `paid`/`simulated`; admins fulfill or cancel them normally. Cancels of
  `stock_version='legacy'` rows still go through `cancelLegacyOrder`
  (`src/lib/server/admin/orders.ts:153-191`); cancels of old atomic rows restock through the trigger
  because `placed` is in its `OLD.status` allowlist.
- Orders that are `pending_payment` cannot exist until a new instance creates one, so a rollback to
  the old build cannot encounter them in the admin list; if a rollback happens while Paymob mode was
  on, pending orders stay pending until the flag is restored (expiry only runs in the worker; the
  worker keeps running the release job regardless of provider, so holds still release).

### 4.4 Known schema hazard: physical defaults

SQLite cannot alter a column default in place. `schema.ts:110-111` changes the application-facing
defaults to `pending_payment`/`unpaid` for new databases and generated DDL, but the physical
`store_order` defaults stay `paid`/`simulated` until data-integrity's single `store_order` rebuild
(D1). Per the roadmap, D1 ships as `0021_order_status_default.sql` when payments has not been
applied; when payments lands first, D1's rebuild content is folded into this migration once and
0021 is never created — data-integrity owns that content and the capture-and-recreate rule, and
payments deletes its staged rebuild, owning only the canonical vocabulary and the `placed`→`paid`
cleanup. Runtime code always writes both columns explicitly (`orders.ts:337-338` will be updated to
write the new values), and raw SQL inserts (seed/specs) must set them explicitly.

---

## 5. Testing strategy

### 5.1 Unit tests (Vitest node project, `src/**/*.spec.ts`)

- **Transition matrix:** every legal/illegal `order.status` and `payment_status` transition,
  including the `placed`/`paid` alias, skip paths (`paid→shipped`), and post-shipment cancel
  rejection. Extend `src/lib/server/admin/orders.spec.ts` expectations
  (current tests at lines 232-251 assert the old matrix).
- **HMAC verification fixtures:** a valid callback built from Paymob's documented sample values
  (including booleans and nulls), tampered field, wrong secret, missing/short `hmac`, GET-shaped
  payload rejection, and a payload with a different integration id.
- **Normalized event application:** amount mismatch, currency mismatch, already-paid replay,
  success after cancel, failure then retry then success; assert exactly-once updates with the
  conditional UPDATE predicates.
- **Idempotency:** two inserts of the same `provider_txn_id` yield one event and one state change;
  concurrent processing is serialized by the unique constraint.
- **Refund math:** partials summing below/at/above captured; rejected over-refund; status
  recomputation; provider failure leaves `failed` and unchanged order.
- **Expiry:** only orders past the grace window with `pending_payment` are released; `unpaid` stays
  `unpaid`, `pending` becomes `failed`; a second run is a no-op; the restock trigger fires once
  (DB-backed test).
- **Intent creation request mapping:** snapshot of the outbound body (amount = stored total, items
  sum to total including shipping, special_reference = order id, expiry = env window).

### 5.2 DB-backed specs and DDL copies

The project's specs create their own file-backed libsql schemas. The `store_order` DDL string is
duplicated in at least: `src/lib/server/orders.spec.ts:56`, `src/lib/server/admin/orders.spec.ts:72`,
`src/lib/server/admin/stats.spec.ts:72`, `src/lib/server/admin/products.spec.ts:87`,
`src/routes/admin/orders/[id]/page.spec.ts:54`, `src/routes/admin/orders/page.load.spec.ts:49`,
`src/routes/admin/products/page.load.spec.ts:85`, and `src/routes/admin/page.load.spec.ts:84` — all
must gain the four new columns, and relevant specs gain the new tables/triggers so trigger behavior
(restock guard, enum validation, consistency) is exercised for real. `invoice.spec.ts` and status
fixtures update with the vocabulary.

### 5.3 Migration replay

Extend `src/lib/server/db/migration-replay.spec.ts` (pattern at lines 107-175): apply
`0019_payments.sql` to a pre-0019 schema and assert the four columns, both tables, the unique
constraints, the recreated restock trigger containing the `OLD.status` guard, and the two validation
triggers. Add a journal guard test that this spec's staged `placed`→`paid` cleanup is **not** in
`drizzle/meta/_journal.json` while `0019_payments` is. CI already replays the full journal on a
throwaway DB before build (`.github/workflows/ci.yml:42-46`), which covers the generated chain.

### 5.4 Route tests

- Webhook handler: import the endpoint and call it with a `Request`; assert 401 on bad HMAC, 400 on
  malformed/oversized, 200 on replay, 200 + state change on valid success, 500 on injected DB
  failure. Never exercises real network.
- Pay page action/status endpoint: state guards, rate limits, uniform 404 for a caller without the
  capability cookie, and redirect-to-success when paid.

### 5.5 E2E (Playwright, `E2E_USE_BUILD=1`)

- Existing simulated journey stays green in `PAYMENTS_PROVIDER=simulated` with updated copy
  assertions (`checkout.page.svelte.spec` etc. currently assert simulation text).
- **Mocked Paymob journey (primary):** the Playwright `webServer` chain additionally starts a tiny
  local mock Paymob HTTP server; e2e env sets `PAYMENTS_PROVIDER=paymob`,
  `PAYMOB_BASE_URL=http://127.0.0.1:<port>`, test secret/public keys, test integration ids, and a
  known HMAC secret. The mock answers `POST /v1/intention/` with a `client_secret` and serves a fake
  Unified Checkout page whose "pay" button POSTs a correctly signed transaction callback to the
  app's webhook route, then redirects to the app's return URL. Assertions: order flips to `paid`,
  success page renders, confirmation email row is enqueued, stock decremented exactly once.
- **Webhook negative/replay tests:** signed-then-tampered callback is rejected (401, no state
  change); the same signed callback posted twice changes state once; success after expiry leaves a
  cancelled order plus an admin alert event.
- **Sandbox e2e (manual, not CI):** with Paymob test credentials and published test cards/wallets,
  run the same checklist from the runbook; record results in the PR.
- The mock must be dev-only and unreachable in production (the route is not shipped; the mock lives
  in the e2e tooling), so no test seam exists in the production bundle beyond `PAYMOB_BASE_URL`
  validation.

### 5.6 Manual go-live checklist (runbook addition)

Sandbox and live: intention creation for card and wallet, success, failure, 3DS, redirect return,
webhook receipt, replay, expiry + release, refund (full + partial), and reconciliation of a
webhook-suppressed payment. Owner sign-off recorded with the production run results.

---

## 6. Observability

- **Structured logs** with a `[payments]` prefix: `orderId`, `eventId`, `txnId`, `outcome`,
  `durationMs`; never log secrets, HMAC values, or full payloads (the payload is stored in
  `store_payment_event.raw_payload`; only masked PAN last-4 is present).
- **Durable trail:** `store_payment_event` + `store_payment_refund` + `store_admin_audit` make every
  money-affecting action reconstructable without logs.
- **Webhook alerting:** the worker's reconciliation run flags events stuck in `received` > 15
  minutes; invalid-signature attempts are counted and trigger an admin alert above a small
  threshold (e.g. > 5/hour). Delivery uses the existing outbox admin recipients
  (`ADMIN_NOTIFY_EMAILS`, `email.ts:262`).
- **Daily reconciliation digest** (Cairo 09:00 via the worker): paid counts split by webhook vs
  reconciliation, pending older than 1 hour, failed refunds, manual mark-paid count, and
  amount/currency mismatches.
- **Funnel:** PostHog is already adopted (`package.json:41`, `docs/decisions.md` 2026-08-25); add
  `payment_started`, `payment_completed`, `payment_failed` with order id, keeping `purchase` as the
  success event.
- **Dashboard:** the KPI currently labeled "Gross bookings (simulated payment)"
  (`docs/todo.md:442`) becomes two figures — collected (provider paymob, paid/partial/refunded) and
  simulated — using `payment_provider` filters in `stats.ts`.
- **Cron visibility:** Workers dashboard → the worker → Settings → Trigger Events shows schedule
  history and failures (Workers cron docs); each run logs counts processed/released/alerts.

---

## 7. Security

- **HMAC verification** per section 3.3.4, over the documented 20-field concatenation, constant-time
  comparison, before any parsing/state change; GET-shaped callbacks rejected. `hmac` secrets never
  logged.
- **Replay protection:** `UNIQUE(provider, provider_txn_id)` + conditional UPDATEs; replay responses
  are idempotent `200`s.
- **Amount tampering:** all pricing is server-side and re-derived at order creation
  (`orders.ts:308-316`) and at intention creation from the stored order; the webhook additionally
  verifies `amount_cents === order.total`, `currency === 'EGP'`, and `integration_id` is one of the
  configured ids before applying anything.
- **No card data on our servers:** Unified Checkout is Paymob-hosted; the app never renders or
  transmits PAN/CVV. PCI scope stays SAQ-A. Paymob's callback contains only a masked PAN
  (`source_data.pan`, e.g. `"2346"`), which is safe to persist; card-number-like fields must never
  appear in our logs.
- **SSRF:** outbound calls go only to `PAYMOB_BASE_URL`, validated as HTTPS with a Paymob host
  allowlist; the app never fetches URLs from callback payloads.
- **IDOR:** the pay/status/success surfaces use the existing order-access capability cookie and
  owner-session check with uniform 404s (`src/routes/checkout/success/[id]/+page.server.ts:34-36`).
- **Rate limits:** intention creation per order and per IP (3.3.2); pay status polling 60/min;
  webhook body-size cap; existing checkout limiter unchanged (`+page.server.ts:19`).
- **Manual actions:** `mark_paid` requires an admin role re-check, a provider reference, a note, an
  audit row, and a manual event; refunds require an audit note and are amount-bounded.
- **Webhook endpoint surface:** POST only, no cookies/session, no CSRF relevance, no HTML response,
  no secrets echoed on error.
- **Secrets:** env-only, separate stores for Pages and the worker, examples kept dummy; existing
  boot validation fails fast when `paymob` is selected with an incomplete set (section 3.7).

---

## 8. Open decisions (each with a recommendation)

| #   | Decision                   | Recommendation                                                                                | Alternative and why rejected                                                        |
| --- | -------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Reservation timing         | Reserve at placement, release at expiry (existing triggers)                                   | Reserve at payment: oversell + mandatory auto-refunds, new debit path               |
| 2   | Iframe vs redirect         | Redirect to Unified Checkout                                                                  | Iframe/pixel: third-party cookie/CSP/mobile risk with no PCI or UX gain             |
| 3   | Partial refund granularity | Amount-based ledger in v1                                                                     | Line-level now: requires a returns model this project has not specified             |
| 4   | Manual mark-paid policy    | Allowed with provider reference + note + audit + reconciliation flag                          | Ban: blocks rare offline cases; free-form: unauditable                              |
| 5   | Expiry window              | 30 minutes (env-tunable), intention expiration 1800 s, 5-minute release grace                 | 15 min: too tight for wallets/3DS; 60 min: holds stock too long for a small catalog |
| 6   | Reconciliation cadence     | Expiry every 5 min; pending payment scan every 15 min (24 h window); daily digest 09:00 Cairo | Hourly: slow recovery of missed webhooks; per-minute: needless D1/Paymob load       |
| 7   | Post-shipment reversal     | Refund only, no status flip, no restock; returns spec owns RMA                                | Allow shipped→cancelled: would restock sold goods and misstate fulfillment          |
| 8   | `processing` state         | Keep it, but allow `paid → shipped` to skip it                                                | Remove: loses the ops queue; require it: two clicks for a small shop                |

---

## 9. Ordered task breakdown (0.5–2 days each)

| ID  | Task                                                                                                                                                       | Est. | Depends on   | Deliverable / verification                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------ | ------------------------------------------------------------------------------------------------- |
| P1  | Approve this spec; write the ADR in `docs/decisions.md` and update `docs/todo.md`                                                                          | 0.5d | —            | Reviewed spec + ADR entry                                                                         |
| P2  | Migration `0019_payments` + snapshot + replay spec + the 8 spec DDL copies                                                                                 | 1.5d | P1           | CI migration replay green; trigger tests pass                                                     |
| P3  | Payment domain core (`lifecycle.ts`, `types.ts`): enums, aliases, transition guards, normalized apply                                                      | 1d   | P2           | Unit matrix + idempotency tests green                                                             |
| P4  | Paymob adapter (`paymob.ts`): intention, auth token, inquiry, refund, HMAC verify                                                                          | 1.5d | P2           | Fixture tests incl. documented HMAC sample                                                        |
| P5  | Webhook route + `store_payment_event` idempotency + route tests                                                                                            | 1d   | P3, P4       | 200/400/401/500 route tests pass                                                                  |
| P6  | Checkout integration: pending order + simulated adapter + pay redirect + copy                                                                              | 1.5d | P3           | Simulated e2e still green; new order fields asserted                                              |
| P7  | Pay page + status endpoint + return handling + retry UX + rate limits                                                                                      | 1.5d | P4, P6       | Pay/retry/expired states covered by route tests                                                   |
| P8  | Email triggers + copy split (remove blanket simulated line) + admin notify on payment                                                                      | 1d   | P3, P6       | Outbox rows asserted per trigger; email spec interface unchanged                                  |
| P9  | Expiry release + reconciliation functions + wire into the shared Cron worker                                                                               | 2d   | P3, P4       | Trigger tests + cron entry test; depends on email spec's worker landing first or exporting a stub |
| P10 | Admin orders list: payment column/filter + export label updates                                                                                            | 0.5d | P3           | Loader/spec updated                                                                               |
| P11 | Admin order detail: payment panel, `mark_paid`, refund, `cancel_refund` + audit                                                                            | 1.5d | P4, P9       | Action tests + audit rows asserted                                                                |
| P12 | Admin `/admin/payments` reconciliation view                                                                                                                | 1d   | P5, P9       | Renders events, refunds, stuck/manual counters                                                    |
| P13 | Env validation + `.dev.vars.example` + runbook/secret setup                                                                                                | 0.5d | P4           | `env.spec.ts` cases for paymob/simulated                                                          |
| P14 | E2E: mock Paymob server + paid journey + webhook negative/replay tests                                                                                     | 2d   | P5, P7       | Playwright suite green against the built artifact                                                 |
| P15 | Security review pass + fixes (HMAC, rate limits, logging redaction, IDOR)                                                                                  | 1d   | P7, P11, P14 | Security checklist signed; no blockers                                                            |
| P16 | Paymob sandbox verification with owner credentials + go-live checklist                                                                                     | 1d   | P13, P15     | Written sandbox results in the PR                                                                 |
| P17 | Docs: architecture/data-model updates, runbook go-live/rollback, this spec's staged `placed`→`paid` cleanup (the D1 rebuild stays with the integrity spec) | 0.5d | P16          | `docs/architecture.md`, `docs/production-runbook.md`, staged SQL (not in journal)                 |

Quality gate for the implementation phase (per project workflow): `vp check` clean, unit + e2e
suites green, `vp build` clean, migration replay on libsql + D1, and the go-live checklist signed.
