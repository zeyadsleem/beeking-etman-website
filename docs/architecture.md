# Architecture

Living description of the honey storefront system. Implementation plan and
design spec: `docs/superpowers/plans/2026-08-12-honey-store.md` and
`docs/superpowers/specs/2026-08-12-honey-store-design.md`.

## Stack

- SvelteKit 2.70 (Svelte 5, runes), TypeScript strict, Tailwind CSS v4
- Drizzle ORM + SQLite (`local.db`, libsql client), drizzle-kit for schema
- Better Auth (`auth` package) with password provider; tables in
  `src/lib/server/db/auth.schema.ts`
- Package manager: pnpm; toolchain: Vite+ (`vp dev`, `vp build`, `vp test`,
  `vp check`); adapter-node for production (preview via `vp preview`)
- Testing: Vitest (unit, `*.spec.ts`) and Playwright (E2E, `*.e2e.ts`)

## Module map

- `src/lib/currency.ts` — pure currency formatting (Arabic locale, JPY-style
  unit handling for honey prices in fils).
- `src/lib/cart.ts` — pure cart helpers (add/remove/quantity/totals).
- `src/lib/cart-store.svelte.ts` — Svelte 5 client cart store, syncs to the
  signed cookie via `POST /api/cart`.
- `src/lib/server/cart-cookie.ts` — signed `honey_cart_v1` cookie (HMAC,
  HttpOnly, SameSite=Lax); `getCartSecret(env)`.
- `src/lib/server/checkout-schema.ts` — zod schemas for checkout submission.
- `src/lib/server/store.ts` — catalog/store queries.
- `src/lib/server/orders.ts` — transactional order service with mock payment.
- `src/lib/server/db/{index,schema}.ts` — Drizzle client and store tables.
- `src/routes/api/cart/+server.ts` — cart sync endpoint.
- Routes: `/` (home), `/products` + `/products/[slug]` (catalog),
  `/cart`, `/checkout` + `/checkout/success/[id]`. Auth/demo routes under
  `/demo` are scaffold leftovers.

## Data model

- `store_product` — catalog items (name, slug, price, stock, image, category).
- `store_order` — orders (number, name, phone, email, shipping, totals,
  status).
- `store_order_item` — line items (product ref, name, unit price, quantity).
- Better Auth tables — user/session/account, etc.

## Notable behavior

- Cart is client-mirrored and server-signed; server is the source of truth at
  order time.
- Checkout failure never echoes card data; order creation is atomic with stock
  decrement; success page is `private, no-store`.

## Deployment

- Not yet deployed. `adapter-node` build output via `vp build`; preview locally
  with `vp preview`. No CI/CD configured.

## Known environment quirk (pre-existing)

- `vp dev` serves HTML without client entry scripts in this environment, so
  hydration/clicks do not work in dev mode. The production build (`vp preview`)
  hydrates and works normally. `vp env doctor` reports all checks passing; this
  is a Vite+ dev integration behavior, not an app bug.
