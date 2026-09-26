---
name: Beeking Etman
description: Two scoped color worlds on one token set — a light paper default and a dark olive/gold storefront palette.
theme:
  default: "light paper (:root, @theme) — also governs /admin"
  storefront: "dark olive + gold (html:has(.storefront-shell)) — customer-facing routes only"
  scopingClass: "storefront-shell, applied in src/routes/+layout.svelte on the non-admin branch only"
  themeBlockMode: "not inline — utilities must resolve through var() so one set of token names can be re-pointed per scope"
colors:
  light:
    paper: "#faf9f6"
    paper-deep: "#f3f0e9"
    parchment: "#ffffff"
    cream: "#f6f1e6"
    cream-deep: "#efe7d6"
    cocoa-900: "#2a2620"
    cocoa-500: "#7d7566"
    cocoa-200: "#dcd8d0"
    honey-700: "#b45309"
    honey-600: "#d97706"
    honey-200: "#fde68a"
    clay-600: "#b5451f"
    olive-800: "#413c1b"
    ink-950: "#14120f"
  storefront:
    paper: "#171a11"
    paper-deep: "#101208"
    parchment: "#1f2318"
    cocoa-900: "#ede9da"
    cocoa-200: "#32372a"
    honey-600: "#d3b87b"
    honey-700: "#e2cd9d"
    honey-400: "#9a8148"
    clay-600: "#e08a63"
    olive-500: "#7e894a"
    ink-950: "#101208"
  themeIndependent:
    sand-50: "#f7f4ea"
    sand-100: "#efe9db"
    sand-200: "#e0d8c4"
    sand-300: "#c9bfa6"
    sand-400: "#a49a80"
typography:
  display-ar:
    fontFamily: '"Amiri", "Cairo Variable", serif'
    fontWeight: 700
  display-en:
    fontFamily: '"Newsreader Variable", "Manrope Variable", serif'
    fontWeight: 500
  body-ar:
    fontFamily: '"Cairo Variable", ui-sans-serif, system-ui, "Segoe UI", sans-serif'
  body-en:
    fontFamily: '"Manrope Variable", "Cairo Variable", ui-sans-serif, system-ui, sans-serif'
  studio-word:
    fontFamily: '"Manrope Variable", "Cairo Variable", ui-sans-serif, system-ui, sans-serif'
    fontSize: "clamp(8rem, 24vw, 23rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
rounded:
  studio-action: "3px"
  skeleton-text: "0.25rem"
  skeleton-heading: "0.375rem"
  inset-plate: "0.5rem"
  field: "0.75rem"
  panel: "1rem"
  feature: "1.5rem"
  pill: "9999px"
spacing:
  small: "16px"
  medium: "24px"
  large: "32px"
  feature: "48px"
  section: "72px"
components:
  studio-action:
    backgroundColor: "{colors.storefront.honey-600}"
    textColor: "{colors.storefront.ink-950}"
    rounded: "{rounded.studio-action}"
    padding: "0.8rem 1.4rem"
  button-primary:
    lightBackgroundColor: "{colors.light.ink-950}"
    lightTextColor: "{colors.light.parchment}"
    storefrontBackgroundColor: "{colors.storefront.honey-600}"
    storefrontTextColor: "{colors.storefront.ink-950}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-outline:
    lightTextColor: "{colors.light.cocoa-900}"
    storefrontBackgroundColor: "color-mix(in oklab, {colors.storefront.cocoa-200} 55%, transparent)"
    rounded: "{rounded.pill}"
    padding: "10px 24px"
  button-ghost:
    textColor: "{colors.light.honey-700}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  field:
    backgroundColor: "{colors.light.parchment}"
    textColor: "{colors.light.cocoa-900}"
    rounded: "{rounded.field}"
    padding: "10px 16px"
  chip:
    backgroundColor: "{colors.light.parchment}"
    textColor: "{colors.light.cocoa-700}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  photo-mat:
    backgroundColor: "{colors.themeIndependent.sand-100}"
    note: "Identical in both themes; the storefront's only light surface."
  paper-panel:
    backgroundColor: "{colors.light.parchment}"
    rounded: "{rounded.panel}"
    note: "Defined in layout.css, not currently referenced in markup."
---

# Design System: Beeking Etman

## Overview

The system has **two color worlds on one token set**.

- **Light paper** is the `:root` default, declared in the `@theme` block in
  `src/routes/layout.css`. It is not a legacy leftover: it still governs every
  `/admin` route and every component that renders outside the customer-facing
  branch.
- **Dark olive + gold** is the storefront's palette. The homepage studio hero's
  world was promoted from a homepage-local treatment to the whole
  customer-facing palette. It is declared in a second block,
  `html:has(.storefront-shell)`, which re-points the _same_ token names rather
  than introducing a parallel set.

`cocoa-50` becomes the storefront's darkest ground and `cocoa-900` becomes ivory
body text, so every component flips colour without a single markup change.

### Scoping

`src/routes/+layout.svelte` puts `storefront-shell` on the wrapper element of the
**customer-facing branch only** — the `{:else}` arm that renders the skip link,
header, `<main class="storefront">` and footer. The `{#if isAdminRoute}` arm
renders a bare `min-h-screen` wrapper with no `storefront-shell`, and
`isAdminRoute` is true only for `/admin` and `/admin/*`. Admin therefore never
matches the `:has()` selector. `src/routes/layout.css` is the source of truth for
both worlds.

