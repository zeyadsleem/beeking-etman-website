---
name: Beeking Etman
description: A cinematic product introduction within a warm honey and apiary storefront.
colors:
  studio-olive: "#141611"
  studio-gold: "#d3b87b"
  studio-type: "#9c8f6e"
  studio-ivory: "#ede9da"
  paper: "#faf9f6"
  parchment: "#ffffff"
  cream: "#f6f1e6"
  cream-deep: "#efe7d6"
  cocoa-900: "#2a2620"
  cocoa-700: "#4d473d"
  cocoa-200: "#dcd8d0"
  ink-950: "#14120f"
  honey-800: "#92400e"
  honey-600: "#d97706"
  honey-200: "#fde68a"
typography:
  studio-word:
    fontFamily: '"Manrope Variable", "Cairo Variable", ui-sans-serif, system-ui, sans-serif'
    fontSize: "clamp(8rem, 24vw, 23rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
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
rounded:
  studio-action: "3px"
  field: "12px"
  panel: "16px"
  pill: "9999px"
spacing:
  small: "16px"
  medium: "24px"
  large: "32px"
  feature: "48px"
  section: "72px"
components:
  studio-action:
    backgroundColor: "{colors.studio-gold}"
    textColor: "#1b1d14"
    rounded: "{rounded.studio-action}"
    padding: "0.8rem 1.4rem"
  button-primary:
    backgroundColor: "{colors.ink-950}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-outline:
    textColor: "#3a352d"
    rounded: "{rounded.pill}"
    padding: "10px 24px"
  button-ghost:
    textColor: "#b45309"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  field:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.cocoa-900}"
    rounded: "{rounded.field}"
    padding: "10px 16px"
  chip:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.cocoa-700}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  paper-panel:
    backgroundColor: "{colors.parchment}"
    rounded: "{rounded.panel}"
---

# Design System: Beeking Etman

## Overview

**Creative North Star: "A cinematic product study"**

The landing introduces Etman through a centered, realistic honey jar against dark olive, with giant gold-toned ETMAN lettering behind it. Native scrolling moves the camera through front, side, cap and label details before returning to the opening view. This replaces the playful illustrative 3D direction rejected by the user; it records the implemented reference-led treatment, not a standing dark-theme preference for the whole store.

Commerce retains its warm paper, cream and cocoa palette, real catalog photography and readable bilingual typography. The studio scene is a procedural product interpretation with the existing Sidr photograph mapped onto its label, not a scanned or downloaded product model.

**Key Characteristics:**

- Centered product with oversized typography behind it.
- Dark olive and muted gold for the landing studio and homepage header.
- Physical glass, dark honey and a white ridged cap under studio lighting.
- Warm shared commerce surfaces with Arabic RTL and English LTR behavior.

## Colors

The studio uses olive darkness, muted gold lettering, ivory text and a brighter gold shopping action. The homepage header carries the same olive background, gold active-navigation underline and warm light controls. These are local treatments. Paper and cream continue to carry browsing surfaces; cocoa supplies text, honey brown marks emphasis, and ink anchors shared primary actions. White parchment backs catalog photography and fields. `src/routes/layout.css` remains the source for the full shared color scales.

## Typography

The studio wordmark uses oversized, tightly tracked Manrope behind the product; on phones it uses 26vw. Arabic uses Amiri for shared display roles and Cairo for body text; English uses Newsreader for shared display roles and Manrope for body text. Studio chapter headings use the inherited heading font at `clamp(1.5rem, 2.4vw, 2.5rem)`, weight 600 and 1.5 line height; phones use 1.6rem. Chapter body text is 0.9rem / 1.9 on desktop and 0.8rem / 1.75 on phones. Keep the bilingual copy readable and use logical properties for direction changes.

## Layout

The hero is a centered full-stage product composition, with desktop copy to one side and shopping actions opposite. Its 360svh scroll area holds a sticky stage below the header; ordinary scrolling controls camera progress. At 650px and below it uses 280svh, places copy above the product and actions near the bottom. Header offsets are 73px on desktop and 69px below 1024px. Reduced motion or scene failure collapses the extended scroll area into a static introduction. The skip-to-shop link remains available at the top of the stage.

Commerce keeps its existing contained sections, responsive product grids and equipment photography. Keep studio-specific composition separate from catalog layout rules.

## Elevation & Depth

Studio depth comes from physical glass transmission, dark honey volume, a ridged white cap, soft shadows and reflected environment light. Camera movement reveals materials and product details. There is no floating dipper or decorative droplet system. Shared surfaces retain small warm shadows: `0 1px 2px rgb(28 25 20 / 0.06)`; primary-button hover uses `0 8px 24px -12px rgb(28 25 20 / 0.14)`.

## Shapes

Shared panels and image containers use 16px corners, fields use 12px, and shared buttons and chips are pills. The studio shopping action uses a restrained 3px radius. A circular pause control and thin horizontal viewpoint indicators sit beneath the jar. Preserve the rounded physical product silhouette without turning commerce panels into scene elements.

## Components

Shared primary buttons remain ink with white text; outline and ghost variants retain the warm palette. Shared primary hover lifts 2px, while focus uses a 2px honey-600 outline with 2px offset. Fields use white backgrounds, cocoa borders and a honey focus ring; invalid fields use clay. Active chips use ink with white text.

The homepage header receives the olive/gold treatment while retaining navigation, search, language, account and cart behavior. Its mobile drawer retains the shared light commerce palette.

The hero keeps honey and equipment links visible throughout. GSAP ScrollTrigger maps native scroll to a scrubbed camera timeline; four viewpoint buttons scroll to positions in that timeline. Five copy phases accompany front, side, cap/detail, label/detail and return views. The pause control freezes scene progress and the original Lottie scroll cue. Reduced motion fixes the opening view and hides motion controls. The existing Sidr product photograph remains the loading and failure fallback. Three.js, GSAP and Lottie load dynamically on the client; scene rendering skips unchanged progress, hidden documents and offscreen views. Catalog-backed components retain real images, prices and variants, and FAQ uses native details/summary controls.

Asset provenance and implementation limits are recorded in `docs/landing-assets.md`.

## Do's and Don'ts

- Do preserve the existing name, logo, product photos and Arabic RTL / English LTR behavior.
- Do keep shopping links and product information usable before animation loads.
- Do use reduced-motion behavior, visible focus and 44px storefront controls.
- Do keep the cinematic palette scoped to the homepage introduction and header.
- Don't reintroduce the rejected playful dipper, droplets or separate animated story treatment.
- Don't present the procedural jar as a scan or exact packaging photograph.
- Don't require an animation to finish before shopping or replace native scrolling.
- Don't invent product benefits, testimonials, certifications or delivery promises.
