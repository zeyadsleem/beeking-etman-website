# Design: مملكة النحل — Royal Honey Kingdom (variant catalog + full UX/UI overhaul)

Date: 2026-08-14
Status: Draft (awaiting user review)

## 1. Goal

Transform the SvelteKit honey storefront into **مملكة النحل / عتمان الأصلي** — a
competitive Egyptian honey e-commerce site matching the region's best shops
(Rashof minimalism + yellow/black bee identity, Al-Jibal luxury dark+gold,
Reef rustic-nature). This requires:

- A **variant product model** for the real 43-line catalog (sizes/packaging).
- Real honey stock photography for every product line.
- A full UX/UI overhaul: Royal Kingdom theme (deep royal charcoal + gold honey
  accents over warm parchment), Svelte 5 magic (view transitions, staggered
  reveals, marquee, count-ups, variant crossfade), health-benefit sections.
- Rebranding everywhere from "بيت العسل" to "مملكة النحل" (primary) and
  "عتمان الأصلي" (secondary tagline).

## 2. Brand

- Primary name: **مملكة النحل** — appears in the wordmark, page titles, footer,
  and checkouts.
- Secondary tagline: **عتمان الأصلي** — subtitle under the wordmark (header,
  footer, checkout).
- Wordmark font: Aref Ruqaa (existing). Headlines: Amiri (existing). Body: Cairo
  Variable (existing). No new fonts.
- Favicon replaced with a custom hexagon-bee SVG (gold on black).
- `app.html` title → "مملكة النحل | عتمان الأصلي", Arabic RTL maintained.

## 3. Data model — variant system (schema migration)

### New table `store_product_variant`

```ts
productVariant = sqliteTable("store_product_variant", {
  id: text("id").primaryKey().$defaultFn(crypto.randomUUID),
  productId: text("product_id")
    .notNull()
    .references(() => product.id),
  name: text("name").notNull(), // e.g. "1 ك زجاج", "500 جرام"
  price: integer("price").notNull(), // qirsh
  stock: integer("stock").notNull().default(0),
  image: text("image").notNull(), // real photo URL for this line
  sortOrder: integer("sort_order").notNull().default(0),
});
```

