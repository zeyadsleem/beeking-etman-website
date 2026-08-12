# Design Spec — متجر العسل (Arabic RTL Honey Storefront)

Date: 2026-08-12
Status: Draft → Approved
Scope: One-shot MVP e-commerce, catalog + cart + checkout.

## 1. Goal

A beautiful, production-quality MVP e-commerce storefront for an Egyptian honey
store. The interface is fully **Arabic (RTL)**, prices are in **Egyptian Pounds
(EGP)**, and the catalog is tuned for the Egyptian market (سدر، برتقال، مراعي، هدايا).

Deliverable: browse catalog, filter/search, add to cart, guest checkout with a
mock payment step, and an order confirmation. No real payment gateway, no admin
panel, no inventory management beyond stock decrement.

## 2. Decisions

- **Approach:** single full-stack SvelteKit app (SSR). Zero new external services.
- **Stack (existing):** SvelteKit 2, Svelte 5 (runes), Tailwind CSS 4, Drizzle ORM,
  libSQL (SQLite), better-auth (email/password), Vitest + Playwright, Node adapter.
- **Auth:** guest checkout is the primary path; better-auth accounts are optional.
  A logged-in user's order is linked to their userId.
- **Currency:** EGP stored as integer in _milliemes_ (π = EGP × 100) to avoid float
  issues. Formatting via `Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" })`.
- **Language/layout:** `lang="ar" dir="rtl"` on the root layout. Arabic font
  (Almarai or Cairo) bundled via Fontsource — no external font CDN.
- **Cart state:** client-side (localStorage) as the source of truth, mirrored to a
  signed server cookie to allow server-side totals. Cart persists across sessions.
- **Images:** seed data references stable, hotlinkable Unsplash honey-photo URLs.
  No local image assets required.
- **Payment:** mock — the checkout shows a card form (number/expiry/cvv) that is
  validated but never charged (flash "دفعة وهمية" is acceptable; the confirmation
  page labels it as "محاكاة دفع").

## 3. Data Model (Drizzle, libSQL)

### Categories (`categories`)

- `id` text PK (uuid)
- `name` text (Arabic)
- `slug` text (latin, unique) — e.g. `sidr`, `orange-blossom`, `mountain`, `gift-sets`

### Products (`products`)

- `id` text PK (uuid)
- `name` text notNull (Arabic)
- `slug` text notNull unique (latin)
- `description` text notNull (Arabic)
- `price` integer notNull (EGP × 100, i.e. milliemes)
- `stock` integer notNull default 0
- `image` text notNull (URL)
- `categoryId` text FK → categories.id
- `featured` integer notNull default 0 (0/1)
- `createdAt` integer notNull (epoch ms)

### Orders (`orders`)

- `id` text PK (uuid)
- `number` text notNull unique (human-friendly ref, e.g. `HNY-XXXXXX`)
- `email` text notNull
- `name` text notNull
- `phone` text notNull
- `address` text notNull
- `city` text notNull
- `total` integer notNull (EGP × 100)
- `status` text notNull default `"paid"` (mock payment always succeeds)
- `userId` text nullable FK → better-auth users
- `createdAt` integer notNull (epoch ms)

### Order items (`order_items`)

- `id` text PK (uuid)
- `orderId` text FK → orders.id
- `productId` text FK → products.id
- `productName` text notNull (snapshot)
- `quantity` integer notNull
- `unitPrice` integer notNull (EGP × 100 snapshot)

### Seed

`db/seed.ts` inserts 4 categories and ~14 products, distributed across them, a
handful flagged `featured`. Products include e.g. عسل سدر، عسل برتقال، عسل جبلي/
مراعي، عسل مانوكا، أقراص شمع، عسل بالصنوبر، سلال هدايا. French/mountain/forest
varieties kept minimal; price range realistic for the local market (roughly 100–600 EGP).

## 4. Routes & Screens

