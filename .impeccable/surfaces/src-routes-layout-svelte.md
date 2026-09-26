---
version: 1
slug: "src-routes-layout-svelte"
primary_target: "src/routes/+layout.svelte"
related_targets:
  [
    "src/lib/components/Hero.svelte",
    "src/lib/components/Header.svelte",
    "src/lib/components/ProductCard.svelte",
  ]
---

---

version: 1
slug: "src-routes-layout-svelte"
primary_target: "src/routes/+layout.svelte"
related_targets:
[
"src/lib/components/Hero.svelte",
"src/lib/components/Header.svelte",
"src/lib/components/ProductCard.svelte",
]
---

# Storefront shell

Scope: every customer-facing surface (home, catalog, department/category, product
detail, cart, checkout, account, auth, about, search, header, footer, cart drawer).
Mode: Persuade for home and catalog, Operate for cart, checkout and account.
Admin is explicitly out of scope and keeps the light palette.

Audience: Arabic-first honey buyers and beekeepers browsing on a phone, plus
desktop shoppers comparing weights. Job: find a honey or hive product, understand
its real weight and price, and add it to the cart. Proof: the real catalog
photography and the live cart. Constraints: RTL/LTR, reduced motion, keyboard
operation, 44px controls, no invented claims.

Chosen direction: the hero's dark olive studio treatment is promoted from a
homepage-local treatment to the storefront's whole color system. User-pinned;
no roll was run.

## Direction contract

THESIS: The storefront becomes the dark comb — a deep olive ground, honey-gold
for every action, ivory type, and catalog photography presented on warm sand
plates. It refuses the cream-paper-plus-amber-accent honey shop the previous
palette already was: on this site the product is the only bright object.

OWN-WORLD: Ground `#171a11` with three raised olive steps and 1px olive
borders; the studio stage is a deeper well at `#101208`.
Text is ivory `#ede9da` and its muted steps are tinted in the same yellow-green
family, never neutral gray. Honey gold `#d3b87b` carries every primary action,
active state, focus ring and underline. A sand family (`#efe9db` down to
`#c9bfa6`) is the only light surface: it mats product photography and carries
the amber jar highlights. Corners stay 12–16px, buttons stay pills, the studio
action keeps its 3px radius. Nothing is pure white or pure black.

STORY: A visitor arrives into a hive lit from within. The jar is lit, the
wayfinding is gold on dark, and every photograph sits on a warm plate so honey
colour is judged truthfully rather than filtered.

FIRST VIEWPORT: The pinned 3D studio stage fills the viewport under the dark
header, ETMAN in muted gold behind the jar, chapter copy on one side and the
gold honey action opposite. Scroll on, the first catalogue section arrives as
dark cards, each holding one sand photo mat with the product name and price in
ivory beneath it.

FORM: Local extension of an established world. The hero treatment is promoted to
the site palette; no new structure, no new page archetype. Seed key: none —
direction is user-pinned, so no concept roll was run.

Memorable moment: scrolling out of the studio into the first dark product grid,
where every photograph is still warm and true on its sand plate.

Unresolved: photography mats are sand in both directions; if the client later
prefers photographs blended into the ground, the plate is the single place to
change.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

## Built reconciliation

Tuned during the build: the page ground was lifted from `#141611` to `#171a11`
so the olive reads against the ivory type, and the studio stage was pushed to
`#101208` so it sits in the page as a well rather than a slab. The sand range
ends at `sand-300` `#c9bfa6`, not a value outside the scale. The photographed
label is no longer awaited by the scene, the scene starts from idle, and the
category tile's blend was removed after measuring its compositor cost. See
`docs/landing-assets.md` and `DESIGN.md`.