### Why the theme block is not `inline`

The `@theme` block is **deliberately not** `@theme inline`, and this is
load-bearing. Without `inline`, every generated utility references its token by
name — `bg-parchment` compiles to `background-color: var(--color-parchment)`,
not to a baked-in `#ffffff`. Because the utilities resolve through `var()` at
use time, a single set of token names can be re-pointed per scope by the
`html:has(.storefront-shell)` block. With `@theme inline` the hex values would be
inlined into the utility declarations, the storefront block would have nothing to
override, and a second parallel token vocabulary would be required.

`color-scheme: dark` is set inside the storefront block, so native form controls,
scrollbars and the UA's own surfaces follow the comb.

**Key characteristics:**

- One token vocabulary, two scoped values per token, one sand family that never changes.
- Dark olive ground, honey-gold for every action, active state, focus ring and underline.
- Ivory type; muted steps are tinted in the same yellow-green family, never neutral gray.
- Corners stay 12–16px on commerce surfaces; buttons and chips are pills.
- Real catalog photography on warm sand plates; one procedural Three.js jar in the hero.
- Arabic RTL and English LTR from the same components.

## Colors

### Light world — `:root` / `@theme` (default, and `/admin`)

```yaml
surfaces:
  paper: "#faf9f6" # body background
  paper-deep: "#f3f0e9"
  parchment: "#ffffff" # cards, fields, dialogs
  cream: "#f6f1e6"
  cream-deep: "#efe7d6"

cocoa: # neutrals, warm
  50: "#faf9f7"
  100: "#f0eeea"
  200: "#dcd8d0" # borders, inputs
  300: "#bfb9ad"
  400: "#9c9486"
  500: "#7d7566" # muted foreground
  600: "#625b4e" # placeholder text
  700: "#4d473d"
  800: "#3a352d"
  900: "#2a2620" # body text
  950: "#1c1914"

honey: # brand gold, light -> dark
  50: "#fffbeb"
  100: "#fef3c7"
  200: "#fde68a"
  300: "#fcd34d"
  400: "#fbbf24"
  500: "#f59e0b"
  600: "#d97706" # ring, focus
  700: "#b45309" # eyebrows, ghost buttons
  800: "#92400e"
  900: "#78350f"
  950: "#451a03"

clay: # destructive
  50: "#fdf3ef"
  100: "#fbe3da"
  200: "#f6c5b5"
  300: "#ee9d83"
  400: "#e27251"
  500: "#d4572f"
  600: "#b5451f"
  700: "#96371c"
  800: "#7a2f1d"
  900: "#64291b"

olive: # only stops the light world ships
  50: "#f7f7ed"
  100: "#edebd1"
  200: "#dad6a6"
  300: "#c2bb74"
  400: "#aaa04c"
  500: "#8d8433"
  600: "#6f6727"
  700: "#554e20"
  800: "#413c1b"
  900: "#33301a"

ink: # three stops only
  800: "#26231e"
  900: "#1d1a16"
  950: "#14120f" # primary button ground (light)

amber: # wordmark gradient only, never re-pointed
  300: "#fcd34d"
  400: "#f5b72c"
  500: "#e89b13"
  600: "#c97a06"
  700: "#9c5b04"
```

### Storefront world — `html:has(.storefront-shell)`

Same token names, dark-olive values. Amber and sand are not re-pointed and are
absent from this block.

```yaml
color-scheme: dark

surfaces:
  paper: "#171a11" # storefront page ground
  paper-deep: "#101208"
  parchment: "#1f2318" # cards, fields, dialogs — a raised olive, not white

cocoa: # the scale is inverted: 50 is the darkest step
  50: "#1c1f15"
  100: "#262a1e"
  200: "#32372a" # borders, inputs
  300: "#434936"
  400: "#616750"
  500: "#8a8776" # muted foreground
  600: "#a7a28c" # placeholder text
  700: "#c5bfa8"
  800: "#ded7c1"
  900: "#ede9da" # body text — the ivory
  950: "#f7f4ea"

honey:
  50: "#2b2513"
  100: "#332c16"
  200: "#453a1d"
  300: "#6d5c31"
  400: "#9a8148" # the ETMAN wordmark
  500: "#c2a463"
  600: "#d3b87b" # every action, focus ring, underline
  700: "#e2cd9d" # eyebrows, ghost buttons
  800: "#efe3c6"
  900: "#f6efdd"
  950: "#fbf8ee"

clay:
  50: "#2b1710"
  100: "#3a1e15"
  200: "#5c2a1c"
  300: "#8f3f27"
  400: "#bd5636"
  500: "#d76a44"
  600: "#e08a63" # destructive ground; now a light terracotta
  700: "#eda98a"
  800: "#f3c6b3"
  900: "#f8ded3"

olive: # the ground family, darkest first
  50: "#171a11"
  100: "#1f2317"
  200: "#2b3021"
  300: "#3d442c"
  400: "#5c6539"
  500: "#7e894a"
  600: "#a3b062"
  700: "#c2cd8c"
  800: "#d8e0ae"
  900: "#eaf0cd"

ink:
  800: "#20231a"
  900: "#171a11"
  950: "#101208" # text on gold; the hero stage background

cream:
  cream: "#22261b"
  cream-deep: "#2a2f22"
```