All under the RTL root layout. Shared UI: sticky header (logo, search, cart drawer
trigger, account link), footer.

- `/` — hero section, category tiles, featured products grid.
- `/products` — full catalog grid with search (title, Arabic), category filter,
  sort (price asc/desc, newest).
- `/products/[slug]` — product detail: image, price, description, qty picker,
  add-to-cart, related products (same category).
- `/cart` — full cart page with qty controls, subtotal, "متابعة الدفع" CTA.
- Cart drawer — slide-over on every page, opens from header; duplicate of the
  cart page's controls.
- `/checkout` — form (email, name, phone, city, address) validated with zod via
  server action; order summary; mock card payment fields; confirm → creates order.
- `/checkout/success/[id]` — confirmation with order number and totals (labels the
  payment as simulated).
- `/login`, `/register`, `/account/orders` (reuse better-auth; RTL). Lightweight:
  login/register pages only on demand from header; `/account/orders` lists orders
  for the signed-in user.

## 5. Flow & Validation

1. Browse: SSR pages load products/categories from DB.
2. Add to cart: update localStorage state; POST to a server endpoint that sets an
   httpOnly signed cookie mirror of the cart (used for server-side price calc).
   Quantity capped at available stock; items removed when stock is empty.
3. Checkout (server action):
   - zod-validate customer fields + card fields (card not sent anywhere).
   - Re-fetch product prices from DB server-side and compute the total — never
     trust client totals.
   - Check stock, decrement stock for each line, insert order + items in a
     transaction.
   - Clear the cart (client + cookie).
   - Redirect to `/checkout/success/[id]`.
4. Failed validation or out-of-stock returns field errors; no partial writes.

## 6. Error Handling

- Out-of-stock at checkout → clear error message "نفدت الكمية" on the affected line.
- DB failures in the order transaction → rollback, generic server error surfaced to
  the form.
- Invalid slug/order id → 404 page.
- Image load failures → CSS `background-color` fallback so cards never break.

## 7. Testing

- **Unit (Vitest):** `formatEGP` currency/ar-EG formatting; cart reducers
  (add/remove/qty/clamp-to-stock); total calculation.
- **Component (Vitest browser):** product card renders price + name; mini cart
  add/remove; drawer open/close.
- **E2E (Playwright):** load home → `/products` → filter by category → open product →
  add to cart → cart shows qty → checkout happy path (valid input) → success page
  shows order number; validation error path shows field errors.
- E2E must run against a seeded test database.

## 8. Explicitly Out of Scope (YAGNI)

- Real payment integration (Stripe etc.), promo codes, wishlist, favorites, ratings,
  reviews, admin/CRUD UI for products, inventory import/export, multiple languages
  toggle, email/SMS notifications, smart/complex shipping-cost calculation (carrier
  rates, weight zones), order cancellation/refund flows.
- Shipping IS in scope but simplest possible form: a single flat-fee constant and a
  free-shipping threshold, hardcoded in one helper (e.g. 60 EGP, free over 600 EGP).
  Deterministic, not derived from location or weight.

## 9. Architecture Notes

- Keep server-only code under `src/lib/server/` (schema, db, seed, services).
- Pure helpers (currency, cart logic) in `src/lib/` so client and server can share them.
- One `formatEGP` helper module; one cart store module used by both drawer and /cart.
- Components: `Header`, `Footer`, `ProductCard`, `CategoryCard`, `CartDrawer`,
  `CartItemRow`, `Price`, `QuantityPicker`. Use Svelte 5 runes (`$state`, `$props`).
- Follow existing scaffold conventions (runes mode, strict TS, no `any`).

## 10. Acceptance Criteria

- `vp check` and `vp test` pass on a seeded DB.
- Arabic RTL UI renders correctly; EGP prices formatted with ar-EG.
- Full browse→add→checkout→success flow works for a guest.
- Stock decrements and order persists in DB after successful checkout.
- Logged-in user can see their past orders at `/account/orders`.
