# Todo

Ordered work items with status. Driven by the honey storefront plan
(`docs/superpowers/plans/2026-08-12-honey-store.md`).

## Shipped

- [x] Task 1 — Schema, auth tables, seed, DB scripts (`94bc959`)
- [x] Task 2 — Currency + cart + checkout helpers (`e2b038d`)
- [x] Task 3 — Signed cart cookie + API endpoint (`7d7006a`)
- [x] Task 4 — Store queries + transactional order service (`0634ae6`)
- [x] Task 5 — Design system, components, cart store, RTL shell
- [x] Task 6 — Home page (`d879381`)
- [x] Task 7 — Catalog listing + product detail (`bc0c332`, `000ce92`)
- [x] Task 8 — Cart page (`301d697`)
- [x] Task 9 — Checkout flow, mock payment, success page (`845c211`)
- [x] Task 9 review fixes — double-submit + card-echo hardening,
      cache/ordering, `CheckoutFail` type (`9615469`)
- [x] Task 10 — Auth pages + account orders (`22dd284`)
  - `/login` and `/register` pages wired to Better Auth actions
  - `/account/orders` showing the signed-in user's orders
  - Auth rate limiting + order-details ownership gate (`d5fb982`)
- [x] Task 11 — E2E tests, docs, quality gate
  - `playwright.config.ts` webServer seeds + preview; `src/routes/store.e2e.ts`
    (guest checkout happy path + checkout validation errors) — both green
  - README stack/setup; decisions/architecture/todo updated
  - Quality gate (vp check, unit, e2e, build) all green; final commit

## Discovered

- [ ] Investigate dev-mode hydration: `vp dev` serves HTML without client
      entry scripts (no hydration, clicks dead) in this environment; `vp
preview` works. `vp env doctor` passes. Likely a Vite+ dev integration
      issue — confirm root cause before relying on dev-mode smoke tests.
- [ ] Production rate-limit persistence: `src/lib/server/rate-limit.ts` is an
      in-memory per-process store; needs a shared store (DB/Redis) before
      multi-instance deployment.
- [ ] Idempotency nonce for order creation: double-submit is guarded client-
      side and by the empty-cart check, but there is no request nonce;
      consider one for retry-safe checkout.
- [ ] Card expiry past-date check: checkout schema only validates the `MM/YY`
      format, not that the date is in the future.
- [ ] E2E/unit gap noted in review: e2e covers the guest happy path and
      validation errors; unit coverage exists for cart/cookie/orders/currency
      helpers but not for page components (e.g. checkout form behavior).