### Sand — the theme-independent photography family

```yaml
sand: # identical in both worlds; not re-pointed
  50: "#f7f4ea"
  100: "#efe9db" # .photo-mat background
  200: "#e0d8c4"
  300: "#c9bfa6"
  400: "#a49a80"
```

`.photo-mat` (`@apply bg-sand-100`) is the storefront's **only** light surface,
and it is the same plate in both themes by design: the catalog photography was
shot on a warm sand studio ground, so a product photo must sit on that same
ground whether the page behind it is light or dark. A consistent plate is what
makes honey colour comparable across the catalog.

Product shots carry their own light studio background that no blend mode can
remove on a dark surface, so every photograph is `mix-blend-multiply`-ed into
the plate (`ProductCard`, `ProductImageGallery` main image and thumbnails,
homepage category tiles, home equipment photos).

A product with **no** photo does not get a bright empty plate. `ProductArt` gives
it a dark well instead: `bg-cocoa-100` with a `border-dashed border-cocoa-300`
edge, a `text-cocoa-500` label and an `ImageOff` glyph — a raised olive that
re-points with the theme.

Category tiles are the one photographic surface that does **not** blend: the tile
frame is `bg-cocoa-100` with a `border-cocoa-200`, and a smaller inset plate
(`border-radius: 0.5rem`) holds the image. The blend was measured to cost the
compositor enough on a software rasteriser to delay the first navigation, so
that image sits on the plate without a blend.

### Semantic (shadcn) mapping

Declared once in the `@theme` block, in terms of `var(--color-*)`, so each token
resolves to whichever world's value is in scope.

```yaml
background: var(--color-paper)
foreground: var(--color-cocoa-900)
card: var(--color-parchment)
card-foreground: var(--color-cocoa-900)
popover: var(--color-parchment)
popover-foreground: var(--color-cocoa-900)
primary: var(--color-ink-950)
primary-foreground: var(--color-parchment)
secondary: var(--color-cocoa-100)
secondary-foreground: var(--color-cocoa-900)
muted: var(--color-cocoa-100)
muted-foreground: var(--color-cocoa-500)
accent: var(--color-honey-50)
accent-foreground: var(--color-honey-800)
destructive: var(--color-clay-600)
destructive-foreground: var(--color-parchment)
border: var(--color-cocoa-200)
input: var(--color-cocoa-200)
ring: var(--color-honey-600)
radius: 1rem # container radius, same soft 2xl as the panels
```

### Dark-scope component overrides

Controls that cannot be expressed as a token re-point, because their base rule
hard-codes a value that is only correct on one world. Each is prefixed with
`.storefront-shell` and therefore has no effect on admin.