`store_product` becomes the honey **type**: keeps `slug/name/description/
categoryId/featured/image` (the `image` is the type's hero photo). Product
price/stock move to variants; the product table keeps no price/stock.

### Catalog → parent products (21) covering all 43 lines

Categories (6):

1. **عسل الزهور** — عسل برسيم (7 var: 1ك زجاج/بلاستيك/اسكويز/Vib، 500 زجاج/
   بلاستيك، نص Vib)، عسل موالح (4 var: 150جم، 1ك عادي، 1ك Vib، نص Vib)،
   عسل بردقوش (2 var: 1ك زجاج، 500جم).
2. **عسل السدر** — عسل سدر مصري (2 var: 1 ك، 500جم).
3. **خلطات وعسل مدعم** — عسل حبة البركة (2 var: 1ك، نص)، عسل خلطة سداسي
   (1 var: بلاستيك)، عسل مكسرات (6 var: 800جم، اكستر 1ك، 370، 370 دائري،
   بيضاوي، كان 400جم).
4. **شمع العسل** — شمع بالعسل (4 var: 250/500جم × برسيم/موالح)، برواز شمع
   بالعسل (2 var: برسيم، موالح).
5. **مكملات النحل** — غذاء ملكات بلدي (5جم)، بروبليس (علبة)، جينسنج (علبة)،
   طلع نخل (علبة)، حبوب لقاح (علبة + 125جم)، ملاعق عسل (علبة).
6. **مكسرات** — بندق (100جم)، فستق (100جم)، لوز (100جم)، كاجو (100جم)،
   مكسرات مشكل (100جم)، مكسرات اكسترا (500 كان).

Every user-listed line maps to exactly one variant. Unambiguous naming: variants
of عسل برسيم use exact labels from the list ("1 ك زجاج", "نص Vib", …); for
شمع بالعسل the variant name includes the type ("250 جرام برسيم").

### Migration & seed

- New Drizzle migration adds `store_product_variant` (no destructive changes).
- `scripts/seed.ts` rebuilt: wipe `orderItem`/`order`, delete all
  `store_product_variant`, prune products/categories not in the seed, then
  upsert categories → products → variants. Idempotent on repeated runs.
- Prices are **real Egyptian market prices in qirsh**, researched online during
  implementation (seed the actual figures researched; e.g. سدر 1ك ~450–600ج,
  برسيم 500غ ~90–140ج). Free-shipping threshold stays EGP 600; shipping EGP 60.

## 4. Cart & checkout flow (variant-keyed)

- `honey_cart` cookie lines become `{ variantId, quantity }` (HMAC-signed as
  today). `sanitizeCartLines` validates `variantId` + positive integer quantity.
- `src/lib/cart.ts` resolves lines by joining variant → product for
  `name`, `variantName`, `unitPrice`, `image`, and computes totals.
- Client store `cart-store.svelte.ts` + `POST /api/cart` sync variant lines.
- Checkout `orderService`: re-reads variant stock, decrements it, inserts the
  order; `order_item` stores `productName` + `variantName` + `unitPrice`.
- Product detail page: new **variant selector** (pill buttons per variant) that
  updates price, stock badge, and image (crossfade). "أضف إلى السلة" posts the
  selected `variantId`.

## 5. Real product images

- Every variant line has a **real honey photograph** (curated stock
  photography: jars, comb, frames, nuts-in-honey, royal jelly, pollen,
  propolis, nuts). Photo per packaging type where distinct (زجاج vs بلاستيك vs
  اسكويز vs Vib); otherwise the type's best real photo.
- Rare items (بروبليس، جينسنج، غذاء ملكات، طلع نخل) use the closest real
  honey/beekeeping photo available; never a non-honey placeholder.
- Image URLs from reliable CDN sources (Unsplash-style), verified reachable.

## 6. Visual design — "Royal Kingdom"

- **Dark luxury surfaces**: royal charcoal/near-black (`--ink`), gold honey
  accents (`--gold`), on hero, footer, category banners, checkout accent.
- **Warm parchment paper** (`--paper`) surfaces for product grids, cart,
  account, auth pages — honey-toned palette retained.
- Textures: grain, dot grid, honeycomb pattern, gold drip motifs, floating
  hexagons, bee accent iconography.
- Buttons: `.btn-gold` (dark-gold fill), `.btn-ink` (black), `.btn-outline`
  (gold border). Arch frames retained and used on imagery.
- Typography: Aref Ruqaa wordmark (gold on dark), Amiri headlines, Cairo body;
  section overlines in gold caps with flourish rules.
- All existing CSS utility classes reworked in `src/routes/layout.css`;
  Tailwind v4 `@utility` used for animations.

## 7. UX workflow + Svelte magic

- **View transitions**: `startViewTransition` on navigation (SvelteKit
  `onNavigate`) with per-page crossfade/slide; reduced-motion respected.
- **Hero**: animated gold drip + floating hexagons (CSS/SVG), staggered
  fade-up headline, count-up stats (أصناف/عملاء/محافظات).
- **Marquee** strip: "عسل طبيعي 100% • شحن لجميع المحافظات • دفع عند
  الاستلام" scrolling ticker.
- **Scroll reveals**: IntersectionObserver custom action, staggered product
  card fade-up with per-card delay.
- **Product cards**: hover honey-fill sweep, lift + gold ring, "الأكثر مبيعاً"
  badge.
- **Variant selector**: image + price crossfade on selection; out-of-stock
  variants disabled.
- **Cart drawer**: slide/scale-in, item enter transitions keyed by variantId.
- **Health-benefit sections** on home: للمناعة والطاقة / للعائلة والإفطار /
  سناكات صحية — grouped product rails.
- **Category storytelling**: each category banner with a short Arabic story
  line (جني العسل، فرازات سيناء، إلخ).

## 8. Files touched

- `src/lib/server/db/schema.ts` (+variant table), new migration file.
- `scripts/seed.ts` (catalog, prices, images).
- `src/lib/cart.ts`, `src/lib/server/cart-cookie.ts`,
  `src/lib/cart-store.svelte.ts`, `src/routes/api/cart/+server.ts`.
- `src/lib/server/orders.ts` (order items w/ variantName).
- UI: `+layout.svelte` (+viewport/app.html meta), `layout.css`, Header,
  Footer, ProductCard, CategoryCard, CartDrawer, QuantityPicker, home,
  products, product detail, cart, checkout, success, login, register,
  account/orders.
- Favicon, `static/images/honey/*` (replaced with real photos or kept as
  fallback where appropriate).
- Tests: `ProductCard.svelte.spec.ts`, `src/routes/store.e2e.ts` updated for
  variant flow (e.g. select عسل سدر 500غ → add → checkout), cart tests.

## 9. Testing

- `pnpm check` (0 errors), `pnpm test:unit -- --run`, `vp build`,
  `pnpm test:e2e` (order-path green with variant selection). Reduced-motion +
  a11y (labels, focus, aria) preserved; RTL and Arabic text intact.

## 10. Out of scope

- Real payment gateways (المدى/ميزة/Apple Pay) — mocked payment retained.
- Multi-language i18n; admin/stock management.
- Changing shipping rules beyond the existing threshold.
