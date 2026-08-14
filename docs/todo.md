# Todo

Ordered work items with status. The original storefront shipped under
`docs/superpowers/plans/2026-08-12-honey-store.md`; the مملكة النحل redesign ran
under `docs/superpowers/plans/2026-08-14-mamlakat-alnahl.md` (spec
`docs/superpowers/specs/2026-08-14-mamlakat-alnahl-design.md`).

## Shipped

### Honey storefront (`2026-08-12-honey-store.md`)

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
- [x] Task 11 — E2E tests, docs, quality gate

### مملكة النحل redesign (`2026-08-14-mamlakat-alnahl.md`)

- [x] Task 1 — Variant schema migration (`2003fe9`)
- [x] Task 2 — Variant-keyed cart core, cookie, store (`421c7c9`)
- [x] Task 3 — Store queries with variants + minPrice (`568bb9c`)
- [x] Task 4 — Variant order service + checkout server (`cfd5828`)
- [x] Task 5 — Product detail variant selector (`0f387c6`)
- [x] Task 6 — Variant-aware product cards (`193486d`)
- [x] Task 7 — Variant display in cart/checkout/success (`9f43f9b`)
- [x] Task 8 — Real catalog: 6 categories, 21 products, 43 variants,
      researched EGP prices, verified real photos (`fdc2f89`)
- [x] Task 9 — مملكة النحل brand + view transitions (`342f388`)
- [x] Task 10 — Royal Kingdom design tokens + animations (`d993192`)
- [x] Task 11 — Hero, marquee, stats, reveals, benefit rails (`5894e5a`)
- [x] Task 12 — E2E variant checkout flow (`ade1bcb`)
- [x] Task 13 — Quality gate + docs (`in progress`)

## Discovered

- [ ] Investigate dev-mode hydration: `vp dev` serves HTML without client
      entry scripts (no hydration, clicks dead) in this environment; `vp
  preview` works. `vp env doctor` passes. Likely a Vite+ dev integration
      issue — confirm root cause before relying on dev-mode smoke tests.
- [ ] Production rate-limit persistence: `src/lib/server/rate-limit.ts` is an
      in-memory per-process store; needs a shared store (DB/Redis) before
      multi-instance deployment.
- [ ] Idempotency nonce for order creation: double-submit is guarded client-
      side and by the empty-cart check, but there is no request nonce; two-tab
      concurrent submits can still create duplicate orders. Consider a nonce
      for retry-safe checkout.
- [ ] Card expiry past-date check: checkout schema only validates the `MM/YY`
      format, not that the date is in the future.
- [ ] E2E/unit gap noted in review: e2e covers the guest happy path and
      validation errors; unit coverage exists for cart/cookie/orders/currency
      helpers but not for page components (e.g. checkout form behavior).
- [ ] Third-party product imagery: catalog photos are verified Unsplash CDN
      URLs; consider migrating to first-party/static hosting to remove remote
      dependence.
- [ ] `pnpm audit` flags 5 vulnerabilities (lodash ×3, esbuild) in transitive
      dev tooling (drizzle-kit/tsx/vite); pre-existing, dev-only — revisit
      when updating the toolchain.
