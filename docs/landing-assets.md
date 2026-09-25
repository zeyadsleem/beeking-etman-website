# Landing assets and motion

The landing reuses the repository's Etman logo, Sidr product photograph and self-hosted fonts. Catalog photography remains the source of product information.

The centered jar is an original procedural Three.js scene built in `src/lib/components/landing/honey-studio.ts`: lathed glass and dark honey, a white cap with ridges, a cylindrical label, studio lights and a soft shadow floor. The existing `static/images/Beeking Etman/برطمان السدر المصرى.jpg` photograph supplies the label through a UV window; its source bytes are unchanged. This is a realistic material study and procedural interpretation, not an exact scanned product model. No third-party 3D model was downloaded, and no Blender-authored asset is bundled; Blender was unavailable in this environment.

`static/animations/scroll-cue.json` is an original lightweight Lottie animation authored for this project. It is not a downloaded LottieFiles asset. No external bee animation, dipper or droplets are included in the current scene. The former separate animated story treatment is no longer part of the landing.

Three.js, GSAP with ScrollTrigger, and lottie-web load dynamically in client-side landing components. GSAP follows native scroll with a scrubbed playhead; Three.js interpolates front, side, cap/detail, label/detail and return camera positions. The stage uses CSS sticky positioning. Viewpoint buttons scroll to positions in the same native document flow; there is no wheel interception or scroll replacement. The reference informed the composition and camera behavior, not copied model or animation assets.

The hero keeps shopping links and a skip-to-shop link available, offers a pause control and respects reduced motion. Reduced motion holds the opening view and removes the extended scroll area. The real product photograph remains the loading or WebGL-failure fallback, and failed scene loading collapses the extended stage. Rendering caps pixel ratio at 1.5 and skips unchanged progress, offscreen views and hidden documents. The dark olive/gold palette is scoped to the homepage introduction and header; commerce retains its warm shared styling.
