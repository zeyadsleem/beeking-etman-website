# Master Plan — 2026-09-02 Priority Overhaul

Owner-approved re-prioritization of the roadmap shipped in `docs/todo.md`.
This supersedes the "#### Roadmap (2026-08-25)" ordering in that file for the
items it touches. Phases run strictly top to bottom; each phase keeps its own
spec → plan → implementation cycle and its own quality gate
(`vp check` 0 errors, `vp test` green, `vp build` clean).

Decisions locked this session:

| Decision             | Choice                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Real payment gateway | **Paymob** (cards + Egyptian wallets: Vodafone Cash, Orange Cash, etc.)                                                                                                                                      |
| COD                  | **Remove entirely** from every part of the site, permanently. No COD option at any stage.                                                                                                                    |
| Prod-readiness gate  | Site is online-payment-only, gated on a live Paymob integration. Until Paymob is active, checkout simulates payments but **the COD option never exists** in any UI.                                          |
| Transactional email  | **Keep Cloudflare Email Service + harden it** (deliverability, admin notification, async reliability). Do NOT migrate to Resend/SendGrid unless a documented deliverability failure is proven in production. |
| Dev hydration        | Blocking fix, no owner decision — it just needs repairing.                                                                                                                                                   |

---

## Phase 0 — Dev hydration fix (Blocking, first)

**Problem:** `vp dev` serves HTML without client-side JS, so cart/checkout are
broken locally and every change needs a `build && preview` cycle.

**Diagnosis to run first (before any fix):**

1. Reproduce: `pnpm dev` → open page → confirm no client JS executes (check
   for the SvelteKit hydration script and that `data-sveltekit-hydrate` mounts).
2. Check `<script type="module">` / `_app/immutable` asset URLs in the served
   HTML and whether the dev server actually serves them (404? wrong base?).
3. Check `svelte.config.js`/`vite.config.ts` for adapter/target mismatch and
   whether Vite+ is invoking SvelteKit's `vite dev` correctly.

**Likely root causes to evaluate (in order):**

- SvelteKit adapter-cloudflare `dev` interplay with Vite+ (`vp dev`).
- A server-only error being thrown during client-side hydration that kills the
  module graph (the previously-fixed `cache-control` 500 is the same _class_ of
  bug — a load/server error that breaks dev). Re-audit `+page.server.ts`
  files for runtime errors under `dev`.
- Missing `export const ssr`/`prerender` misconfig forcing a SSR-only response.
- Asset base path misconfiguration (`base`/`paths.relative`).

**Definition of done:** `pnpm dev` on a fresh port launches a hot-reloading app
where cart add/remove and full checkout work entirely client-side with no
manual `build && preview`. Hydration mounts, no console errors.

**Owner note:** this is the only phase that is pure repair — no product
decision. Recommend it goes first because it unblocks fast iteration on every
other phase.

---

## Phase 1 — Paymob payment gateway (Critical)

Owner decision: **Paymob**, full COD removal. This is the biggest change and
touches schema, checkout, orders, admin, the success page, PostHog, and email.

### 1.1 Merchant onboarding (Task — owner)

- Create Paymob test account; obtain `API_KEY`, `HMAC` secret, and a card
  `integration_id` + wallet `integration_id`. Store via Cloudflare Pages
  secrets: `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_CARD`,
  `PAYMOB_INTEGRATION_WALLET`.
- Verify test-card flow end to end in Paymob dashboard before any code is
  marked done.

### 1.2 Webhook security contract

- Paymob posts `transaction_response` objects to
  `/api/payments/paymob/webhook`.
- **Validate HMAC** from `hmac` query param against the body using
  `PAYMOB_HMAC_SECRET` (constant-time compare). Reject + `400` anything that
  fails — before touching the DB.
- **Idempotency:** key on `transaction.id` + `order.id`. Never double-apply a
  successful charge. A `payments_transaction` ledger table records every
  webhook so retries and replays are no-ops.

### 1.3 Schema: split payment vs fulfillment status (Migration)

