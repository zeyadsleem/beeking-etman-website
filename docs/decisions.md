# Architecture Decision Records

Append-only, newest last. Each entry records a meaningful architectural choice.

## 2026-08-13: Harden checkout against double-submit and card echo

**Context:** Code review of the checkout flow (commit `845c211`) found two blockers:
(1) the submit button was not disabled during an in-flight request, so rapid
double-clicks could create duplicate orders; (2) the re-rendered failure page
echoed the submitted card number, expiry, and CVV back into the DOM via form
`value` round-tripping. Follow-ups also asked to fix the success page cache
headers, order-by determinism, a dead import, and a type cast.

**Decision:**

- Disable the submit button while pending (`submitting` state) with
  `use:enhance`; the enhance callback calls `update()` with no arguments so
  SvelteKit's default behavior (including redirect navigation on action
  `redirect()`) is preserved. A callback passing `result` would break
  redirects in SvelteKit 2.70.2 because action redirects serialize as
  `result.type === "redirect"`.
- Build the re-rendered `values` from a `shippingValues(form)` helper that
  filters out the `CARD_FIELDS` set (`cardNumber`, `cardExpiry`, `cardCvc`).
  All three failure returns (validation/cart-empty, and the out-of-stock 409)
  are annotated `satisfies CheckoutFail` so the client can read
  `form?.errors?.[name]` without a cast.
- Set `cache-control: private, no-store` on the success page via
  `setHeaders` (page loads cannot return `headers`; the whole return is
  devalued into `data`), and order order items by `id` for deterministic
  rendering.
- Extract `getCartSecret(env)` into `src/lib/server/cart-cookie.ts` and
  reuse it from the API endpoint.

**Consequences:** Card data never reaches the DOM on failure. Client-side
double-submit is prevented; a server-side second submit after the cart cookie
is cleared fails on the empty-cart guard, so sequential submits cannot create
duplicate orders (concurrent two-tab submits still can — tracked in
`docs/todo.md`).
Verified by smoke tests: one order on rapid double-click, no card values in
the 400 response, 303 redirect + cookie clear + no-store header on success.

## 2026-08-12: Mock payment via transactional order service

**Context:** The storefront has no real payment provider. Checkout needed a
realistic but mock payment step that either succeeds or fails deterministically
and only persists an order on success.

**Decision:** A server-only `orderService` (`src/lib/server/orders.ts`) runs in
a Drizzle transaction: re-reads stock, decrements quantities, inserts the order
and its items. Payment is mocked (`order.status = "paid"` on success). Cart
cookie consumption and stock/order writes are atomic; a failed payment leaves
the cart intact.

**Consequences:** One order at most per cart, stock is only decremented when an
order is actually persisted. Enables the checkout hardening ADR above.

## 2026-08-12: Stateless signed cart cookie

**Context:** The cart must survive reloads and be readable in server load
functions and API endpoints without a server-side cart table.

**Decision:** The cart is a signed, HttpOnly, SameSite=Lax cookie
(`honey_cart`) built by `src/lib/server/cart-cookie.ts` using HMAC
signatures derived from a server secret (`BETTER_AUTH_SECRET`). The client
mirrors it in a Svelte 5 rune store (`src/lib/cart-store.svelte.ts`) and syncs
via `POST /api/cart`.

**Consequences:** Stateless, no cart table needed; tampering is detectable via
signature mismatch (cookie rejected). Secret access is centralized in
`getCartSecret`.

## 2026-08-13: Arabic RTL storefront

**Context:** The storefront targets Egyptian honey buyers; all product copy and
UI text are Arabic and checkout validates Egyptian phone numbers.

**Decision:** The app is a full Arabic RTL storefront: `dir="rtl"` on `<html>`,
Arabic strings embedded verbatim (no i18n layer), Cairo variable font
(`@fontsource-variable/cairo`), `ar-EG` locale for dates and currency, and a
honey-toned Tailwind palette (honey/cream/stone) defined in
`src/routes/layout.css`.

**Consequences:** Layout uses RTL-native (logical) properties; e2e tests select
by Arabic text. Adding a second language later requires introducing an i18n
layer.

## 2026-08-13: EGP prices stored as integer qirsh

**Context:** Prices are in Egyptian pounds; floats invite rounding and
comparison bugs.

**Decision:** All money is stored as integer qirsh (1/100 EGP) in
`store_product.price`, `store_order.total`, and `store_order_item.unit_price`.
`formatEGP` (`src/lib/currency.ts`) divides by 100 and formats with
`Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" })`. Seed data
uses qirsh literals (e.g. `380_00` = EGP 380).

**Consequences:** Exact integer arithmetic; callers must keep amounts in qirsh
and divide only at format time.

## 2026-08-13: Guest-first checkout with optional accounts

**Context:** First-time buyers should not need an account to place an order.

**Decision:** Checkout is guest-first: `store_order.user_id` is nullable and the
checkout action attaches `locals.user?.id` when a session exists. Better Auth
(password provider, drizzle adapter, `sveltekitCookies` plugin) powers optional
accounts: `/login`, `/register`, and `/account/orders` (order history gated by
ownership).

**Consequences:** Guests always complete checkout; accounts add order history on
top without blocking purchase.

## 2026-08-13: Flat shipping fee with free-shipping threshold

**Context:** Small store; shipping needs to be simple and predictable.

**Decision:** Flat shipping fee of EGP 60 (`SHIPPING_COST = 60_00`), free when
the subtotal is ≥ EGP 600 (`FREE_SHIPPING_THRESHOLD = 600_00`,
`src/lib/cart.ts`); an empty cart pays nothing.

