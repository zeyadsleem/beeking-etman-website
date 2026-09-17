# AgDR-0002 — Retire the blend studio; sell ready-made blends as catalog products

**Status:** Executed (owner decision, 2026-09-17).
**Supersedes:** `docs/decisions.md` 2026-08-17 ("Blends studio: composed honey blends as one cart
line", "Blend cart lines rendered like regular product lines"); roadmap invariant 6 ("custom blends
are first-class", 2026-09-13 roadmap §1.3); the deferred Paymob spec constraint "the custom blend
feature must survive unchanged"; the backlog items that extend the studio (art pack, `/blends` SEO
fallback, multi-jar cart merge, owner-editable benefit texts).
**Related:** AgDR-0001 defers Paymob and moves v1 to COD + manual transfer. This record covers the
catalog half of the same pivot.

> In the context of a live blend studio that composes a blend client-side and expands it into
> base + additive order units, facing a shop that mixes blends itself and does not follow that
> workflow, I decided to retire the studio and sell ready-made blends as catalog products with
> ingredient descriptions, accepting the loss of the interactive feature, to achieve one product
> and stock model and an order path the shop actually runs.

## Context

- The studio lets a customer pick a base honey jar and additives, prices the mix client-side, and
  rides the cart as one line (`src/lib/blends.ts`, `src/lib/components/CartLineItem.svelte`).
  `createOrder` expands the line into base + additive units and the 0016 triggers decrement the
  component variants (`src/lib/server/orders.ts`, `src/lib/server/db/schema.ts`).
- The game layer is Phaser 3 on `/blends` (`src/lib/blend-lab/**`, `src/routes/blends/**`), with
  benefit texts stored in `store_blend_benefit` (migration 0013) and read through
  `src/lib/server/admin/blend-benefits.ts`.
- The owner sells prepared blends. He mixes them in the shop, not on the site. Customers care about
  what is inside the jar, not about composing it.
- Composition on the site forces recipe accounting at order time, splits stock across raw
  components, and asks the shop to honor a mix it does not track as a product.

## Options Considered

| Option                                             | Pros                                                                                                            | Cons                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Keep and extend the studio                         | Differentiator; existing work is preserved                                                                      | Contradicts the shop's workflow; recipe/component stock stays coupled; every commerce feature must preserve blend expansion |
| Keep `/blends` as a read-only showcase             | Preserves the page, its SEO, and its content                                                                    | Dead-end UX for ordering; the Phaser bundle and its maintenance stay; the product model stays split                         |
| Retire the studio; blends become products (chosen) | Matches the workflow; one product, variant, and stock model; removes code from cart, orders, pricing, and tests | Sunk work is removed; old `/blends` links need redirects; the owner must supply product data                                |

## Decision

Chosen: **retire the blend studio and sell ready-made blends as catalog products.**

- `/blends` and the Phaser lab are removed. A 301 redirect sends `/blends` to the blends category
  page. If the category does not exist at cutover, the redirect target is `/store` and moves to the
  category in a follow-up change.
- Each blend is a product with weight variants (for example 1 kg and 0.5 kg), its own price and jar
  stock, photos, and a description that lists the ingredients and their purpose.
- No recipe accounting and no raw-material deduction run at order time. Stock lives on the
  sellable variant, exactly as it does for honey jars.
- The cart and order models lose the blend item kind and the server-side expansion. Orders contain
  product and variant lines only.
- The per-variant stock path and the 0016 triggers stay unchanged.

## Consequences

- Removals: `src/routes/blends/**`, `src/lib/blend-lab/**`, `src/lib/blends.ts`, blend branches in
  `src/lib/server/orders.ts` and `src/lib/server/cart-cookie.ts`, blend rendering in
  `src/lib/components/CartLineItem.svelte`, navigation and homepage entries (`Header.svelte`,
  `Footer.svelte`, `src/routes/+page.svelte`), the sitemap `STATIC_PATHS` entry, `blends.*` i18n
  keys, and `tests/blends.e2e.ts`.
- `store_blend_benefit` loses every reader in v1 (`getAllBenefits`). The table stays until a
  drain-gated drop under the data-integrity convention. No v1 migration is required for the
  removal.
- SEO: the 301 preserves link equity. The sitemap drops `/blends` and lists the blends category in
  the same change.
- The owner supplies the ready-made blend data: names, ingredient lists, weights, prices, stock
  counts, and photos. Until then the category can ship with the honey catalog untouched.
- Admin product management covers blends without new UI. Ingredient text lives in the existing
  bilingual `description` fields.
- Documentation updates land in the removal PR: `docs/architecture.md` loses the Blend Lab section
  and the blend cart/order narrative.
- Cancelled backlog: blend art pack, `/blends` SEO fallback after I18N-5, multi-jar cart merge, and
  owner-editable benefit texts.

## Artifacts

- Implementation tickets: #12 (retire the studio and the redirect) and #13 (ready-made blend
  products) on `zeyadsleem/beeking-etman-website`; the M1 program board (`docs/todo.md`) carries
  the BLEND task series.
- Program updates: `docs/todo.md` M1 and backlog, roadmap §1.3 invariant 6, §4.2 M1 scope.
