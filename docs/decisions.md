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
is cleared fails on the empty-cart guard, so at most one order per cart.
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
(`honey_cart_v1`) built by `src/lib/server/cart-cookie.ts` using HMAC
signatures derived from a server secret (`BETTER_AUTH_SECRET`). The client
mirrors it in a Svelte 5 rune store (`src/lib/cart-store.svelte.ts`) and syncs
via `POST /api/cart`.

**Consequences:** Stateless, no cart table needed; tampering is detectable via
signature mismatch (cookie rejected). Secret access is centralized in
`getCartSecret`.
