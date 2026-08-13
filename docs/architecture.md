# Architecture

Living description of the honey storefront system. Implementation plan and
design spec: `docs/superpowers/plans/2026-08-12-honey-store.md` and
`docs/superpowers/specs/2026-08-12-honey-store-design.md`.

## Stack

- SvelteKit 2.70 (Svelte 5, runes), TypeScript strict
- Tailwind CSS v4 with Cairo variable font; Arabic RTL layout (`dir="rtl"`)
- Drizzle ORM + SQLite (`local.db`, libsql client), drizzle-kit for schema
- Better Auth (`auth` package) with password provider; tables in
  `src/lib/server/db/auth.schema.ts`
- Package manager: pnpm (npm refuses scripts via `devEngines` pin); toolchain:
  Vite+ (`vp dev`, `vp build`, `vp test`, `vp check`); adapter-node for
  production (preview via `vp preview`)
- Testing: Vitest (unit, `*.spec.ts`) and Playwright (E2E, `*.e2e.ts`) against
  the seeded preview server

## Module map

- `src/lib/currency.ts` — `formatEGP`: formats integer qirsh (1/100 EGP) with
  the `ar-EG` currency locale.
- `src/lib/cart.ts` — pure cart helpers (add/remove/quantity/totals); flat
  shipping (EGP 60, free ≥ EGP 600).
- `src/lib/cart-store.svelte.ts` — Svelte 5 client cart store, syncs to the
  signed cookie via `POST /api/cart`.
- `src/lib/server/cart-cookie.ts` — signed `honey_cart` cookie (HMAC, HttpOnly,
  SameSite=Lax, 30-day max age); `sanitizeCartLines` validates every external
  cart payload; `getCartSecret(env)`.
- `src/lib/server/checkout-schema.ts` — zod schema for checkout submission
  (name, email, Egyptian phone, city, address, mock card fields).
- `src/lib/server/store.ts` — catalog/store queries.
- `src/lib/server/orders.ts` — transactional order service with mock payment
  (`createOrder`, `generateOrderNumber` → `HNY-######`).
- `src/lib/server/rate-limit.ts` — in-memory sliding-window rate limiter for
  auth actions.
- `src/lib/server/db/{index,schema}.ts` — Drizzle client and store tables.
- `src/routes/api/cart/+server.ts` — cart sync endpoint (sanitize + sign +
  set cookie).
- Routes: `/` (home), `/products` + `/products/[slug]` (catalog), `/cart`,
  `/checkout` + `/checkout/success/[id]`, `/login`, `/register`,
  `/account/orders` (signed-in user's orders), `/api/cart`. Auth/demo routes
  under `/demo` are scaffold leftovers.

## Data model

- `store_category` — categories (name, slug).
- `store_product` — catalog items (name, slug, description, price in qirsh,
  stock, image, category ref, featured).
- `store_order` — orders (number, customer fields, total in qirsh, status,
  nullable `user_id`, created-at).
- `store_order_item` — line items (order ref, product ref, name, quantity,
  unit price in qirsh).
- Better Auth tables — user/session/account, etc. The scaffold `task` table is
  a leftover.

## Notable behavior

- Cart is client-mirrored and server-signed; the server is the source of truth
  at order time. `POST /api/cart` sanitizes unsigned input before signing.
- Checkout runs in a Drizzle transaction: re-reads stock, decrements with a
  stock guard, inserts order + items, mocks payment (`status = "paid"`). A
  failed payment leaves the cart intact; at most one order per cart.
- Checkout failure never echoes card data; success page is `private, no-store`.
- Auth rate limiting is in-memory (per-process); login/register and account
  order details are ownership-gated.

## Deployment

- Not yet deployed. `adapter-node` build output via `vp build`; preview locally
  with `vp preview`. No CI/CD configured.

## Known environment quirk (pre-existing)

- `vp dev` serves HTML without client entry scripts in this environment, so
  hydration/clicks do not work in dev mode. The production build (`vp preview`)
  hydrates and works normally. `vp env doctor` reports all checks passing; this
  is a Vite+ dev integration behavior, not an app bug. E2E therefore runs
  against the preview server.