**Consequences:** Totals are easy to reason about; no zone/weight logic.

## 2026-08-13: Server-side cart sanitization at the API boundary

**Context:** `POST /api/cart` accepts unsigned JSON from the client — only the
stored cookie is HMAC-signed.

**Decision:** Every external cart input is validated by `sanitizeCartLines`
(`src/lib/server/cart-cookie.ts`): entries must have a string `productId` and a
finite positive quantity, which is floored to an integer; invalid entries are
dropped. The signed-cookie path re-verifies the HMAC and re-sanitizes on read.

**Consequences:** Malformed client payloads cannot corrupt the cart; tampered
cookies are rejected by signature mismatch.

## 2026-08-14: Artisanal bohemian UI redesign

**Context:** The storefront UI (plain Tailwind, stock photos) did not match the
"بيت العسل" artisanal brand.

**Decision:** Redesigned the whole UI as a handcrafted "House of Honey" system
in `src/routes/layout.css` and all components/pages: Aref Ruqaa for the
wordmark and Amiri for headlines (both `@fontsource` Arabic subsets, dev
dependencies) on the existing Cairo body font; a paper/parchment/cocoa/honey/
olive/clay palette; custom classes `.btn-honey`, `.btn-dark`, `.btn-outline`,
`.field`, `.chip`, `.arch-frame(-lg)`, `.rule-flourish`, `.honeycomb-bg`,
`.dot-bg`, `.grain-bg`; `--texture-*` custom properties in `:root`; and
`@keyframes fade-up`/`float-y` exposed as Tailwind v4 `@utility` classes so
`motion-safe:` variants work (radius tokens were hardcoded because `@theme
inline` does not emit custom properties to `:root`).

**Consequences:** A cohesive artisanal aesthetic; product imagery is now
first-party. All e2e selectors, `data-testid`s, and unit-test expectations were
preserved so the suite still passes unchanged.

## 2026-08-14: Authentic Egyptian honey catalog with bespoke SVG art

**Context:** The seeded catalog mixed non-Egyptian products (مانوكا، صنوبر) and
rotated only three generic stock photos, so the store did not look like an
Egyptian honey shop.

**Decision:** Replaced the catalog with 14 authentic Egyptian honeys across 4
categories (سدر، برسيم، موالح، أعشاب جبلية وخلطات) — e.g. عسل سدر سيناء، برسيم
مصري، زهر البرتقال، غذاء ملكي، قطن صعيدي، قرص شمع، بوكس هدايا — at realistic EGP
qirsh prices. Product art is a set of hand-drawn SVG illustrations
(`static/images/honey/*.svg`): a jar per variety in its true honey tone, a
honeycomb slab for قرص الشمع, and a gift box. The seed now prunes products and
categories whose slugs are absent from the seed (it previously only upserted,
so removed items lingered).

**Consequences:** Every image clearly reads as honey and loads from first-party
static assets (no remote 404 risk). Seed runs are idempotent. The `sidr-natural`
product (عسل سدر طبيعي) is preserved, so the e2e suite is unchanged.

## 2026-08-14: Variant product model (size/package per honey type)

**Context:** The real Egyptian catalog sells the same honey in many sizes and
packages (500 جم، 1 ك، زجاج، بلاستيك، Vib، اسكويز…). Treating each as a separate
`store_product` duplicated names and blurry search; the user's 43-line price list
is really ~21 honey types × variant lines.

**Decision:** `store_product` becomes a honey _type_ and a new
`store_product_variant` table (`id, productId, name, price, stock, image,
sortOrder`) carries the sellable lines. Cart/checkout/order are variant-keyed:
`CartLine { variantId, quantity }`, `CartItem` carries `variantName`, and
`store_order_item.variant_name` records the purchased line (migration
`drizzle/0001_messy_vargas.sql`). Store queries return `ProductSummary` with
`variants` + `minPrice`; `resolveCartItems(db, lines)` joins variant→product for
checkout/orders. Seed maps each of the user's 43 lines to exactly one variant.

**Consequences:** One product page per honey with a size selector; cards show
min-price and quick-add the cheapest in-stock variant; order history shows the
exact line bought. Stock is decremented per variant.

## 2026-08-14: Royal Kingdom rebrand with real honey photography

**Context:** The user named the store مملكة النحل (عتمان الأصلي) and asked to
compete with big Egyptian honey sites using a luxury dark+gold aesthetic and real
photography instead of the hand-drawn SVG art.

**Decision:** Rebranded everywhere (favicon, header/footer wordmarks, titles) to
مملكة النحل / عتمان الأصلي with a gold-on-ink Royal Kingdom theme over parchment:
new `ink-*`/`gold-*` Tailwind tokens, `.btn-gold`/`.btn-ink` buttons, royal
textures, `::view-transition-*` styles, and `@utility` animations (`animate-drip`,
`animate-shine`, `animate-marquee`) plus `startViewTransition` on client
navigation. Home was rebuilt with a dark royal hero (gold drip), count-up stats,
a marquee ticker, category storytelling banners, benefit rails, and staggered
scroll reveals (`src/lib/actions/reveal.svelte.ts`, `countup.svelte.ts`). The
catalog now uses real honey photographs from Unsplash CDN, each verified with
`curl -sI` to return `200 image/*` before being committed (three of the planned
URLs 404'd and were replaced after `websearch` + re-verification).

**Consequences:** A distinctive royal brand that still keeps every Arabic e2e
hook; remote images are verified but remain third-party (a future first-party
CDN migration is tracked in `docs/todo.md`).