| Selector                       | Override                                                                                  | Why                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.btn-primary`                 | `background-color: var(--color-honey-600); color: var(--color-ink-950); box-shadow: none` | The base rule is ink-on-parchment. On the comb that reads as a black hole; the primary action becomes gold-on-ink and drops its shadow.                            |
| `.btn-primary:hover`           | `background-color: var(--color-honey-700); box-shadow: var(--shadow-warm)`                | The base hover relies on a lift that the comb cannot show, so the near-black storefront shadow is restored here.                                                   |
| `:is(.badge-out, .badge-warn)` | `color: var(--color-ink-950)`                                                             | Both badges are `text-white`. On the comb their grounds re-point to light clay and light gold, so the label has to flip to ink.                                    |
| `.btn-outline`                 | `background-color: color-mix(in oklab, var(--color-cocoa-200) 55%, transparent)`          | The base uses `bg-parchment/40`; on the storefront that resolves to a 40%-alpha dark olive and the button reads as a hole. The mix paints the border step instead. |
| `.btn-outline:hover`           | `background-color: color-mix(in oklab, var(--color-cocoa-300) 70%, transparent)`          | Same reason, one step up.                                                                                                                                          |
| `::selection`                  | `background: var(--color-honey-600); color: var(--color-ink-950)`                         | The base uses honey-200 on cocoa-950, both of which re-point to near-dark values in the storefront and would be invisible.                                         |
| `.brand-logo`                  | `filter: hue-rotate(-10deg) saturate(1.15) brightness(1.1)`                               | The raster logo keeps its amber ink; it only needs to lift off the comb. Base is `brightness(1.02)`.                                                               |
| `.brand-seal`                  | `filter: sepia(0.12) saturate(0.88) hue-rotate(-6deg) brightness(1.15)`                   | Same lift for the wax seal's brown darks. Base is `brightness(1.04)`.                                                                                              |
| `html:has(.storefront-shell)`  | `scrollbar-color: var(--color-cocoa-300) var(--color-paper); scrollbar-width: thin`       | The generic `[role="region"]` scrollbar rule already reads through `var()`; the storefront sets the same pairing on the root.                                      |

Focus is _not_ overridden. `honey-600` re-points on its own, so the 2px
`honey-600` outline at 2px offset on `a`, `button`, `select`, `summary` and
`[tabindex]:not([tabindex="-1"])` is gold on the comb and amber on paper with no
second rule.

## Typography

Four faces, two roles each, selected by `dir`/language rather than by a
`:lang()` cascade in markup:

```yaml
font-sans: '"Cairo Variable", ui-sans-serif, system-ui, "Segoe UI", sans-serif'
font-sans-en: '"Manrope Variable", "Cairo Variable", ui-sans-serif, system-ui, sans-serif'
font-display: '"Amiri", "Cairo Variable", serif'
font-display-en: '"Newsreader Variable", "Manrope Variable", serif'
```

All four are self-hosted variable woff2 (Amiri ships static 400/700), preloaded
from `app.html` so the browser fetches them before CSS parsing discovers the
`@font-face` rules — no font-swap layout shift.

`body` is `bg-paper font-sans text-cocoa-900 antialiased`; `html:lang(en) body`
switches to `font-sans-en` because Cairo's secondary Latin glyphs are weaker than
Manrope's for body copy.

| Class             | Arabic                                                            | English                                                 | Use                                   |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `.headline`       | Amiri 700, `-0.01em`                                              | Newsreader 500, `-0.015em`, `font-optical-sizing: auto` | Large headings only                   |
| `.card-title`     | Cairo 700, `-0.01em`                                              | Manrope 600, `-0.01em`                                  | Product and card titles               |
| `.eyebrow`        | `text-xs font-bold uppercase text-honey-700`, `tracking-[0.18em]` | same                                                    | Section eyebrows                      |
| `.brand-wordmark` | Amiri 700                                                         | Newsreader 600, `0.01em`                                | Defined, not currently used in markup |

The display faces are reserved for large headlines. At card sizes Amiri's
letterforms get muddy, so `.card-title` uses the sans faces. Arabic drops the
eyebrow's letter-spacing entirely (`html[lang="ar"] .eyebrow { letter-spacing: 0 }`).

Studio wordmark (`.cinema-word` in `Hero.svelte`): `font-sans-en`,
`clamp(8rem, 24vw, 23rem)`, weight 800, `letter-spacing: -0.04em`, line-height 1,
`color: var(--color-honey-400)`. At 650px and below it is `26vw`.

Studio chapter headings: `clamp(1.5rem, 2.4vw, 2.5rem)`, weight 600, line-height
1.5. Studio chapter body: `0.9rem` / 1.9 on desktop, `0.8rem` below 1024px, and
`0.8rem` / 1.75 with a `1.25rem` heading at 650px. Keep the bilingual copy
readable and use logical properties for direction changes.

`h1`–`h3` inside `.storefront` and `.admin-content` get `text-wrap: balance` and
`overflow-wrap: anywhere`.

## Layout

`html` carries `scrollbar-gutter: stable` and `scroll-behavior: smooth`.

- **Header** — `sticky top-0 z-30`, `border-b border-cocoa-200 bg-paper`, inner
  `max-w-7xl px-4 py-3`. Re-points to the comb automatically. Desktop nav is a
  2px bottom border that turns `honey-700` on the active item; icon buttons are
  44px circles (`h-11 w-11 rounded-full border-cocoa-200 bg-paper`).
  Mobile drawer: `w-80 max-w-[85vw]`, `bg-parchment`, `border-s border-cocoa-100`,
  `shadow-warm-lg`, opened by an edge swipe or the menu button and closed above
  1024px.
- **Main** — `.storefront` is `mx-auto w-full flex-1 max-w-7xl px-4` on every
  route except `/`, with `padding-bottom: 3rem` and `scroll-margin-top: 9rem`.
  Home sections are their own measure: `width: min(calc(100% - 2rem), 1248px)`,
  `margin-top: 4.5rem` (3rem at 600px), `scroll-margin-top: 7rem`.
- **Grids** — home product grid `repeat(4, minmax(0,1fr))` gap `1.2rem`; catalog
  grids `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` gap `4`. Home category grid
  `repeat(6, 1fr)` gap `1.5rem`, 3 columns at 900px, 2 at 600px.
- **Product imagery** — cards use a 4/3 `AspectRatio`, the gallery and its
  thumbnails use 1/1.
- **Cart** — page grid `lg:grid-cols-[minmax(0,1fr)_340px]` with a sticky summary
  at `lg:top-36 xl:top-24`; drawer `w-[88vw] max-w-[24rem] sm:w-96 lg:w-[27rem]`.
- **Hero** — `.cinema` sets `--hero-header: 73px` (69px at 1023px and below) and
  a `360svh` scroll area holding a `sticky` stage of
  `calc(100svh - var(--hero-header))`, `min-height: 580px`. At 650px and below it
  is `280svh` with `min-height: 640px`. Reduced motion or a scene failure
  collapses the extended scroll area into a static introduction of the same
  viewport height. A separate `.hero-grid` composition in `layout.css` is
  defined but not referenced in markup.

All controls in `.storefront`, `.admin-content`, `[role="dialog"]` and `header`
carry `min-height: 2.75rem` (44px). Fields get `min-height: 2.75rem` and
`font-size: 1rem` so mobile Safari does not zoom on focus. Below 640px
`.btn-outline` and `.btn-primary` drop to `padding-inline: 0.75rem`.

## Elevation & Depth

Warm shadows read as depth on a light page; on a dark comb they have to be
near-black to register at all, so all three tokens are re-pointed in the
storefront block.

```yaml
light:
  warm-sm: "0 1px 2px rgb(28 25 20 / 0.06)" # panels, resting primary buttons
  warm: "0 8px 24px -12px rgb(28 25 20 / 0.14)" # primary-button hover
  warm-lg: "0 20px 48px -20px rgb(28 25 20 / 0.18)" # dialogs, drawers, scroll-to-top
