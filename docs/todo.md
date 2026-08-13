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

## Pending

- [ ] Task 10 — Auth pages + account orders
  - `/login` and `/register` pages wired to Better Auth actions
  - `/account/orders` showing the signed-in user's orders
- [ ] Task 11 — E2E tests, docs, quality gate
  - Update `playwright.config.ts`, write `src/routes/store.e2e.ts`, run suite
  - Finish docs (project memory initialized; verify plan checkboxes)
  - Full quality gate, then final commit

## Discovered

- [ ] Investigate dev-mode hydration: `vp dev` serves HTML without client
      entry scripts (no hydration, clicks dead) in this environment; `vp
  preview` works. `vp env doctor` passes. Likely a Vite+ dev integration
      issue — confirm root cause before relying on dev-mode smoke tests.