Current `store_order.status` is a single `paid|shipped|delivered|cancelled`.
Paymob needs the payment lifecycle tracked separately.

- Introduce `store_order.payment_status` (`pending|paid|failed|refunded`) and
  `store_order.fulfillment_status` (`placed|shipped|delivered|cancelled`).
- Keep the single `status` column as a **derived/resolved view** (or migrate
  callers) so admin UI, emails, and the success page keep working; decide the
  exact mapping in the spec.
- Broadcast events on state change into `payments_transaction` ledger rows.

### 1.4 Checkout flow (server-side tokenization via Paymob)

- The SvelteKit checkout builds a Paymob payment via the REST API:
  1. Auth token → 2. Create payment order (amount = order total, in EGP:
     `piastres`) → 3. Request card/wallet key → 4. Redirect the buyer to the
     Paymob hosted checkout (cards) or wallet link (`wallet` via `source`).
- Amounts come from `computeTotals` **only** — never trust client-sent totals.
- Replace the mocked "Payment was simulated" confirmation with a real "waiting
  for payment" state and the hosted redirect.
- The `checkout/success` page becomes "order placed — payment pending"; a paid
  confirmation arrives via webhook → separate "payment confirmed" state + email.

### 1.5 Stock decrement semantics (revisit)

`docs/todo.md` Phase 6 explicitly says to revisit "stock-decrement semantics
(at-order vs at-payment)". Decide and lock in the spec:

- Recommended: **reserve at order placement** (decrement), **release on
  cancel/failure** (already supported via `restoreStock`), because real
  payment removes the COD-era need to only decrement at sale. Confirm against
  Paymob's `pending` window.

### 1.6 Refunds

- Add admin refund action: Paymob refund API call gated by HMAC-verified admin
  session, recorded to the ledger, sets `payment_status = refunded`, restores
  stock, and emails the customer. Policy doc.

### 1.7 COD removal sweep

Delete/neutralize every COD reference site-wide: checkout UI, cart, order
model, email copy, admin labels, i18n keys, tests. The word "الدفع عند
الاستلام" / "cash on delivery" must not appear anywhere.

---

## Phase 2 — Transactional email hardening (Critical)

Keep Cloudflare Email Service; make it reliable and add the admin loop the
owner called out ("no instant notifications to the customer or admin").

### 2.1 Reliability / non-fire-and-forget

- Current `sendEmail` is best-effort and silent when the `EMAIL` binding is
  absent. Replace with an **outbox pattern**: insert an `emails_outbox` row
  (recipient, type, payload) in the same DB transaction as the order; a retry
  worker (Cron Trigger) flushes the outbox to the EMAIL binding with
  exponential backoff and a dead-letter table. A send is never "lost" because
  it's durable.
- Add **deliverability signals**: monitor for soft/hard bounce via Email
  Routing, surface failures in the admin audit log and dashboard.

### 2.2 Admin notifications

- Add an admin-facing transactional email (e.g. "طلب جديد #HNY-XXXX " with the
  line items + customer + totals) sent to a configurable list
  (`ADMIN_NOTIFY_EMAILS`, comma-separated, replacing the single-email
  assumption), so the owner is pinged the instant an order lands (and again on
  payment confirmation).
- Bilingual AR/EN, same inline-styled HTML system already in `email.ts`.

### 2.3 Password reset (unblocks existing gap)

- Wire Better Auth SMTP with the hardened provider so password reset actually
  sends (currently disabled without `SMTP_HOST`). Needs confirmed-CF-email
  domain for SPF/DKIM.

---

## Phase 3 — Sales & operations upgrade

### 3.1 Governorate shipping (Egypt zones)

- Products already carry `weight_grams` (Phase 3 groundwork). Define shipping
  **zones** by governorate: Cairo/Giza, Alexandria/Delta, Upper Egypt
  (الصعيد), Canal (القناة), remote — each with a price and a weight-based
  tier.
- Checkout gains a governorate-aware shipping step; `computeTotals` → total +
  shipping; order stores a `shippingCost` + `shippingZone`.
- Owner input needed: real price list per zone/weight (grilling).

