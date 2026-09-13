# Commerce Parity Program — Design Spec

**Date:** 2026-09-13
**Status:** Proposed — program catalog. Each area below is a design sketch; every area gets its own
spec → plan → implementation cycle (owner-approved) before any code is written.
**Scope:** WooCommerce-level core commerce capabilities for the Beeking Etman storefront:
coupons/promotions, shipping engine v2, tax, returns/RMA, product reviews, the customer
notification matrix, admin commerce tooling, and the catalog prerequisites those depend on.
**Repo docs:** English. Money is integer piasters (1/100 EGP, also called "qirsh",
`docs/decisions.md` 2026-08-13) everywhere; percentages use integer basis points
(1 bp = 0.01%, so 1000 bp = 10.00%).

**Companion specs (interfaces only — this document does not duplicate their content):**

| Spec                                                                                      | Owns                                                                                                                                                                    | Interface this program consumes                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/superpowers/specs/2026-09-13-order-lifecycle-payments-design.md` ("payments spec")  | `order.status`/`payment_status` state machines, stock reserve/expire/restock, Paymob, `store_payment_event`, `store_payment_refund`, refund service                     | `refundOrder(db, orderId, amountCents, reason, adminUserId)`; `pending_payment → paid → processing → shipped → delivered` vocabulary; `store_order.payment_status` |
| `docs/superpowers/specs/2026-09-13-email-delivery-pipeline-design.md` ("email spec")      | outbox table, drain worker, retry/backoff/dead letters, provider adapter                                                                                                | `enqueueEmail(db, { recipient, subject, html, text }, { type: OutboxType, idempotencyKey })`                                                                       |
| `docs/superpowers/specs/2026-09-13-data-integrity-hardening-design.md` ("integrity spec") | order status default, catalog column drop, inventory REAL kg → INTEGER grams, movement units (`quantity_base_units` + `unit`), CHECKs/triggers, shared status constants | normalized `store_stock_movement` shape and `ck_*` naming; staged catalog column drop; `ORDER_STATUS_META`                                                         |
| `docs/superpowers/specs/2026-09-13-ops-security-hardening-design.md` ("ops spec")         | CSP/headers, auth throttling, backup/restore, observability, supply chain, runbook truth                                                                                | `createDbRateLimiter` extension pattern; `/api/health` version; email verification gates                                                                           |

**Roadmap:** `docs/superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md` is
authoritative for cross-spec arbitration (migration numbering, single ownership); this program
reserves no migration numbers and each sub-spec takes the next free tag at implementation time.

---

## 1. Context & current state

### 1.1 Verified production state (read-only query, 2026-09-13)

D1 `beeking` (`93fc332c-83b9-4cc0-abbc-5b08d5ccfbbc`) is at `0017_catalog_authority`
(`drizzle/meta/_journal.json` ends at idx 17) and contains:

| Table                                     | Rows      | Implication                                                            |
| ----------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `store_order`                             | 0         | no live orders; order-snapshot migrations are data-free                |
| `store_notification`                      | 0         | no outbox backlog (per email spec §1.1, nothing ever really sent)      |
| `store_return`                            | 0         | legacy physical table only (created by `drizzle/0014_famous_odin.sql`) |
| `store_review`                            | 0         | legacy physical table only (same migration)                            |
| `store_coupon`                            | 0         | legacy physical table only (same migration)                            |
| `store_product` / `store_product_variant` | 191 / 191 | catalog expansion already live: honey + equipment departments          |

`store_return`, `store_review`, and `store_coupon` were removed from the Drizzle schema on
2026-09-09 (`docs/decisions.md:1493-1509`); the physical tables remain in every database, and
nothing reads or writes them. **Any feature below that wants one of those names must evolve the
existing table through a reviewed migration or use a new table name — never silently recreate.**
Because they hold 0 rows, a table rebuild is the cheapest correct option (the `0016`/`0017`
precedent).

### 1.2 Corrections to the program brief (verified against the repo)

1. **The two-storefront catalog expansion is shipped, not deferred.** The department dimension
   exists (`store_category.department` `schema.ts:19`, `store_product.department` `schema.ts:48`),
   routes exist (`src/routes/[department]/…`, `/store/honey`, `/store/equipment`), and production
   holds 191 products across both departments (commits `e4c9cfe`, `59662fa`). The
   "keep the two-storefront UX split out of scope, own spec later" clause is therefore already
   satisfied — this program does not re-open it.
2. **Catalog prerequisite columns already exist** on `store_product`: `sku` (`schema.ts:49`,
   nullable, not unique), `published` (`schema.ts:50`, boolean, default true), `costPrice`
   (`schema.ts:51`, nullable), `weightGrams` (`schema.ts:52`, nullable). `salePrice` does not
   exist. `weightGrams` has **no runtime consumer** (grep: only `schema.ts` and spec DDL copies).
3. **`published` is only half-enforced.** `validateCart` refuses unpublished products at order
   time (`orders.ts:127,148,195`), but the storefront listing/search/featured queries do not
   filter it (`buildProductWhere` `store.ts:375-392`, `getFeaturedProducts` `store.ts:327-345`,
   `getSearchSuggestions` `store.ts:476-519`), nor does the sitemap
   (`src/routes/sitemap.xml/+server.ts:25-46`). Today every row is `published = 1`, so the gap is
   latent — it must be closed before archive/unpublish tooling ships.
4. **The admin product form does not surface the prerequisite columns.** `productInputSchema`
   (`src/lib/server/admin/products.ts:18-36`) covers name/description/category/featured/department
   only; `sku`, `published`, `costPrice`, `weightGrams` have no admin UI or validation.
5. **Cairo reporting has a concrete DST bug.** `stats.ts:56` documents "UTC+2, no DST" and
   `cairoTodayMidnightMs()` parses `T00:00:00+02:00` (`stats.ts:67`). Egypt reinstated DST in
   2023 (last Friday of April → last Thursday of October), so during DST the dashboard day boundary
   is off by one hour and fixed-`DAY_MS` stepping can misbucket a day. Invoice and CSV export
   already format with `Africa/Cairo` (`invoice.ts:23-28`, `admin/orders/export/+server.ts:9-24`).

### 1.3 Capability matrix vs WooCommerce-level parity

Legend: ✅ present · ⚠️ partial · ❌ absent. "Owner" names the spec that will design it.

| Capability                                               | Current state (evidence)                                                                                                           | Owner                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Product catalog, categories, variants, bilingual content | ✅ shipped (191 products; `schema.ts:12-92`)                                                                                       | —                                  |
| Two departments, one cart/checkout                       | ✅ shipped (`src/routes/[department]`; one `honey_cart`)                                                                           | —                                  |
| Custom blends, server-repriced                           | ✅ shipped (`cart.ts` union; `orders.ts:125-192`)                                                                                  | —                                  |
| Cart page, drawer, persistent cookie                     | ✅ shipped (`cart-store.svelte.ts`, `/api/cart`)                                                                                   | —                                  |
| Checkout with governorate + zone shipping                | ✅ shipped (`shipping.ts:21-63`, `cart.ts:133-141`)                                                                                | —                                  |
| Real payments                                            | ❌ simulated (`orders.ts:337-339`)                                                                                                 | payments spec                      |
| Refunds/partial refunds                                  | ❌ nothing                                                                                                                         | payments spec                      |
| Stock reservation + cancellation restock                 | ✅ trigger-owned (`0016`, integrity spec §1.2)                                                                                     | —                                  |
| Inventory: batches, conversions, transfers               | ✅ shipped (`admin/inventory.ts`)                                                                                                  | —                                  |
| Stock adjustments with reason                            | ❌ no adjustment path (only conversion/transfer)                                                                                   | **this program (3g)**              |
| Coupons / promotions                                     | ❌ no code; legacy empty table (`0014`)                                                                                            | **this program (3a)**              |
| Tax model                                                | ❌ nothing (invoice shows subtotal + shipping only, `invoice.ts:163-176`)                                                          | **this program (3c)**              |
| Returns / RMA                                            | ❌ no code; legacy empty table; refunds never restock (payments spec §3.4)                                                         | **this program (3d)**              |
| Product reviews                                          | ❌ no code; legacy empty table                                                                                                     | **this program (3e)**              |
| Transactional email                                      | ⚠️ outbox enqueue exists but never delivers (`email.ts:33-52`)                                                                     | email spec                         |
| Notification matrix (event × channel)                    | ⚠️ order confirmation + status update only (`email.ts:188,524`)                                                                    | **this program (3f)** + email spec |
| Shipping methods / weight tiers / estimates              | ❌ flat per-zone price only (`shipping.ts:21-63`)                                                                                  | **this program (3b)**              |
| COD                                                      | ✅ permanently removed (`decisions.md:1272-1275`)                                                                                  | — (constraint)                     |
| Admin orders/products/inventory/users/customers/audit    | ✅ shipped (`/admin/*`, `admin/audit.ts`)                                                                                          | —                                  |
| Manual/phone order creation                              | ❌ nothing                                                                                                                         | **this program (3g)**              |
| Order/customer edit with audit trail                     | ⚠️ status transitions audited (`admin/orders/[id]/+page.server.ts:72-78`); no field edits                                          | **this program (3g)**              |
| Payment reconciliation UI                                | ❌ nothing                                                                                                                         | payments spec (`/admin/payments`)  |
| Bulk product CSV import/export                           | ⚠️ orders CSV export only (`admin/orders/export/+server.ts`); no product bulk tooling                                              | **this program (3g)**              |
| Cairo-timezone reporting buckets                         | ⚠️ dashboard does it in JS with a DST bug (`stats.ts:55-68`); other reports untested                                               | **this program (3g)**              |
| SEO / JSON-LD / sitemap / FTS search / i18n              | ✅ shipped (`Seo.svelte`, `sitemap.xml`, FTS5, `messages.ts`)                                                                      | reviews add `aggregateRating`      |
| Invoice HTML                                             | ⚠️ subtotal + shipping only; no tax/returns; PDF deferred (`invoice.ts`)                                                           | **this program (3c)**              |
| Media storage guardrails                                 | ✅ KV caps exist (`admin/upload.ts:7-14`); `/media` allows only `products/<uuid>.<ext>` (`src/routes/media/[...key]/+server.ts:9`) | returns need a second prefix       |

### 1.4 Explicit deferrals / boundary map

Deferred, with the owner or reason:

- **Payments, refunds, reconciliation UI** — payments spec. Coupons and returns call its refund
  boundary; they never write payment tables directly.
- **Email delivery mechanics** (worker, retries, dead letters, admin `/admin/emails`) — email spec.
  Every notification below enqueues only.
- **Order status default, inventory units, CHECKs, legacy product column drop** — integrity spec.
  Stock adjustments and return restocking consume its normalized movement schema.
- **Security headers, observability, backups, auth throttling, secret verification gates** — ops
  spec. Reviews/returns reuse its rate-limit and media patterns.
- **PostHog event taxonomy, funnels** — `docs/todo.md` Phase 2, not commerce parity.
- **Invoice PDF export, KV garbage collection, marketing/broadcast email, SMS/WhatsApp
  notifications, in-app notification center, multi-currency, loyalty/points, gift cards,
  subscriptions, marketplace/vendor features, a plugin architecture** — no owner; deliberately out
  of scope (see §2).
- **Further department/storefront work** — already shipped (§1.2 item 1); no re-opening.

---

## 2. Goals / Non-goals

### Goals

1. Reach WooCommerce-level **core commerce** parity (coupons, tax, shipping methods, returns,
   reviews, manual orders, bulk catalog operations) without adopting WooCommerce's plugin sprawl:
   each capability is a first-class, reviewed module in this repo.
2. Keep the storefront's differentiators intact: one cart across both departments, server-repriced
   custom blends, Arabic-first bilingual UI, immutable order snapshots.
3. Keep money server-authoritative and integer-only: the client never supplies an amount, discount,
   tax, or shipping figure; every stored figure is an immutable snapshot at order time.
4. Stay inside the free-tier posture: no new paid products, no per-minute crons beyond the email
   spec's worker, public pages remain cacheable, new public reads are PK lookups or one extra small
   query per page (`docs/architecture.md:244-266`).
5. Ship each area independently behind its own migration and flag where possible; nothing here
   requires a big-bang release.
6. Never contradict the companion specs: payments owns money movement, email owns delivery,
   integrity owns physical schema conventions.

### Non-goals

- No plugin/extension system, no third-party commerce engine, no headless rewrite.
- No duplicate implementation of payments, refunds, email delivery, ops, or data-integrity work.
- No COD in any form (permanent, `decisions.md:1272-1275`).
- No automated courier integration in v1 (adapter interface only, §3b).
- No automatic promotions engine (cart rules, BOGO, tiered discounts) in v1 — manual coupon codes
  only; auto-apply is a later, separate design.
- No customer-facing loyalty, referrals, gift cards, or subscriptions.
- No SMS/WhatsApp/Telegram customer notifications and no in-app notification center (§3f).
- No VAT filing software or e-invoicing integration; the tax model records and prints the
  breakdown only.
- No reopening of the two-storefront UX or blends studio.
- No new cron workers; scheduled work runs in the email spec's worker or not at all.

---

## 3. Area designs

Program-wide conventions that every area below inherits:

- **Snapshot, never recompute.** Order-level figures (`unit_price`, `shipping_cost`, coupon
  discount, tax, weight, method) are written once and rendered from storage; later config edits
  never change a placed order (`orders.ts:343-352`, payments spec §3.1).
- **Conditional UPDATE for state.** D1 has no interactive transactions; every state transition is
  a guarded `UPDATE … WHERE …` checked via `affectedRowCount` (`orders.ts:60-65`,
  `admin/orders.ts:193-231`), or a trigger (integrity spec §3.5).
- **Additive migrations first.** Old and new builds overlap during every deploy because CI applies
  D1 migrations before the Pages deploy (payments spec §1.3). Columns are added nullable/defaulted;
  drops go through the staged pattern.
- **Migration index arbitration.** The journal ends at 0017; the roadmap freezes `0018`–`0023`
  plus the staged D3 file, and this program reserves none. Each area's own spec confirms the next
  free tag in `drizzle/meta/_journal.json` at implementation time; COM never hardcodes a number.
- **DDL-copy sync.** Embedded `store_order`/`store_order_item` DDL strings live in 9 spec files
  (integrity spec §1.6); every column added by this program must be appended there in the same
  change, and relevant specs must exercise new triggers for real.
- **Audit + i18n.** Admin mutations re-check `isAdminRole` server-side and call `logAdminAction`
  (`admin/audit.ts:21-46`); every new string gets `ar` + `en` keys in
  `src/lib/i18n/messages.ts` (parity is type-enforced).
- **Boundary validation.** Form/route input is parsed by zod at the boundary (`checkout-schema.ts`,
  `admin/products.ts:28-56`); unknown fields rejected; typed failure codes map to i18n.
- **Each area's own cycle.** Every subsection closes with a delivery note; none of this is
  implementation detail.

### 3a. Coupon & promotion engine

**Purpose.** Manual, code-based discounts: percentage, fixed-cart, fixed-product, and
free-shipping; spend minimums, caps, windows, usage limits; product/category restrictions; an
immutable per-order snapshot; authoritative server validation at order time.

**Data model sketch** (evolve the empty legacy `store_coupon` via a 0014-aligned rebuild — 0 rows,
so a rebuild is free; re-add the table to `schema.ts` in the same change):

```sql
store_coupon (
  id            text PRIMARY KEY,
  code          text NOT NULL UNIQUE,              -- canonical uppercase snapshot
  kind          text NOT NULL CHECK (kind IN ('percent','fixed_cart','fixed_product','free_shipping')),
  value_bp      integer NOT NULL DEFAULT 0 CHECK (value_bp >= 0),
                -- percent: basis points (1000 = 10%); fixed_*: piasters; free_shipping: 0
  min_subtotal  integer NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_discount  integer CHECK (max_discount IS NULL OR max_discount > 0),
  starts_at     integer, ends_at integer,
  usage_limit   integer CHECK (usage_limit IS NULL OR usage_limit > 0),   -- global
  per_user_limit integer CHECK (per_user_limit IS NULL OR per_user_limit > 0),
  applies_to    text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','products','categories')),
  stackable     integer NOT NULL DEFAULT 0,        -- reserved; v1 never stacks (open decision 2)
  used_count    integer NOT NULL DEFAULT 0,        -- conditional-increment counter
  active        integer NOT NULL DEFAULT 1,
  created_by    text, created_at integer NOT NULL, updated_at integer NOT NULL,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
store_coupon_product  (coupon_id text NOT NULL REFERENCES store_coupon(id),
                       product_id text NOT NULL REFERENCES store_product(id),
                       PRIMARY KEY (coupon_id, product_id));
store_coupon_category (coupon_id text NOT NULL REFERENCES store_coupon(id),
                       category_id text NOT NULL REFERENCES store_category(id),
                       PRIMARY KEY (coupon_id, category_id));
store_coupon_redemption (
  id text PRIMARY KEY, coupon_id text NOT NULL REFERENCES store_coupon(id),
  order_id text NOT NULL UNIQUE REFERENCES store_order(id),   -- one coupon per order in v1
  user_id text, email text NOT NULL,                          -- normalized lowercase; guest limit
  discount_amount integer NOT NULL CHECK (discount_amount > 0),
  created_at integer NOT NULL
);
-- indexes: store_coupon_redemption(coupon_id), (coupon_id, email)
```

Order/item snapshot columns (additive, mirrored in the 9 DDL copies):

```sql
store_order      + coupon_id text, coupon_code text, discount_total integer NOT NULL DEFAULT 0
store_order_item + discount_amount integer NOT NULL DEFAULT 0
```

`total = subtotal - discount_total + shipping` (tax joins this equation in 3c). A cancelled order
before `shipped` releases its redemption row and decrements `used_count` (guarded) in the same
batch as the cancel; after `shipped`, no release (open decision 8).

**Flows.**

1. Preview (untrusted): customer enters a code on the cart/checkout page; a single server call
   resolves it against the current server-priced cart and returns `{ code, discount, errors }`.
   Recommended surface: an oRPC procedure next to the search boundary
   (`src/lib/features/search/` is the template, `docs/architecture.md:103-111`); a SvelteKit
   action on `/checkout` is the fallback if the preview stays single-use. Rate-limit previews.
2. Authoritative: `createOrder` takes the submitted `couponCode`, re-resolves it against the
   final server cart, and computes the allocation. The global cap is claimed **first**, with one
   atomic guarded statement outside the order batch:
   `UPDATE store_coupon SET used_count = used_count + 1 WHERE id = ? AND active = 1 AND
(usage_limit IS NULL OR used_count < usage_limit)` — 0 affected rows means `COUPON_EXHAUSTED`
   and no order is created. If the subsequent order batch (`orders.ts:324-354`) fails for any
   reason (out of stock, order-number collision), a compensating guarded decrement releases the
   claim. Because `used_count` is derivable from the redemption ledger, the admin redemption
   report doubles as the reconciliation (recount vs counter, fix drift) so a crash cannot
   permanently strand a limited code.
3. Per-user limit is counted from `store_coupon_redemption` (`user_id` when signed in; normalized
   `email` for guests) at resolve time; it is a soft guard (a determined user can change email),
   accepted for a store of this size.
4. Cancellation release: on `pending_payment`/`paid`/`processing` cancellation, a guarded delete
   of the redemption + guarded decrement runs with the restock path owned by the payments spec.

**Allocation & rounding.** Percentage discounts are computed per line and capped by
`max_discount`; `fixed_cart` is allocated across lines proportional to line totals using
largest-remainder so `Σ item.discount_amount = order.discount_total` exactly (integer piasters);
`fixed_product` applies per matching unit, capped at the unit price; `free_shipping` sets
`shipping_cost = 0` and records the coupon code — the waived amount is not part of
`discount_total`, so refund math (payments spec, amount-based) is not confused by shipping.

**Validation rules** (typed error codes → i18n): `COUPON_INVALID` (unknown/inactive), `COUPON_EXPIRED`
(outside window), `COUPON_MIN_SPEND`, `COUPON_NOT_APPLICABLE` (no matching line),
`COUPON_EXHAUSTED` (global cap), `COUPON_ALREADY_USED` (per-user cap or same order),
`COUPON_RESTRICTED` (a second code submitted in v1). Code shape
`^[A-Z0-9][A-Z0-9_-]{2,31}$`, stored uppercase; admin input normalized before the uniqueness check.
Free-shipping and percent coupons cannot reduce a line below 0; the final total is never negative.

**Admin surface.** `/admin/coupons` (list, search, active filter) + `/admin/coupons/new` +
`/admin/coupons/[id]`: create/edit/deactivate, product/category pickers, limits and window,
redemption report (count, discount sum, linked orders, per-user breakdown) with CSV export
reusing the existing CSV escaping/BOM pattern (`admin/orders/export/+server.ts:26-31,75-108`).
Every mutation audited (`targetType: 'coupon'`; extend `AuditTargetType`, `audit.ts:5`).

**Dependencies.** Payments spec's `0019` schema (order/item snapshot columns land cleanly after or
alongside; roadmap allocation); email spec not required (coupons send no email in v1); integrity
spec's DDL sync rules.

**Rough size: ~3 weeks** for one developer including schema, service math, checkout integration,
admin, reports, tests, and docs.

> **Delivery:** This is a design sketch. Coupons get their own spec → plan → implementation cycle
> with the repo quality gate and an ADR in `docs/decisions.md`.

### 3b. Shipping engine v2

**Purpose.** Replace the flat per-zone price list with zone × method × weight-tier rates, delivery
estimates, per-rate free-shipping thresholds, and a courier adapter boundary — while keeping the
current seven zones and prices as the day-one seed so behavior does not change on release.

**Data model sketch.**

```sql
store_shipping_zone (
  code text PRIMARY KEY,                 -- cairo|giza|alexandria|delta|canal|upper|remote
  name text NOT NULL, name_en text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0, active integer NOT NULL DEFAULT 1
);
store_shipping_method (
  id text PRIMARY KEY, code text NOT NULL UNIQUE,   -- 'standard' | 'express' (extensible)
  name text NOT NULL, name_en text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0, active integer NOT NULL DEFAULT 1
);
store_shipping_rate (
  id text PRIMARY KEY,
  zone_code text NOT NULL REFERENCES store_shipping_zone(code),
  method_code text NOT NULL REFERENCES store_shipping_method(code),
  min_weight_grams integer NOT NULL DEFAULT 0 CHECK (min_weight_grams >= 0),
  max_weight_grams integer CHECK (max_weight_grams IS NULL OR max_weight_grams > min_weight_grams),
  price integer NOT NULL CHECK (price >= 0),                    -- piasters
  free_threshold integer CHECK (free_threshold IS NULL OR free_threshold >= 0),
  estimate_min_days integer NOT NULL DEFAULT 2 CHECK (estimate_min_days >= 0),
  estimate_max_days integer NOT NULL DEFAULT 5,
  active integer NOT NULL DEFAULT 1,
  CHECK (estimate_max_days >= estimate_min_days),
  UNIQUE (zone_code, method_code, min_weight_grams)
);
```

Order snapshot columns (additive): `shipping_method_code text`, `shipping_zone_code text`,
`shipping_weight_grams integer`, `delivery_estimate_min_days integer`,
`delivery_estimate_max_days integer`. `shipping_cost` remains the authoritative amount
(invoice already renders the stored snapshot, `invoice.ts:54-57`).

**Weight basis.** Cart weight = `Σ variant.weight_grams × quantity`; a variant with no weight uses
`DEFAULT_ITEM_WEIGHT_GRAMS` (config, default 1000) and the order is flagged
`shipping_weight_estimated integer NOT NULL DEFAULT 0` for ops review after the first real orders.
This requires the variant-level weight column from 3h. Product-level `weightGrams`
(`schema.ts:52`) is deprecated once variants carry weights; it is not dropped here (integrity
spec's staged-drop discipline).

**Flows.** Checkout load resolves the zone's active rates (one query by `zone_code`), computes the
cart weight, filters matching weight tiers, and returns options: default = cheapest active
`standard`; `express` shown as an upgrade when active. A rate whose `free_threshold` is at or below
the post-discount merchandise subtotal resolves to price 0 (design choice: "free delivery over X"
means money actually paid, so a coupon counts down toward the threshold). The submit action
re-resolves server-side from the submitted `method_code` and the final cart; the client never sends
a price. `computeShipping`
(`shipping.ts:61-63`) is replaced by `resolveShipping(rates, { zone, weightGrams, subtotal })`;
`computeTotals` (`cart.ts:133-141`) consumes the resolved option. The client-safe module keeps the
zone enum and pure math; rates are passed from the server load, never hardcoded in the component.

**Migration & parity.** The migration seeds the 7 zones, a `standard` method, and one rate per zone
at today's prices (45/45/55/55/65/85/100 EGP) with `free_threshold = 600_00`, so the day-one
computation is identical to `shipping.ts:21-43`. Prices remain plain data the owner edits in admin
without a migration (the comment at `shipping.ts:16-20` stays true).

**Delivery estimates.** Displayed at checkout, on the order confirmation email, and on the success
page as a range ("2–4 business days"); no promise, no live tracking in v1.

**COD.** Permanently absent. No COD column, no toggle, no i18n key; tests assert the string does
not reappear (payments spec §2 non-goals, `decisions.md:1272-1275`).

**Courier adapter boundary (interface only).** `src/lib/server/shipping/provider.ts`:

```ts
export interface ShipmentQuoteRequest {
  zone: string;
  weightGrams: number;
  subtotal: number;
  methodCode: string;
}
export interface ShipmentQuote {
  price: number;
  etaMinDays: number;
  etaMaxDays: number;
}
export interface ShipmentProvider {
  quote(req: ShipmentQuoteRequest): Promise<ShipmentQuote>;
  createShipment(order: OrderRef): Promise<{ trackingNumber: string; labelUrl?: string }>;
  track(trackingNumber: string): Promise<{ status: string; updatedAt: number }>;
  cancel(trackingNumber: string): Promise<void>;
}
```

v1 ships only the `manual` implementation backed by `store_shipping_rate` (no network, no
secrets). A future Bosta/Aramex adapter is selected by `SHIPPING_PROVIDER` env (default `manual`)
and must not be built now. Adapter output is advisory; the stored order snapshot wins.

**Admin surface.** `/admin/shipping`: zones (list/edit name/order/active), methods, and a rate grid
per zone × method × tier with inline validation (tiers non-overlapping and ordered, integers,
estimates sane); every edit audited (`targetType: 'shipping'`). A dry-run "quote preview" panel
(cart sub-total + weight → resulting options) doubles as operator training.

**Dependencies.** 3h (`variant.weight_grams`); payments spec for order column ordering; email spec
for estimate copy in emails.

**Rough size: ~3 weeks.**

> **Delivery:** This is a design sketch. Shipping v2 gets its own spec → plan → implementation
> cycle with the repo quality gate and an ADR.

### 3c. Tax model

**Purpose.** An explicit, owner-controlled tax configuration with inclusive or exclusive pricing,
per-line tax snapshots, invoice display, and a monthly summary — without changing shelf prices.

**Recommendation: tax-inclusive prices.** Stored prices (integer piasters, displayed via
`formatEGP`, `src/lib/currency.ts`) already read as consumer prices. Exclusive pricing would show
a smaller shelf price plus tax at checkout — visible churn across the storefront, cart, emails,
and invoices for no business gain today. Inclusive keeps every displayed price unchanged and
records the breakdown only in the order snapshot and invoice.

**Data model sketch.**

```sql
store_tax_setting (                       -- one row, id = 'default'
  id text PRIMARY KEY CHECK (id = 'default'),
  name text NOT NULL DEFAULT 'VAT',       -- "ضريبة القيمة المضافة"
  rate_bp integer NOT NULL DEFAULT 0 CHECK (rate_bp BETWEEN 0 AND 10000),
  inclusive integer NOT NULL DEFAULT 1,
  tax_number text,                        -- merchant registration, printed on invoices
  active integer NOT NULL DEFAULT 0,
  updated_by text, updated_at integer NOT NULL
);
store_order      + tax_total integer NOT NULL DEFAULT 0,
                   tax_rate_bp integer NOT NULL DEFAULT 0,
                   tax_inclusive integer NOT NULL DEFAULT 1,
                   tax_number text
store_order_item + tax_rate_bp integer NOT NULL DEFAULT 0,
                   tax_amount integer NOT NULL DEFAULT 0
```

**Math (integer only, per line, then document totals).**

- Inclusive (`inclusive = 1`): `line_tax = round(line_net_inclusive × bp / (10000 + bp))`; `total`
  is unchanged; `tax_total = Σ line_tax`. The invoice prints "الإجمالي يشمل ضريبة القيمة المضافة
  (14%) — X ج.م" and the registration number.
- Exclusive (`inclusive = 0`): `line_tax = round(line_net_exclusive × bp / 10000)`;
  `total = subtotal − discount + shipping + tax_total`; checkout shows a tax line and the storefront
  must show tax-exclusive prices (a copy/UX change this spec defers to the area's own plan).
- Discounts reduce the line net before tax (both modes); shipping is taxed only if the owner sets
  a `shipping_taxable` flag — recommended **false** in v1 (simpler, common for delivery fees).
- Largest-remainder correction on the largest line keeps `Σ line tax = document tax_total` exactly.

**Egypt VAT 14% consideration.** `rate_bp = 1400`, but `active = 0` and `rate_bp = 0` ship as the
default until the owner confirms VAT registration; enabling it is a one-row admin edit, not a
deploy. The mechanism is correct either way, and snapshots mean orders placed before enablement
stay taxless forever (0 orders exist today).

**Migration impact.** None on stored prices; new columns are additive. The 9 DDL copies gain the
columns; `invoice.spec.ts` and order specs assert snapshots.

**Invoice.** Extend `generateInvoiceHtml` (`invoice.ts:163-176`) with a conditional tax row and the
registration number; keep the Cairo formatting (`invoice.ts:23-29`). A PDF export remains deferred.

**Admin surface.** `/admin/settings/tax` (the first settings page; keep it a general
`/admin/settings` shell so shipping/reviews settings can live under it later): active toggle, rate
(percent input with 2 decimals, converted to bp), inclusive/exclusive radio with a plain-language
explanation, tax number; zod validation; audit (`targetType: 'tax'`). Monthly summary query
(tax collected per Cairo month) for the accountant, exportable as CSV.

**Dependencies.** Payments spec (order total semantics — a coupon discount and tax must be applied
before any Paymob intention is created); email spec (invoice/confirmation copy); 3g for the Cairo
month buckets.

**Rough size: ~2 weeks.**

> **Delivery:** This is a design sketch. Tax gets its own spec → plan → implementation cycle with
> the repo quality gate and an ADR.

### 3d. Returns / RMA

**Purpose.** A line-level, post-delivery returns workflow (request → approved → received →
inspected → completed/rejected) that is explicitly separate from payment refunds: the payments
spec's refund service moves money; this workflow decides what is returned, what is restocked, and
which refund amount is requested. Partial returns per line are first-class.

**Data model sketch** (rebuild the empty legacy `store_return` from `0014`; new child tables):

```sql
store_return (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES store_order(id),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN
    ('requested','approved','rejected','received','inspected','completed','cancelled')),
  reason_code text NOT NULL CHECK (reason_code IN
    ('damaged','wrong_item','not_as_described','quality','changed_mind','other')),
  customer_note text, admin_note text,
  claim_amount integer,                    -- computed from lines at request time (estimate)
  refund_id text,                          -- REFERENCES store_payment_refund(id) (payments spec)
  restock_completed integer NOT NULL DEFAULT 0,
  requested_at integer NOT NULL, approved_at integer, rejected_at integer,
  received_at integer, inspected_at integer, completed_at integer,
  created_by text                          -- 'customer' or admin user id (phone claim)
);
store_return_item (
  id text PRIMARY KEY, return_id text NOT NULL REFERENCES store_return(id),
  order_item_id text NOT NULL REFERENCES store_order_item(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  condition text CHECK (condition IN ('good','damaged','wrong_item','missing')),
  unit_refund_amount integer, restock_quantity integer NOT NULL DEFAULT 0,
  UNIQUE (return_id, order_item_id)
);
store_return_evidence (
  id text PRIMARY KEY, return_id text NOT NULL REFERENCES store_return(id),
  return_item_id text REFERENCES store_return_item(id),
  kv_key text NOT NULL, content_type text NOT NULL, size_bytes integer NOT NULL,
  uploaded_by text, created_at integer NOT NULL
);
-- indexes: store_return(order_id), store_return(status, requested_at), store_return_item(return_id)
```

**Flows.**

1. **Request.** Eligible only for `delivered` orders (payments vocabulary) within
   `return_window_days` (default 14 from delivery; open decision 7). The customer picks lines and
   quantities (`1 ≤ qty ≤ ordered − returned so far`), a reason code, a note, and optional
   evidence photos. Requests are rate-limited (`createDbRateLimiter`, `rate-limit.ts:18-55`).
   The claim amount is computed from the line snapshots (unit price, coupon allocation, tax) but
   is an estimate until inspection.
2. **Evidence.** Images upload through the existing KV pipeline (`admin/upload.ts:7-14`: 5 MB max,
   jpg/png/webp magic-byte check) under a new `returns/<uuid>.<ext>` prefix. The media route's
   allowlist (`src/routes/media/[...key]/+server.ts:9`, today `products/…` only) gains the
   `returns/` branch; evidence is served only to the owning customer/admin (unlike product images,
   evidence must not be publicly enumerable — use a capability check in the route or a separate
   admin/customer route rather than the immutable public pattern).
3. **Admin review.** `/admin/returns` queue: approve or reject with a required note. Every action
   is a guarded conditional UPDATE (`WHERE id = ? AND status = ?`), re-checks `isAdminRole`, and
   writes `logAdminAction` (`targetType: 'return'`).
4. **Receive + inspect.** Admin marks received, then inspects each line: condition (`good`,
   `damaged`, `wrong_item`, `missing`) and `restock_quantity`. Completion computes the per-line
   refund allocation proportional to the line's paid amount (net of discount and tax snapshots),
   then calls the payments spec's
   `refundOrder(db, orderId, claimAmount, reason, adminUserId)` once; the returned `refundId` is
   stored in `store_return.refund_id`. If the refund call fails, the return stays
   `inspected` with a retry action — no state is lost.
5. **Restock.** Only inspected-`good` lines restock, via 3g's `applyStockAdjustment` with reason
   `return_restock`, in the same batch as `restock_quantity`/`restock_completed` updates. A partial
   quantity can restock (e.g., 3 of 5 units good). `damaged`/`wrong_item`/`missing` never restock.
   This is the explicit exception to "refunds never restock" in the payments spec §3.4: refunds
   still never restock by themselves; a completed inspection does.
6. **Customer status.** `/account/returns/[id]` (owner session or the order-access capability
   cookie) shows status, lines, evidence, and refund state. Notifications per §3f.

**Validation.** Integer quantities within remaining purchased amounts; reason enum; evidence
required (≥1 photo) for `damaged`/`wrong_item`, optional otherwise; max 5 files per request;
one open return per order line at a time (multiple sequential partial returns allowed); refund
allocation never exceeds the line's captured amount; window and delivered-status enforced
server-side at request time and re-checked at approval.

**Admin surface.** `/admin/returns` (counters by status, filters, search by order number/customer)
and `/admin/returns/[id]` (lines, evidence gallery, timeline, actions). Order detail gains a
returns panel; the payments reconciliation page shows the linked `refund_id`.

**Dependencies.** Payments spec (delivered status + refund service), 3g (stock adjustments with
reason + movement records), integrity spec (movement units), ops spec (rate limits, media
hardening), email spec (notifications). This is the most cross-cutting area and should start only
after payments refunds are live.

**Rough size: ~3.5–4 weeks.**

> **Delivery:** This is a design sketch. Returns/RMA gets its own spec → plan → implementation
> cycle with the repo quality gate and an ADR.

### 3e. Product reviews

**Purpose.** Verified-buyer product reviews with moderation, denormalized rating aggregation for
fast pages, abuse controls, and JSON-LD `aggregateRating` integration with the existing SEO layer.

**Data model sketch** (rebuild the empty legacy `store_review` from `0014`):

```sql
store_review (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES store_product(id),
  variant_id text REFERENCES store_product_variant(id),
  user_id text, order_id text REFERENCES store_order(id),
  order_item_id text REFERENCES store_order_item(id),
  author_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text, body text CHECK (body IS NULL OR length(body) <= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','spam')),
  verified_purchase integer NOT NULL DEFAULT 0,
  helpful_count integer NOT NULL DEFAULT 0,
  moderation_note text,
  created_at integer NOT NULL, published_at integer,
  UNIQUE (order_item_id)                     -- one review per purchased line
);
store_product_rating (                       -- denormalized aggregate, one row per product
  product_id text PRIMARY KEY REFERENCES store_product(id),
  rating_count integer NOT NULL DEFAULT 0,
  rating_sum integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  average_bp integer NOT NULL DEFAULT 0,     -- round(rating_sum × 10000 / rating_count)
  updated_at integer NOT NULL
);
-- indexes: store_review(product_id, status, created_at), store_review(user_id, product_id)
```

**Verified buyer.** A review is `verified_purchase = 1` when its `order_item_id` belongs to a
`delivered` order whose email matches the signed-in user's email or whose order-access capability
was presented. The submission flow starts from the order detail page, so the order line is known.
One review per line is enforced by `UNIQUE(order_item_id)`; the service additionally refuses a
second review by the same user for the same product across variants (recommended; keeps the
"one per product" intent of the brief while variants remain reviewable through the per-line rule).

**Recommendation: verified-purchase reviews only in v1.** The catalog is small, the owner moderates
alone, and unverified reviews invite spam with no volume upside yet (open decision 3). This is a
policy toggle (`allow_unverified_reviews` in settings) that can be enabled later; the schema
already supports `verified_purchase = 0`.

**Aggregation.** `AFTER INSERT/UPDATE OF status/DELETE` triggers on `store_review` maintain
`store_product_rating` for rows in `approved` status (insert on approve, withdraw on
reject/spam/delete). Trigger math is integer and covered by a DB-backed spec (the project pattern
for triggers, integrity spec §3.5). The v1 aggregate is product-level and sums across variants;
`store_review.variant_id` is retained so a variant-level aggregate can be added later without
re-modeling. Public product pages read one row by PK — no aggregate scan.

**Display.** Product detail renders stars + count from `store_product_rating` and a paged list of
approved reviews (newest first, deterministic tiebreak). Helpful votes are deferred (schema column
reserved, no UI) to avoid another unauthenticated write path. `Seo.svelte` (`Seo.svelte:56` emits
the JSON-LD blob) adds `aggregateRating` only when `rating_count >= 3` (Google review-snippet
eligibility); no `Review` markup in v1 to stay within structured-data policy.

**Abuse controls.** Rate limit submissions (`createDbRateLimiter`: 5/day per user and 5/day per
email+IP); all submissions `pending` until moderated; simple heuristics — ≥2 links in body or a
deny-list hit sets the row to `pending` with `moderation_note = 'auto-flag'` (never auto-reject);
honeypot field on the form; a "report abuse" action on published reviews (rate-limited, admin
queue). No CAPTCHA dependency in v1.

**Admin surface.** `/admin/reviews` queue: pending/approved/rejected/spam filters, search,
bulk approve/reject/spam, with `logAdminAction` (`targetType: 'review'`). Approval enqueues a
`review_approved` email (§3f) and stamps `published_at`.

**Dependencies.** 3h (`published` filtering), email spec, ops spec (rate limits), existing SEO
component. Independent of payments; can ship in any wave after 3h.

**Rough size: ~3 weeks.**

> **Delivery:** This is a design sketch. Reviews get their own spec → plan → implementation cycle
> with the repo quality gate and an ADR.

### 3f. Customer notification matrix

**Purpose.** One explicit event × channel table so no lifecycle change ships without deciding who
is told and how. Email is the only channel now; every send goes through the email spec's
`enqueueEmail` (`email.ts:70`), never a direct provider call.

**Matrix** (E = email, A = admin digest email, — = none; all email rows require the email spec's
pipeline; type and idempotency key follow its naming):

| Event                             | Customer | Admin | Trigger point                                | Email type / key                                       |
| --------------------------------- | -------- | ----- | -------------------------------------------- | ------------------------------------------------------ |
| Order placed, awaiting payment    | E        | —     | `createOrder` (payments spec)                | `order_received` / `order-received/{orderId}`          |
| Payment confirmed                 | E        | A     | verified webhook / reconciliation            | `payment_confirmed` / `order/{orderId}/paid`           |
| Payment failed                    | E        | —     | failure webhook / expiry with `pending`      | `payment_failed` / `order/{orderId}/failed/{attempt}`  |
| Processing started (optional hop) | E        | —     | admin transition                             | `status_update` / `order-status/{orderId}/processing`  |
| Shipped                           | E        | —     | admin transition                             | `status_update` / `order-status/{orderId}/shipped`     |
| Delivered                         | E        | —     | admin transition                             | `status_update` / `order-status/{orderId}/delivered`   |
| Cancelled                         | E        | —     | admin / expiry                               | `status_update` / `order-status/{orderId}/cancelled`   |
| Refund issued (full/partial)      | E        | —     | payments refund service                      | `refund` / `refund/{refundId}`                         |
| Return requested                  | —        | A     | customer request                             | `return_requested` / `return/{returnId}/requested`     |
| Return approved / rejected        | E        | —     | admin decision                               | `return_status` / `return/{returnId}/{status}`         |
| Return received / inspected       | E        | —     | admin workflow                               | `return_status` / `return/{returnId}/{status}`         |
| Return completed                  | E        | —     | completion + refund link                     | `return_status` / `return/{returnId}/completed`        |
| Review approved                   | E        | —     | moderation                                   | `review_approved` / `review/{reviewId}/approved`       |
| Password reset                    | E        | —     | Better Auth (ops/email specs)                | `password_reset` / `password-reset/{userId}/{ts}`      |
| Low stock reorder                 | —        | A     | inventory alerts (`/admin/inventory/alerts`) | `low_stock` / `low-stock/{itemType}/{itemId}/{bucket}` |
| Paid after cancel (edge)          | —        | A     | payments spec §3.3.7                         | `admin_alert` / `ops-alert/{bucket}`                   |

**Channel decisions.**

- **In-app notifications deferred.** There is no account notification hub, no unread-state model,
  no push channel, and no requirement that survives a page reload; email is durable, evidenced
  (email spec), and already the customer's record. Rationale recorded here so no later change
  resurrects a half-built inbox; revisit only when the account area gains a hub.
- **SMS/WhatsApp deferred** (sender registration, per-message cost, compliance) — no free-tier path.
- **Admin channel = email to `ADMIN_NOTIFY_EMAILS`** (existing env; `email.ts:235-277`).
- **No marketing/broadcast, no unsubscribe UX** — all rows are transactional.

**Template ownership.** Each area's implementation adds its renderer (AR/EN copy keys in
`messages.ts`) and calls `enqueueEmail` with the type/key above; the email spec owns retry,
backoff, dead-letter, and the drain worker. The notification matrix is the checklist each area's
plan closes out.

**Dependencies.** Email spec (hard), payments spec (lifecycle events), all other areas (their
events). Sized as wiring inside each area plus a consolidated verification pass.

**Rough size: ~1 week** for the consolidated wiring/test pass after the event sources exist.

> **Delivery:** This is a design sketch. The matrix is verified as part of every area's spec and
> gets its own wiring pass; it does not justify a standalone migration.

### 3g. Admin commerce tools

**g1. Manual order creation (phone orders).**

Purpose: take an order by phone for an existing customer without guest checkout friction.
`/admin/orders/new`: customer fields (validated with the same rules as `checkout-schema.ts:5-23`,
including the Egyptian phone regex), variant picker (reuse admin product search; quantity against
stock), governorate, optional shipping override, optional coupon (3a). On submit, extend
`createOrder` with `{ source: 'admin', createdBy: adminId }`; add
`store_order.source text NOT NULL DEFAULT 'storefront'` (`CHECK IN ('storefront','admin')`) and
`store_order.created_by text`. Stock reservation stays trigger-owned (`orders.ts:324-354`,
`0016`); the audit entry is `order.created_manual`. Payment handling per open decision 5: when
Paymob is live, create the order in `pending_payment`/`unpaid` and execute the payments spec's
"send payment link" action; pre-launch, simulated mode applies. No draft-order status is added
(rejected: it would widen the payments state machine for a form that is short enough to complete
in one sitting; abandoned manual entries are simply not saved).

**g2. Order/customer edit with audit trail.**

`applyOrderEdit(db, orderId, patch, adminId)` allows: contact fields (name/phone), address/city/
governorate, shipping-cost override (mandatory reason), and internal notes. Disallowed after
`shipped` except notes. Every edit writes an audit row whose `details` carry
`{ before, after, reason }` JSON (`audit.ts:21-46` accepts an arbitrary record). Order notes get a
small `store_order_note(id, order_id, admin_id, body, created_at)` table for readable history
instead of JSON mining. Customer edits live at `/admin/customers/[id]`: name/phone editable; email
changes only through the verified flow defined by the ops spec (never a raw admin overwrite).
Extend `AuditTargetType` (`audit.ts:5`) with `'return' | 'review' | 'coupon' | 'shipping' | 'tax' |
'inventory' | 'customer'`.

**g3. Payment reconciliation view.**

Owned by the payments spec (`/admin/payments`, `store_payment_event`, `store_payment_refund`).
This program only links: the order detail payment panel, the manual-order payment state, and the
returns refund links. No duplication.

**g4. Coupon admin.**

From 3a: `/admin/coupons` CRUD + redemption reports + audit.

**g5. Stock adjustments with mandatory reason + movement record.**

`applyStockAdjustment(db, { itemType, itemId, deltaBaseUnits, reasonCode, note, adminId })`:

- `itemType ∈ {variant, batch, material}` with the integrity spec's canonical units (`unit` for
  variant/material, `g` for batch) and its normalized movement columns.
- `reasonCode ∈ {count_correction, damage, waste, expiry, return_restock, theft, other}`; `other`
  requires a note.
- Writes one `store_stock_movement` row (`type = 'adjustment'`) and the stock update in a single
  `db.batch` with a non-negative guard. The integrity spec's movement rebuild (D2,
  `0022_inventory_integrity.sql`) owns the nullable `reason_code` column and the coupled CHECK
  `type <> 'adjustment' OR reason_code IS NOT NULL`; this program owns only the
  `applyStockAdjustment` service and its admin surface (roadmap §3.2).
- Admin surface: `/admin/inventory/adjustments` (form + recent adjustments list with reason,
  admin, before/after), audit via the movement row plus `logAdminAction`.

**g6. Bulk product CSV import/export.**

- Purpose: load the live 191-product catalog (the pricing list remains a business document, not
  schema truth) and future supplier sheets without SQL.
- Format decision (open decision 6): **CSV, UTF-8 (BOM tolerated), header-driven, RFC 4180**; sku
  required as the upsert key. JSONL rejected (non-technical owner).
- Columns: `sku, slug, name_ar, name_en, description_ar, description_en, department, category_slug,
variant_name_ar, variant_name_en, price_piasters, cost_piasters, sale_piasters, stock,
weight_grams, published, image_url`.
- Rules: integer piasters only; `price_piasters > 0`; `stock >= 0`; `weight_grams` integer > 0 or
  empty; `department ∈ {honey, equipment}`; `category_slug` must resolve; `sku` unique in-file and
  in DB (v1: one variant per product row; multi-variant products stay admin-edited). Upsert by
  `sku`; `slug` conflicts are resolved like `generateSlug` (`admin/products.ts:58-65`) with a typed
  error, never silently renamed.
- Flow: upload (≤2 MB, ≤2000 rows) → parse → **dry-run report** (per-row error/warning with line
  numbers, duplicate detection, category resolution; no writes) → apply in chunks of 100 rows,
  resumable, tracked in `store_import_batch(id, filename, status, total_rows, applied_rows,
warnings_json, created_by, created_at, completed_at)`.
- Export: `/admin/products/export` streams the same column set; CSV injection guard (prefix `'`
  to any cell starting with `= + - @`) — the existing order export escapes quoting only
  (`admin/orders/export/+server.ts:26-31`), so this is a deliberate hardening for the product path.
- Admin-only, audited (`targetType: 'inventory'` or a new `'import'`).

**g7. Cairo-timezone reporting buckets.**

`stats.ts` already buckets by Cairo day, but with a fixed `+02:00` offset and a "no DST" comment
(`stats.ts:55-68`) — wrong during Egypt's reinstated DST (last Friday of April → last Thursday of
October). Fix with a shared `src/lib/cairo-time.ts`:
`cairoDayStart(ms)`, `cairoMonthStart(ms)`, `cairoDayKey(ms)`, `cairoRanges(days)` computed via
`Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'` (the same approach as `invoice.ts:23-29`),
returning epoch bounds that SQL can range-scan (`created_at >= ? AND created_at < ?`). Replace the
fixed `DAY_MS` stepping; tests cover a spring-forward and fall-back Cairo date. Apply to the
dashboard series, any new coupon/returns/tax summaries, and inventory reports that bucket by day.
`admin/orders/export/+server.ts:9-24` already formats in Cairo and needs no change.

**Rough sizes:** g1 manual orders ~2 weeks; g2 edits/audit ~1.5 weeks; g5 adjustments ~1 week;
g6 bulk CSV ~2.5–3 weeks; g7 Cairo buckets ~0.5–1 week.

> **Delivery:** Each tool is a design sketch and gets its own spec → plan → implementation cycle;
> g1 depends on payments, g5 on the integrity spec, g7 is independent.

### 3h. Catalog expansion prerequisites

**Purpose.** Finish and enforce the product fields that shipping v2 (3b) and bulk tooling (g6)
require. The department dimension and the two-storefront split already shipped (§1.2 item 1);
what remains:

| Item            | Current state                                                                                                                                                                                         | Work                                                                                                                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sku`           | column exists (`schema.ts:49`), values for 2 seed rows; no uniqueness (`catalog-data.ts:13,201,1877`)                                                                                                 | normalize (trim, uppercase) at every boundary; partial unique index `WHERE sku IS NOT NULL` (SQLite supports it); typed admin conflict; import key (g6)                                                                                                                                                                |
| `published`     | column exists (`schema.ts:50`); enforced at cart validation (`orders.ts:127,148,195`) but not in listing/featured/search/sitemap (`store.ts:375-392,327-345,476-519`, `sitemap.xml/+server.ts:25-46`) | add the predicate to `buildProductWhere`, `getFeaturedProducts`, search suggestions, sitemap; admin publish/archive toggle with typed side-effects documented (archived product 404s on detail, disappears from FTS suggestions; order history unaffected)                                                             |
| `costPrice`     | column exists on product (`schema.ts:51`), unused                                                                                                                                                     | recommend moving to **variant** level (`store_product_variant.cost_price`) with product-level deprecated/fallback; surface in admin list/edit (margin display) and export; keep out of storefront queries                                                                                                              |
| `salePrice`     | absent                                                                                                                                                                                                | add `store_product_variant.sale_price` (nullable, `CHECK (sale_price IS NULL OR sale_price < price)`); effective price = `sale_price ?? price` in `store.ts` price projections and cart resolution; orders keep snapshotting `unit_price` (already immutable, `orders.ts:343-352`); badge UI is an area-level decision |
| `weightGrams`   | product-level exists (`schema.ts:52`), zero consumers                                                                                                                                                 | add `store_product_variant.weight_grams` (shipping v2 needs the sellable-unit weight); seed/backfill via admin + g6; product-level deprecated; shipping falls back to `DEFAULT_ITEM_WEIGHT_GRAMS` and flags estimated orders                                                                                           |
| admin surfacing | `productInputSchema` lacks all five (`admin/products.ts:18-36`)                                                                                                                                       | extend the zod schema + `ProductForm.svelte` with sku/published/cost/sale/weight per variant; conflict/validation messages in AR/EN                                                                                                                                                                                    |
| DDL copies      | 12 spec files embed the `store_product` DDL (grep 2026-09-13), including `admin/products.spec.ts:63-64`; the integrity spec §1.6 catalogues the order-table copies                                    | add the new variant columns to every embedded DDL in the same change                                                                                                                                                                                                                                                   |

**Explicitly not in scope:** further department/storefront UX, category tree changes, or one-cart
changes — shipped and frozen by this program.

**Dependencies.** None (can start immediately); **blocks 3b and g6**.

**Rough size: ~1.5–2 weeks.**

> **Delivery:** This is a design sketch. Catalog prerequisites get their own spec → plan →
> implementation cycle (possibly folded into the shipping-v2 spec if that ships first) with the
> repo quality gate and an ADR.

---

## 4. Sequencing & dependencies

### 4.1 Dependency graph

```
payments spec ─────────────┬───────────────► 3d returns (refund service, delivered state)
email spec ────────────────┼───────────────► 3f notification matrix (all email)
integrity spec ────────────┼───────────────► 3g-g5 adjustments (movement units, CHECKs)
ops spec ──────────────────┴───────────────► 3e reviews / 3d returns (rate limits, media)

3h catalog prereqs ────────► 3b shipping v2
                    └──────► 3g-g6 bulk CSV
3g-g7 Cairo buckets ───────► 3c tax summaries, 3a coupon reports, dashboard
3a coupons ────────────────► depends on payments order schema (0019) for snapshot columns
3c tax ────────────────────► depends on payments order total semantics; independent otherwise
3e reviews ────────────────► depends on 3h (published filtering) + email spec
```

### 4.2 Recommended wave order

| Wave                                                        | Contents                                                                                                                                                                                                 | Preconditions                                                  | Why this order                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **W0 — now, parallel to payments/email/ops implementation** | 3h catalog prereqs; 3g-g7 Cairo buckets; 3b shipping v2 (can run beside payments because `shipping_cost` is already an isolated snapshot); 3c tax config (additive columns; enabling is an owner toggle) | none                                                           | These are independent of money movement, unblock the rest, and put the order snapshot model in place before Paymob writes any orders |
| **W1 — with/after payments schema lands**                   | 3a coupons; 3g-g1 manual orders; 3g-g2 order/customer edits; 3e reviews (could move earlier if capacity allows); 3g-g6 bulk CSV                                                                          | payments `0019` schema applied (roadmap-frozen index); 3h done | Coupons/manual orders touch order totals and payment semantics, so they follow the payments schema; reviews/bulk only need 3h        |
| **W2 — after Paymob is live and refunds work**              | 3d returns/RMA; 3f notification consolidation; 3g-g5 stock adjustments if not already done                                                                                                               | payments refunds verified in production; 3g-g5; 3f sources     | Returns are the only area that can lose money if launched before refunds exist; its restock path needs adjustments                   |

Anything in W0 can ship **before real payments launch** without rework. Anything in W1 can ship
either side of Paymob go-live as long as migration numbering is arbitrated. W2 must not precede
production refunds.

### 4.3 Migration arbitration

- Journal ends at `0017_catalog_authority` (`drizzle/meta/_journal.json`). The roadmap freezes
  `0018`–`0023` plus the staged D3 file (EM `0018`, payments `0019`, ops `0020`, integrity
  `0021`/`0022`/`0023`). This program reserves none: at each area's implementation time, confirm
  the next free tag, generate with `drizzle-kit generate`, hand-review, and keep the staged-drop
  rules (integrity spec §3.2) in mind: never blindly commit generated drops for the legacy
  tables/columns.
- The legacy physical tables (`store_coupon`, `store_return`, `store_review`) are **not** in
  `schema.ts`, so `drizzle-kit generate` may propose dropping them. Generated SQL must be reviewed;
  each area that evolves one re-declares it in `schema.ts` in the same change.

---

## 5. Free-tier cost guardrails (per area)

The posture is fixed by `docs/architecture.md:244-266`: Workers Free 100K req/day, D1 Free
5M rows read/day + 100K rows written/day, Pages static bandwidth unmetered.

| Area                     | Added D1 reads (per action)                                                                                              | Added writes                                                       | Cacheability / controls                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3a coupons               | 1 preview resolve per explicit apply (debounce; no keystroke calls) + 1–2 in `createOrder`; redemption report admin-only | 1–2 per discounted order (redemption + counter)                    | public pages unaffected; preview rate-limited                                                                                                                  |
| 3b shipping v2           | 1–2 per checkout load (zone + rates, one query with a join); no reads elsewhere                                          | admin-only edits                                                   | no caching needed (tiny table; per-request read); do **not** module-cache rates (stale after admin edits on long-lived isolates) unless a version row is added |
| 3c tax                   | 1 settings read per order + admin reads                                                                                  | snapshot columns on the order write (no extra statement)           | settings are public-ish but read once per order; no page reads                                                                                                 |
| 3d returns               | customer/admin actions only (low volume)                                                                                 | 1 return + N items + evidence metadata; refund/restock link writes | evidence images count against KV limits (`admin/upload.ts:10-12`: 900 MB / 1000 writes/day) — cap 5 files × 5 MB per request                                   |
| 3e reviews               | 1 PK read (`store_product_rating`) + 1 paged list per product page                                                       | 1 review + 1 aggregate trigger update                              | product pages are already `private, max-age=60                                                                                                                 | 120` (`products/+page.server.ts:21`, `[department]/[category]/[slug]/+page.server.ts:19`); denormalized aggregate avoids joins; pending reviews are admin-only |
| 3f notifications         | 0 (outbox write on the existing event path)                                                                              | 1 outbox row per email (email spec's worker drains)                | reuse the email worker's cron; do not add a second scheduler                                                                                                   |
| 3g manual orders / edits | admin-only                                                                                                               | 1 audit row per edit (+ note row)                                  | admin-only endpoints                                                                                                                                           |
| 3g adjustments           | admin-only                                                                                                               | 1 movement row + 1 stock update per adjustment                     | admin-only                                                                                                                                                     |
| 3g bulk CSV              | admin-only                                                                                                               | ≤100 rows per chunk, resumable; a 2000-row import is ~2K–6K writes | dry-run makes zero writes; stream export; never run during a deploy                                                                                            |
| 3g Cairo buckets         | same aggregate scans as today, now with index-friendly epoch ranges                                                      | 0                                                                  | JS bucket loop replaced by SQL range filters where possible                                                                                                    |
| 3h catalog               | 0 new reads (columns already selected or addable to existing projections)                                                | migration only                                                     | published predicate may let FTS plans skip rows; unique index is one write-time check                                                                          |

Rules for every implementation plan: no N+1 (batch by ids like `loadVariantsForProducts`,
`store.ts:420-424`); every new public read path is either cacheable HTML or a PK lookup; every new
admin endpoint is authenticated and admin-only; no polling endpoints outside the pay page's
status poll (payments spec §3.3.6).

---

## 6. Open decisions (each with a recommendation)

1. **Tax inclusive vs exclusive.** Recommend **inclusive** (`rate_bp = 1400`, `active = 0` until
   the owner confirms VAT registration). Rejected exclusive now: it changes every displayed price
   and forces storefront/cart/email copy churn for no current need. Trade-off accepted: invoices
   must clearly state that prices include VAT; if the owner later wants ex-tax shelf prices, the
   snapshot model handles the switch per-order.
2. **Coupon stacking.** Recommend **one code per order; no stacking** in v1 (`stackable` column
   reserved but hidden). Rejected automatic stacking: it needs an allocation priority model, makes
   refund math and support harder, and the store has no data justifying it. Trade-off accepted:
   customers cannot combine a free-shipping code with a percent code.
3. **Review moderation policy.** Recommend **verified-purchase only + pre-moderation** (all pending
   until approved). Rejected open anonymous reviews (spam without volume upside) and auto-publish
   (one SEO penalty outweighs the convenience). Trade-off accepted: reviews appear only after an
   admin approves, and guest reviewers need their order-access link.
4. **Return restock policy.** Recommend **restock only inspected-`good` quantities**, never
   `damaged`/`wrong_item`/`missing`; refunds remain independent (a return can be refunded without
   restocking). Rejected automatic restock on receipt (goods are not verified yet) and
   no-restock-at-all (strands good sellable stock). Trade-off accepted: an inspection step is
   mandatory before money moves.
5. **Manual-order payment handling.** Recommend creating the order as `pending_payment`/`unpaid`
   and sending a Paymob payment link by email once payments are live; simulated mode pre-launch;
   admin "mark paid" only through the payments spec's guarded manual reconciliation (provider
   reference required). Rejected "admin marks paid freely" (unauditable) and "no manual orders
   until payments" (phone orders are a real need). No COD, ever.
6. **Bulk import format.** Recommend **CSV (UTF-8, BOM tolerated, RFC 4180)** with a header row,
   `sku` required as the upsert key, and a mandatory dry-run report. Rejected JSONL/Excel binaries
   (owner tooling, dependency weight) and sku-optional upserts (ambiguous matching).
   Trade-off accepted: one-variant-per-row for imports; multi-variant products stay manual.
7. **Return window and evidence.** Recommend a configurable **14-day** window from delivery, with
   **≥1 photo required** for `damaged`/`wrong_item` and optional otherwise. Rejected
   evidence-for-everything (blocks legitimate quick returns) and no-evidence damage claims
   (unverifiable refunds). Trade-off accepted: guests without a camera-capable device need the
   phone (orders include a phone number).
8. **Coupon release on cancellation.** Recommend releasing the redemption + counter **only when
   the order never shipped** (cancellation of `pending_payment`/`paid`/`processing`); post-`shipped`
   cancellations are returns/refunds territory and do not release. Rejected always-release (a
   shipped-then-returned order would double-count usage) and never-release (a failed payment would
   burn a limited code). Trade-off accepted: one cancelled order consumes a per-user slot until
   cancellation completes.

---

## 7. Program-level task breakdown

Ordered outline tasks per area — the decomposition a future spec/plan elaborates; sizes are
weeks, not implementation detail. "Deps" are hard prerequisites.

| Area                 | #   | Outline task                                                                                                                                                                                                                      | Size    | Deps                              |
| -------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------- |
| **3h catalog**       | 1   | Variant `cost_price`/`sale_price`/`weight_grams` columns + `sku` partial unique index + migration + DDL copies                                                                                                                    | 0.5 w   | —                                 |
|                      | 2   | `published` enforcement in listing/featured/search/sitemap + admin publish/archive toggle + tests                                                                                                                                 | 0.5 w   | —                                 |
|                      | 3   | Extend product/variant admin schemas + `ProductForm.svelte` + conflict mapping + i18n                                                                                                                                             | 0.75 w  | 1, 2                              |
|                      | 4   | Seed/backfill pass (weights, costs) + e2e (archived product hidden, sku conflict) + docs/ADR                                                                                                                                      | 0.25 w  | 1–3                               |
| **3b shipping v2**   | 1   | Tables + seed parity migration (7 zones/standard rates) + snapshot columns + DDL copies                                                                                                                                           | 0.75 w  | 3h                                |
|                      | 2   | `resolveShipping` service + weight computation + estimate resolution + unit specs                                                                                                                                                 | 0.75 w  | 1                                 |
|                      | 3   | Checkout load/submit integration (method select, estimates) + cart total wiring + i18n                                                                                                                                            | 0.5 w   | 2                                 |
|                      | 4   | `/admin/shipping` rate editor + audit + quote preview                                                                                                                                                                             | 0.75 w  | 1                                 |
|                      | 5   | `ShipmentProvider` interface + manual adapter + docs/ADR/e2e                                                                                                                                                                      | 0.25 w  | 2                                 |
| **3c tax**           | 1   | `store_tax_setting` + order/item snapshot columns + migration + DDL copies                                                                                                                                                        | 0.5 w   | —                                 |
|                      | 2   | Integer tax math service (inclusive/exclusive, rounding) + invoice render + unit specs                                                                                                                                            | 0.75 w  | 1                                 |
|                      | 3   | `/admin/settings/tax` + audit + monthly summary query/export                                                                                                                                                                      | 0.5 w   | 1                                 |
|                      | 4   | Checkout/invoice e2e + docs/ADR                                                                                                                                                                                                   | 0.25 w  | 2, 3                              |
| **3a coupons**       | 1   | `store_coupon*` rebuild + redemption + snapshot columns + migration + DDL copies                                                                                                                                                  | 0.5 w   | payments 0019                     |
|                      | 2   | Resolve/validate/allocate service + typed errors + unit specs (rounding, caps, limits)                                                                                                                                            | 0.75 w  | 1                                 |
|                      | 3   | Preview endpoint + authoritative `createOrder` integration + idempotent redemption + i18n                                                                                                                                         | 0.5 w   | 2                                 |
|                      | 4   | `/admin/coupons` CRUD + redemption report/CSV + audit                                                                                                                                                                             | 0.75 w  | 1                                 |
|                      | 5   | E2E (apply, cap, exhausted, cancel release) + docs/ADR                                                                                                                                                                            | 0.5 w   | 3, 4                              |
| **3d returns**       | 1   | Return/return_item/evidence schema rebuild + migration + `returns/` media prefix + DDL copies                                                                                                                                     | 0.75 w  | payments refunds; integrity units |
|                      | 2   | Customer request flow (eligibility, quantities, evidence upload, rate limit, status page)                                                                                                                                         | 0.75 w  | 1                                 |
|                      | 3   | Admin queue/detail + guarded workflow + refund allocation + `refundOrder` integration + restock via 3g-g5                                                                                                                         | 1.25 w  | 1; 3g-g5; payments refunds        |
|                      | 4   | Notifications (§3f rows) + order-detail panel + evidence serving policy                                                                                                                                                           | 0.5 w   | 3                                 |
|                      | 5   | DB-backed workflow tests + e2e (partial return, damaged vs good, refund failure retry) + docs/ADR                                                                                                                                 | 0.5 w   | 2–4                               |
| **3e reviews**       | 1   | Review + rating tables rebuild, aggregate triggers + migration + DDL copies                                                                                                                                                       | 0.75 w  | 3h                                |
|                      | 2   | Submission + verified-buyer check + abuse controls + rate limits + i18n                                                                                                                                                           | 0.75 w  | 1                                 |
|                      | 3   | Product-page display + paged list + `Seo.svelte` aggregateRating + e2e                                                                                                                                                            | 0.5 w   | 1, 2                              |
|                      | 4   | `/admin/reviews` moderation queue + bulk actions + approval email + audit                                                                                                                                                         | 0.5 w   | 2                                 |
|                      | 5   | Tests (trigger math, eligibility, spam heuristics) + docs/ADR                                                                                                                                                                     | 0.5 w   | 1–4                               |
| **3f notifications** | 1   | Consolidate matrix constants + renderer checklist + key/type mapping                                                                                                                                                              | 0.5 w   | email spec                        |
|                      | 2   | Wire each area's events (per-area work; verified here) + ops-alert boundaries                                                                                                                                                     | 0.25 w  | all areas                         |
|                      | 3   | Delivery-evidence e2e (enqueue assertions per event) + docs                                                                                                                                                                       | 0.25 w  | 2                                 |
| **3g admin**         | 1   | g7 Cairo-time helper + dashboard/report fixes + DST tests                                                                                                                                                                         | 0.5–1 w | —                                 |
|                      | 2   | g5 adjustments service + `/admin/inventory/adjustments` + movement reason CHECK                                                                                                                                                   | 1 w     | integrity spec                    |
|                      | 3   | g2 order/customer edit + audit before/after + notes table + `AuditTargetType` extension                                                                                                                                           | 1.5 w   | payments 0019                     |
|                      | 4   | g1 manual order creation + `source`/`created_by` + payment-link action + audit                                                                                                                                                    | 2 w     | payments 0019                     |
|                      | 5   | g6 CSV import/export + `store_import_batch` + dry-run + injection guard + e2e                                                                                                                                                     | 2.5–3 w | 3h; g5 for stock rows             |
| **Totals**           |     | Solo sequential ≈ **26–28 weeks**; W0 items (≈ 8 weeks) are independent of payments and can start now; W1 items can overlap the payments implementation after `0019`; W2 (returns, ≈ 3.5–4 weeks) must follow production refunds. |         |                                   |

External/business dependencies (not tasks): owner decisions in §6; Paymob go-live and refund
verification (payments spec); email domain + provider (email spec); VAT registration status; a
decision on the shipping carrier when/if integration becomes real.

---

## 8. Verification log (for reviewers of this document)

- Production D1 queried read-only on 2026-09-13: `store_order` 0, `store_notification` 0,
  `store_return` 0, `store_review` 0, `store_coupon` 0, `store_product` 191,
  `store_product_variant` 191.
- Files read for this design: `src/lib/server/db/schema.ts`, `src/lib/cart.ts`,
  `src/lib/shipping.ts`, `src/lib/server/orders.ts`, `src/lib/server/store.ts`,
  `src/lib/server/checkout-schema.ts`, `src/lib/server/invoice.ts`,
  `src/lib/server/rate-limit.ts`, `src/lib/server/admin/{orders,products,audit,stats,upload}.ts`,
  `src/routes/admin/orders/[id]/+page.server.ts`,
  `src/routes/admin/orders/export/+server.ts`,
  `src/routes/media/[...key]/+server.ts`, `src/lib/admin-order-status.ts`,
  `docs/architecture.md`, `docs/todo.md`, `docs/decisions.md` (2026-09-02/09-09 entries),
  `drizzle/0014_famous_odin.sql`, `drizzle/0017_catalog_authority.sql`,
  `drizzle/meta/_journal.json`, and the four companion specs.
- Corrections over the original brief are listed in §1.2; none of them change the program scope,
  only the starting line for 3h and the fact that the two-storefront UX work is already done.
- This document changes no code, config, migrations, or other docs; the four companion specs are
  untouched.
