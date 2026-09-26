# Landing assets and motion

The landing reuses the repository's Etman logo, Sidr product photograph and
self-hosted fonts. Catalog photography remains the source of product
information.

The centered jar is an original procedural Three.js scene built in
`src/lib/components/landing/honey-studio.ts`: lathed glass and dark honey, a
white cap with ridges, a cylindrical label, studio lights and a soft shadow
floor. The existing `static/images/Beeking Etman/برطمان السدر المصرى.jpg`
photograph supplies the label through a UV window; its source bytes are
unchanged. This is a realistic material study and procedural interpretation,
not an exact scanned product model. No third-party 3D model was downloaded, and
no Blender-authored asset is bundled; Blender was unavailable in this
environment.

`static/animations/scroll-cue.json` is an original lightweight Lottie animation
authored for this project. It is not a downloaded LottieFiles asset. Its
marker is filled with the site's honey gold so it reads on the dark comb. No
external bee animation, dipper or droplets are included in the current scene.
The former separate animated story treatment is no longer part of the landing.

Three.js, GSAP with ScrollTrigger, and lottie-web load dynamically in
client-side landing components. GSAP follows native scroll with a scrubbed
playhead; Three.js interpolates front, side, cap/detail, label/detail and
return camera positions. The stage uses CSS sticky positioning. Viewpoint
buttons scroll to positions in the same native document flow; there is no wheel
interception or scroll replacement. The reference informed the composition and
camera behavior, not copied model or animation assets.

## Scene cost budget

Scene setup costs real GPU time, and reading back a live WebGL canvas stalls
the compositor, so three rules keep the hero off the critical path:

- The scene starts from `requestIdleCallback` (2.5s ceiling, 400ms timer
  fallback) instead of on mount, so an early interaction is never queued behind
  scene setup.
- The photographed label is not awaited. The jar renders on the plain backing
  colour and the print is assigned when the texture lands, which marks the
  render loop dirty so the next frame picks it up. Awaiting it previously held
  the first frame, and the main thread, for as long as the image took.
- `renderer.transmissionResolutionScale` is 0.5: the glass is a transmissive
  material, so every frame renders a second transmission target. Rendering caps
  pixel ratio at 1.5 and skips unchanged progress, offscreen views and hidden
  documents.

Together these took scene creation from about 12s to under 2s on a software
rasteriser, and with them the storefront's first client-side navigation is no
longer queued behind the hero.

## Palette and photography

The hero's dark olive and gold world is the storefront's whole palette, not a
homepage treatment. `src/routes/layout.css` re-points the shared scales inside
`html:has(.storefront-shell)` — the layout adds that class to the customer-facing
branch only, so admin keeps the light paper palette. Utilities resolve through
`var()` (the theme block is deliberately not `inline`) so one set of token
names serves both worlds.

Product shots carry their own light studio background, which no blend mode can
remove on a dark surface, so every photograph sits on a warm sand plate
(`.photo-mat`, the storefront's only light family, identical in both themes)
and is multiplied into it. A product with no photo gets a dark well with a
dashed edge instead of a bright empty plate. Category tiles use a dark frame
with a smaller inset plate: their blend was measured to cost the compositor
enough on a software rasteriser to delay the first navigation, so the tile's
image sits on the plate without a blend.