### 3.2 Inventory

- **Archive/soft-delete:** `store_product.published` already exists — add
  admin "archive" action (sets `published=false`) that hides products from all
  storefront routes, preserving history. Add `deletedAt` optional for audit if
  desired.
- **Low-stock alerts:** per-variant `lowStockThreshold`; when stock ≤ threshold
  after a decrement, create an admin alert (audit log + admin dashboard widget)
  and send an admin email. Auto-set on schema default.
- **Out-of-stock auto-stop:** when variant `stock` reaches 0 (or a
  `sellable` flag), product is:
  1. Hidden from storefront listings (or shown as "نفذت الكمية" with the CTA
     disabled), and
  2. **Rejected at order time** — `createOrder` already guards stock, extend to
     a hard out-of-stock message.

### 3.3 Coupons / discount codes

- New `coupon` table + `coupon_redemption` (per-order, one redemption).
- Types: **percent** or **fixed** discount; validation: code, expiry,
  max-redemptions, min-subtotal; scoped to departments/products optionally.
- Applied at checkout before shipping; recorded on the order (`discount`,
  `couponCode`) and in PostHog `purchase` event.

### 3.4 Product reviews

- New `product_review` table (`productId`, `author`, `rating` 1–5, `title`,
  `body`, `imageKeys[]`, `moderationStatus`, `banned`/`flagged`).
- Customers (logged-in, verified purchasers) can leave reviews with image
  uploads → media stored in the existing KV media pipeline.
- **Admin moderation queue** (approve/hide/reject) before public display, per
  the owner's "with admin control before publishing" requirement.
- Public display on product pages (aggregate rating, count, list of approved).

---

## Phase 4 — Performance & architecture

### 4.1 Image optimization

- Product/media images currently served from Workers KV via `/media/[...key]`
  with no on-the-fly resizing.
- **Decision point (spec):** adopt **Cloudflare Images** (tightest fit —
  serves from the same account, transforms + AVIF/WebP + srcset) OR keep first-
  party KV + a resize-on-upload pipeline. Both must yield responsive
  `srcset`/`sizes` + AVIF/WebP. Owner reviewed in spec.
- ProductCard/ProductImageGallery updated to consume optimized variants.

### 4.2 Phaser lazy-load on /blends

- `BlendGame.svelte` / `blend-lab` should import Phaser via **dynamic
  import** so it only loads when the `/blends` route mounts, not on every
  client navigation.
- Use a Svelte 5 `$effect`/async load in the client component; keep the
  SSR shell static. Effect: `blends` page weights (Phaser ~200KB+) stop
  inflating the homepage and catalog bundles.

### 4.3 Multi-admin roles

- `user.role` already exists (`admin`/`user`) but bootstrap only promotes a
  single `ADMIN_EMAIL` from env.
- Build an **admin management screen** (admin-only): invite/promote/revoke
  admin by email, list current admins, demote. Move away from the env-only
  bootstrap: first admin comes from `ADMIN_EMAIL`, thereafter from the admin
  UI.
- Add granular roles if needed (`admin` vs `moderator` for review/products) —
  decide in spec; at minimum support a list of admins, not one frozen email.

---

## Phase 5 — Reconciliation with existing roadmap

Fold the remaining pre-existing roadmap items (PostHog funnel, catalog
expansion to two storefronts, operations hardening: invoice PDF/CSV
export/Cairo-time buckets/audit log/KV media guardrails) into their correct
phase or defer them as-is. Confirm the ordering of the two-storefront
expansion relative to the new priority phases with the owner.

---

## Measures of success (global gate)

- Every phase lands with `vp check` 0 errors, `vp test` green, `vp build`
  clean.
- No COD text/option anywhere in UI, i18n, order model, or email.
- Real EGP transaction completes end-to-end in a test environment
  (card + wallet), and a webhook replays do not double-charge.
- Order confirmations + new-order admin notifications are reliably delivered.
- `blends` route loads Phaser lazily (bundle-size delta verified in build
  output).
- More than one admin can be listed/promoted/revoked from the dashboard.
