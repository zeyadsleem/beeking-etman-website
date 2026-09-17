# AgDR-0001 — COD and manual transfer settlement for v1; Paymob deferred

**Status:** Executed (owner decision, 2026-09-17).
**Supersedes:** `docs/decisions.md` 2026-09-02 ("COD is removed entirely and permanently"; Paymob
as the launch-critical payment path); the payment goals, provider choice, and non-goals of
`docs/superpowers/specs/2026-09-13-order-lifecycle-payments-design.md` (now deferred).
**Related:** AgDR-0002 retires the blend studio. This record covers the order and payment half of
the same pivot.

> In the context of a live storefront with no payment gateway and an owner whose sales run on cash
> on delivery and manual transfers, facing indefinite launch delay from Paymob merchant onboarding,
> I decided to ship v1 with cash on delivery plus InstaPay and Vodafone Cash transfers under
> admin-verified payment, accepting a manual review step per prepaid order, to achieve a launchable
> checkout that matches how the shop actually collects money.

## Context

- The storefront sells honey jars and ready-made blends. Production writes
  `payment_status = 'simulated'` and holds no card data (`docs/architecture.md`).
- The 2026-09-02 owner brief made Paymob the launch priority and removed cash on delivery
  permanently. The 2026-09-13 Paymob spec designed cards + wallets with the webhook as sole truth
  and 30-minute stock holds.
- Paymob merchant onboarding (KYB approval, keys, HMAC secret, integration IDs) is still an open
  owner action. It gates any card design.
- On 2026-09-17 the owner restated his real workflow: most orders are paid cash on delivery or by a
  manual transfer to an InstaPay address or a Vodafone Cash wallet. He wants the site to record
  orders, show shipping and totals, and give the shop a review step for transfers. He does not want
  a gateway in v1.
- Reliability, audit, and stock integrity stay hard requirements. The pivot simplifies the payment
  provider, not the order record.

## Options Considered

| Option                                           | Pros                                                                                                                                                        | Cons                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Keep Paymob-only v1 (2026-09-02 plan)            | One automated settlement path; the webhook is sole truth; no manual reconciliation                                                                          | Merchant onboarding gates launch indefinitely; cards are not the main channel; a manual-review path is still needed for offline cases |
| COD only                                         | Simplest flow; no verification queue                                                                                                                        | No prepaid option; no commitment signal; higher cancel and no-show rate                                                               |
| COD + manual transfer with admin review (chosen) | Matches the owner's workflow today; launch does not wait for a gateway; one review queue covers both methods; the payment state machine stays gateway-ready | Manual verification load on the shop; a customer claim is not proof; a false claim needs a rejection path                             |

## Decision

Chosen: **COD + manual transfer (InstaPay and Vodafone Cash), with admin-verified payment.**
Paymob is deferred to phase 2 with no date.

- `payment_method` per order: `cod`, `instapay`, `wallet` (Vodafone Cash). Legacy `simulated`
  remains only for pre-pivot rows.
- Payment vocabulary for v1: `unpaid` (awaiting payment), `pending_review` (customer claims a
  transfer; awaiting shop verification), `paid` (verified by the shop), `refunded`, and `failed`
  (rejected claim). A claim, a screenshot, or a button press never sets `paid`.
- Only an admin verification sets `paid`. Every verification writes a settlement event
  (`store_payment_event`) and an admin audit row (`store_admin_audit`).
- COD orders stay `unpaid` by design until the shop collects cash. The admin marks `paid` at
  collection.
- Stock is reserved at placement with a `hold_expires_at` deadline (recommended default 24 hours,
  configurable). Cancellation or deadline expiry releases the hold exactly once.
- Fulfillment and payment are separate state machines. Fulfillment vocabulary:
  `pending_confirmation` → `confirmed` → `processing` → `shipped` → `delivered`, plus `cancelled`.
  Legacy `placed` and `paid` remain read aliases of `confirmed`.
- WhatsApp stays a communication channel. It carries the prefilled order message and the transfer
  screenshot. It owns no order state.
- Partial refunds and gateway refunds are out of v1. The shop records a full refund with a reason
  and a reference, and moves the money on the same rails it was collected on.

## Consequences

- The shop accepts one manual verification step per prepaid order. The admin orders list gains a
  review queue and a payment filter.
- Migration 0019 (`0019_settlement.sql`, number frozen by the program roadmap) is reshaped before
  it is ever applied. The journal ends at 0017, so no data migration or drain applies.
- The deferred Paymob design must be rebased on this lifecycle before implementation. Its HMAC
  webhook, intention API, and reconciliation sections stay valid as raw material; its vocabulary
  (`pending_payment`, provider intention id, 30-minute expiry) does not.
- Orders created before the pivot keep `placed`/`paid`/`simulated` and read as confirmed, paid
  legacy rows. No backfill runs.
- The launch checklist no longer waits on Paymob. It waits on the owner's receiving accounts
  (InstaPay address, wallet number), the WhatsApp number, and a COD yes/no.
- Reconciliation is a manual review queue plus a daily digest, not a webhook monitor. The
  guarantee is "no order ships with an unverified prepaid claim", not "no money is lost".

## Artifacts

- Tickets on `zeyadsleem/beeking-etman-website`: #4 (docs), #5–#11 (schema, lifecycle, checkout,
  pages, admin queue, expiry, notifications), #14 (coverage), #15 (security and docs pass).
- Spec: `docs/superpowers/specs/2026-09-17-manual-settlement-design.md` (v1, authoritative for
  payment vocabulary and migration 0019).
- Deferred design: `docs/superpowers/specs/2026-09-13-order-lifecycle-payments-design.md` (phase 2
  reference, not a build plan).
- Program updates: `docs/todo.md` M1, `docs/superpowers/specs/2026-09-13-commerce-platform-roadmap-design.md`
  sections 1.3, 2, 4.2, 6, and 7, `docs/decisions.md` 2026-09-17.