storefront:
  warm-sm: "0 1px 2px rgb(0 0 0 / 0.4)"
  warm: "0 10px 28px -14px rgb(0 0 0 / 0.65)"
  warm-lg: "0 24px 52px -24px rgb(0 0 0 / 0.75)"
```

Cards lift `hover:-translate-y-0.5` and take `shadow-warm`. The studio's own
depth is physical rather than a token: lathed glass with
`renderer.transmissionResolutionScale = 0.5`, a dark honey volume
(`0x190800`, attenuation `0x572205`), a white ridged cap (`0xffffff`), a label
cylinder, a soft `ShadowMaterial` floor at 13% opacity, and a clear colour of
`0x141611` at zero alpha so the stage reads as the ink-950 page behind it. Scene
setup is deferred to `requestIdleCallback` (2.5s ceiling, 400ms fallback) and
the photographed label is not awaited, so the first navigation is never queued
behind the hero.

## Shapes

The complete radius scale. Everything here is present in the code; nothing
below is off-scale.

| Radius     | Utility        | Where it is used                                                                                                                                                                                   |
| ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `3px`      | —              | The studio honey action (`.shop-honey`); the one deliberately non-pill rectangle in the system                                                                                                     |
| `0.25rem`  | `rounded`      | `.skeleton-text` rows; admin gallery controls                                                                                                                                                      |
| `0.375rem` | —              | `.skeleton-heading` rows                                                                                                                                                                           |
| `0.5rem`   | `rounded-lg`   | `.skeleton` base; the category inset plate (`.category-item span`); search-result and admin thumbnails                                                                                             |
| `0.75rem`  | `rounded-xl`   | `.field`, `.skip-link`, dialog list items, gallery thumbnails, nav drawer items                                                                                                                    |
| `1rem`     | `rounded-2xl`  | Panels, cards, `PageHero`, `AuthShell`, gallery, cart line items, select content. Also the shadcn `--radius` container value. Category tile frames and the home equipment band use the same `1rem` |
| `1.5rem`   | `rounded-3xl`  | About-page feature cards, the checkout-success banner                                                                                                                                              |
| `9999px`   | `rounded-full` | Buttons, chips, badges, `QuantityPicker`, cart-count bubble, scroll-to-top, `rule-gold` caps                                                                                                       |
| `50%`      | —              | `.spinner`, the studio motion toggle, the home `.feature-icon` well, round icon chips                                                                                                              |

`--radius: 1rem` in `@theme` keeps shadcn-style containers on the same soft
`2xl` family as the hand-written panels.

## Components

### Buttons

| Class          | Base (both worlds)                                                                                                                                         | Storefront override                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `.btn-primary` | `rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-parchment shadow-warm-sm`, `hover:-translate-y-0.5 hover:shadow-warm`, `disabled:opacity-40` | gold ground, ink text, no resting shadow; hover `honey-700` + `shadow-warm` |
| `.btn-outline` | `rounded-full border-cocoa-500 bg-parchment/40 px-6 py-2.5 backdrop-blur-md`, `hover:border-cocoa-900 hover:bg-parchment/60`                               | `color-mix` ground from `cocoa-200`, `cocoa-300` on hover                   |
| `.btn-ghost`   | `rounded-full px-4 py-2 text-honey-700`, `hover:bg-honey-50`                                                                                               | no override needed — both tokens re-point                                   |

All three are `transition-all duration-300`. `Button.svelte` maps
`primary`/`outline`/`ghost` onto these three classes and renders a
`bits-ui` `Button.Root`; passing `href` switches it to an anchor.

### Form fields

`.field` is `rounded-xl border-cocoa-200 bg-parchment px-4 py-2.5` with
`caret-color: var(--color-honey-800)`. `aria-invalid="true"` gives
`border-clay-700`; `:disabled` gives `bg-cocoa-100`; `:focus` gives
`border-honey-600` plus `ring-2 ring-honey-600/20`. Placeholder text is
`cocoa-600`. `.field-label` is `text-sm font-semibold text-cocoa-800`;
`.field-error` is `text-xs font-medium text-clay-600`. Auth pages use these
directly with no wrapper component. `.alert-error` is
`rounded-xl bg-clay-50 px-4 py-3 text-sm font-semibold text-clay-700`.

### Chips, badges and states

`.chip` is a bordered pill (`border-cocoa-200 bg-parchment text-cocoa-700`,
`hover:border-cocoa-400`). The `chip-active` **utility** is its selected state:
`honey-600` border, `honey-600` ground, `ink-950` text, `honey-700` on hover —
gold-on-ink in both worlds, since both tokens re-point. It is applied as
`data-[state=on]:chip-active` on `ToggleGroup.Item`.

Badges: `.badge-out` (`bg-clay-600`, white text), `.badge-warn` (`bg-honey-700`,
white text), `.badge-neutral` (outlined), `.badge-ok` (`bg-honey-50 text-honey-800`).
On the storefront the first two flip their text to `ink-950`.

### Surfaces

`.paper-panel` is `rounded-2xl border-cocoa-100 bg-parchment shadow-warm-sm`;
`.empty-state` is a dashed `rounded-2xl` with `padding: clamp(1.5rem, 5vw, 3.5rem)`.
`.photo-mat` is `bg-sand-100` only. `.paper-grain`, `.rule-gold`,
`.brand-wordmark` and `.brand-wordmark-on-dark` are defined in `layout.css` but
are **not** referenced by current markup.

### Photography

`ProductCard` wraps the image in `.photo-mat` with `object-contain p-3
mix-blend-multiply`, and swaps to `ProductArt` when the photo is a placeholder.
The card is `rounded-2xl border-cocoa-200 bg-parchment` with a 4/3 frame, stock
badges pinned to the bottom, and a `.btn-primary` or `.btn-outline` depending on
whether the product has more than one variant. The "added" state inverts the
primary button to `!bg-ink-950 !text-honey-600` and plays a 300ms dash-offset
checkmark.

`ProductImageGallery` is a `.photo-mat rounded-2xl border-cocoa-200` 1/1 frame
with `mix-blend-multiply`, sand-coloured controls on the `ink-950/95` lightbox
(`text-sand-100`, `bg-sand-100/10`), and a `.photo-mat` thumbnail strip whose
active thumb takes `border-honey-600` plus `ring-2 ring-honey-600/25`. The card
thumbnail morphs into the detail image through a shared
`view-transition-name: product-<id>`; the transition is 350ms and the snapshots
keep their default fade so an unmatched outgoing image does not freeze.

### Cart and checkout

`CartLineItem` is a `rounded-2xl border-cocoa-100 bg-parchment shadow-warm-sm`
row on the page and a `rounded-xl bg-paper` row in the drawer, with a 44px
`QuantityPicker` pill and a 44px circular remove button that hovers
`bg-clay-50 text-clay-600`. `CartDrawer` and the mobile nav drawer both use
`bg-parchment`, `border-s border-cocoa-100` and `shadow-warm-lg` over a
`bg-ink-950/60 backdrop-blur-sm` overlay. `CartTotals` is a definition list with
a `border-t border-cocoa-100` total row. The checkout-success page pairs
`bg-gradient-to-br from-paper via-cream to-cream-deep` with `.badge-ok` for the
order number and `.alert-error`-style clay text for claim failures.

### Header, footer and account surfaces

The header's `bg-paper`, `border-b border-cocoa-200` and `honey-700` active
states all re-point; no header-specific override exists. The cart-count bubble
is `bg-honey-700 text-parchment ring-2 ring-paper`. The footer is
`border-t border-honey-100 bg-cream` with `cocoa-600` links that go `honey-700`
on hover. `AuthShell` is a `rounded-2xl border-cocoa-200 bg-parchment` card with
a `.headline` `text-3xl` title. `ScrollToTop` is a 48px
`rounded-full bg-cocoa-100 text-cocoa-900 shadow-warm-lg` with an inset
`ring-cocoa-300`, appearing past 480px of scroll. `PageHero` is
`rounded-2xl bg-cream` with an `.eyebrow` and a `.headline` title.

### Studio hero

`Hero.svelte` is the source of the storefront palette. `.cinema` is
`background: var(--color-ink-950); color: var(--color-cocoa-900)` at
`height: 360svh`, holding a `sticky` `.cinema-stage`. The five copy phases are
`opacity 0.45s, transform 0.6s cubic-bezier(.2,.7,.2,1)`. GSAP ScrollTrigger with
`scrub: 0.65` maps native scroll to a `0→1` playhead; the phase is derived from
it (`<.2, <.45, <.68, <.9`, else return). Four viewpoint buttons scroll to
positions in the same document flow. The motion toggle freezes the held
position; reduced motion pins the opening view and hides the viewpoint buttons,
scroll prompt and toggle. The existing Sidr photograph is the loading and
failure fallback and fades out once the scene reports ready.

The stage also carries the design system's quiet signatures: `ETMAN` in
`honey-400` behind the jar, a `honey-600` active viewpoint bar, the
`wordmark-sheen` gradient, `honey-pulse` and `honey-drop-bob` on brand accents,
and a `progress-indeterminate` top bar in `honey-500`.

### Motion inventory

| Name                     | Value                                        | Purpose                                    |
| ------------------------ | -------------------------------------------- | ------------------------------------------ |
| `fade-up`                | `0.7s cubic-bezier(0.22, 1, 0.36, 1)`        | Section entrance                           |
| `fade-in` / `fade-out`   | `0.3s ease`                                  | View transitions, lightbox                 |
| `product-img` group      | `0.35s cubic-bezier(0.22, 1, 0.36, 1)`       | Card → detail image morph                  |
| `brand-rise`             | `0.8s cubic-bezier(0.22, 1, 0.36, 1)`        | Brand accent settle-in                     |
| `float-y`                | `4.5s` alternate; `5.5s` with a `1.4s` delay | Slow hover drift                           |
| `wordmark-sheen`         | `7s ease-in-out infinite`                    | Gradient sweep across the brand mark       |
| `honey-pulse`            | `3.2s infinite`                              | Honeycomb and honey-drop scale/sway        |
| `honey-drop-bob`         | `4s infinite`                                | The honey drop's bob                       |
| `shimmer`                | `1.5s ease-in-out infinite`                  | Skeleton sweep over `cocoa-100 → cocoa-50` |
| `added-check`            | `0.3s ease forwards`                         | Dash-offset cart confirmation              |
| `pop-in`                 | `0.35s cubic-bezier(0.22, 1, 0.36, 1)`       | Badge pop                                  |
| `spin`                   | `0.6s linear infinite`                       | Spinner                                    |
| `progress-indeterminate` | `translateX(-100% → 100%)`                   | Top navigation bar                         |

Entrance animations run once on the initial full page load only:
`html.has-nav` (added in `beforeNavigate`) disables `animate-fade-up`,
`animate-float` and `animate-float-delay`, because the view transition already
fades the new page in and replaying them would flicker.
`prefers-reduced-motion: reduce` collapses every animation, transition and
`scroll-behavior` to `0.01ms`/`auto` globally.

## Do's and Don'ts

- Do preserve the existing name, logo, product photos and Arabic RTL / English
  LTR behavior.
- Do build new surfaces from the existing token names (`bg-parchment`,
  `text-cocoa-900`, `border-cocoa-200`, `text-honey-600`) so they resolve
  correctly in both worlds without a new rule.
- Do keep the dark olive and honey-gold world as the storefront's palette
  everywhere a customer can see it, including the header, catalog, cart,
  checkout and account.
- Do keep the light paper palette on `/admin`; it is a deliberate second world,
  not a leftover.
- Do put catalog photography on `.photo-mat` and multiply it in. The sand plate
  is the single place to change if the client later wants photographs blended
  into the ground instead.
- Do give a product with no photo the dark dashed well (`ProductArt`), never an
  empty bright plate.
- Do keep shopping links and product information usable before the scene loads.
- Do use reduced-motion behavior, visible focus and 44px storefront controls.
- Do keep `@theme` non-`inline`. Inlining the values breaks per-scope re-pointing.
- Do add a `.storefront-shell`-prefixed override only for values a `var()` cannot
  express, and record it in the table above.
- Don't reintroduce the rejected playful dipper, droplets or separate animated
  story treatment.
- Don't present the procedural jar as a scan or exact packaging photograph.
- Don't require an animation to finish before shopping or replace native
  scrolling.
- Don't put a hard-coded hex in a component that should re-point with the theme.
- Don't use sand for anything other than photographic plates, or use
  `mix-blend-multiply` outside the photographic surfaces already listed.
- Don't invent product benefits, testimonials, certifications or delivery
  promises.

## Token table

Every value in this table is read from `src/routes/layout.css`. Sand and amber
are identical in both columns because neither is re-pointed.

| Token                | Light `:root`                            | Storefront                            | Role                           |
| -------------------- | ---------------------------------------- | ------------------------------------- | ------------------------------ |
| `--color-paper`      | `#faf9f6`                                | `#171a11`                             | Page ground                    |
| `--color-paper-deep` | `#f3f0e9`                                | `#101208`                             | Recessed ground                |
| `--color-parchment`  | `#ffffff`                                | `#1f2318`                             | Cards, fields, dialogs         |
| `--color-cream`      | `#f6f1e6`                                | `#22261b`                             | Section bands                  |
| `--color-cream-deep` | `#efe7d6`                                | `#2a2f22`                             | Band gradient end              |
| `--color-cocoa-50`   | `#faf9f7`                                | `#1c1f15`                             | Darkest raised step            |
| `--color-cocoa-100`  | `#f0eeea`                                | `#262a1e`                             | Wells, muted ground            |
| `--color-cocoa-200`  | `#dcd8d0`                                | `#32372a`                             | Borders, inputs                |
| `--color-cocoa-300`  | `#bfb9ad`                                | `#434936`                             | Scrollbar thumb, hero bars     |
| `--color-cocoa-400`  | `#9c9486`                                | `#616750`                             | Chip hover border              |
| `--color-cocoa-500`  | `#7d7566`                                | `#8a8776`                             | Muted foreground               |
| `--color-cocoa-600`  | `#625b4e`                                | `#a7a28c`                             | Placeholder, secondary copy    |
| `--color-cocoa-700`  | `#4d473d`                                | `#c5bfa8`                             | Chip / table heading text      |
| `--color-cocoa-800`  | `#3a352d`                                | `#ded7c1`                             | Secondary headings             |
| `--color-cocoa-900`  | `#2a2620`                                | `#ede9da`                             | Body text                      |
| `--color-cocoa-950`  | `#1c1914`                                | `#f7f4ea`                             | Scale extreme                  |
| `--color-honey-50`   | `#fffbeb`                                | `#2b2513`                             | Badge / ghost hover ground     |
| `--color-honey-100`  | `#fef3c7`                                | `#332c16`                             | Badge ground                   |
| `--color-honey-200`  | `#fde68a`                                | `#453a1d`                             | Base `::selection`             |
| `--color-honey-300`  | `#fcd34d`                                | `#6d5c31`                             | `rule-gold`, gradient stops    |
| `--color-honey-400`  | `#fbbf24`                                | `#9a8148`                             | ETMAN wordmark                 |
| `--color-honey-500`  | `#f59e0b`                                | `#c2a463`                             | Top progress bar               |
| `--color-honey-600`  | `#d97706`                                | `#d3b87b`                             | Actions, focus ring, `--ring`  |
| `--color-honey-700`  | `#b45309`                                | `#e2cd9d`                             | Eyebrows, ghost buttons        |
| `--color-honey-800`  | `#92400e`                                | `#efe3c6`                             | Caret, `--accent-foreground`   |
| `--color-honey-900`  | `#78350f`                                | `#f6efdd`                             | Scale extreme                  |
| `--color-honey-950`  | `#451a03`                                | `#fbf8ee`                             | Scale extreme                  |
| `--color-clay-50`    | `#fdf3ef`                                | `#2b1710`                             | Alert error ground             |
| `--color-clay-100`   | `#fbe3da`                                | `#3a1e15`                             | Admin icon wells               |
| `--color-clay-200`   | `#f6c5b5`                                | `#5c2a1c`                             | Decorative blur                |
| `--color-clay-300`   | `#ee9d83`                                | `#8f3f27`                             | Scale step                     |
| `--color-clay-400`   | `#e27251`                                | `#bd5636`                             | Scale step                     |
| `--color-clay-500`   | `#d4572f`                                | `#d76a44`                             | Scale step                     |
| `--color-clay-600`   | `#b5451f`                                | `#e08a63`                             | `--destructive`, badges        |
| `--color-clay-700`   | `#96371c`                                | `#eda98a`                             | Invalid field border           |
| `--color-clay-800`   | `#7a2f1d`                                | `#f3c6b3`                             | Claim error text               |
| `--color-clay-900`   | `#64291b`                                | `#f8ded3`                             | Scale extreme                  |
| `--color-olive-50`   | `#f7f7ed`                                | `#171a11`                             | Olive ground step              |
| `--color-olive-100`  | `#edebd1`                                | `#1f2317`                             | Olive ground step              |
| `--color-olive-200`  | `#dad6a6`                                | `#2b3021`                             | Olive ground step              |
| `--color-olive-300`  | `#c2bb74`                                | `#3d442c`                             | Olive ground step              |
| `--color-olive-400`  | `#aaa04c`                                | `#5c6539`                             | Olive ground step              |
| `--color-olive-500`  | `#8d8433`                                | `#7e894a`                             | Olive ground step              |
| `--color-olive-600`  | `#6f6727`                                | `#a3b062`                             | Olive ground step              |
| `--color-olive-700`  | `#554e20`                                | `#c2cd8c`                             | Olive ground step              |
| `--color-olive-800`  | `#413c1b`                                | `#d8e0ae`                             | Paid-claim text                |
| `--color-olive-900`  | `#33301a`                                | `#eaf0cd`                             | Olive ground step              |
| `--color-ink-800`    | `#26231e`                                | `#20231a`                             | Ink step                       |
| `--color-ink-900`    | `#1d1a16`                                | `#171a11`                             | Ink step                       |
| `--color-ink-950`    | `#14120f`                                | `#101208`                             | `--primary`; hero stage ground |
| `--color-amber-300`  | `#fcd34d`                                | `#fcd34d`                             | Wordmark gradient only         |
| `--color-amber-400`  | `#f5b72c`                                | `#f5b72c`                             | Wordmark gradient only         |
| `--color-amber-500`  | `#e89b13`                                | `#e89b13`                             | Wordmark gradient only         |
| `--color-amber-600`  | `#c97a06`                                | `#c97a06`                             | Wordmark gradient only         |
| `--color-amber-700`  | `#9c5b04`                                | `#9c5b04`                             | Wordmark gradient only         |
| `--color-sand-50`    | `#f7f4ea`                                | `#f7f4ea`                             | Scale extreme                  |
| `--color-sand-100`   | `#efe9db`                                | `#efe9db`                             | `.photo-mat`                   |
| `--color-sand-200`   | `#e0d8c4`                                | `#e0d8c4`                             | Equipment band border          |
| `--color-sand-300`   | `#c9bfa6`                                | `#c9bfa6`                             | Scale step                     |
| `--color-sand-400`   | `#a49a80`                                | `#a49a80`                             | Scale step                     |
| `--shadow-warm-sm`   | `0 1px 2px rgb(28 25 20 / 0.06)`         | `0 1px 2px rgb(0 0 0 / 0.4)`          | Resting elevation              |
| `--shadow-warm`      | `0 8px 24px -12px rgb(28 25 20 / 0.14)`  | `0 10px 28px -14px rgb(0 0 0 / 0.65)` | Hover elevation                |
| `--shadow-warm-lg`   | `0 20px 48px -20px rgb(28 25 20 / 0.18)` | `0 24px 52px -24px rgb(0 0 0 / 0.75)` | Overlay elevation              |
| `--radius`           | `1rem`                                   | `1rem`                                | shadcn container radius        |

Asset provenance and the scene cost budget are recorded in
`docs/landing-assets.md`.
