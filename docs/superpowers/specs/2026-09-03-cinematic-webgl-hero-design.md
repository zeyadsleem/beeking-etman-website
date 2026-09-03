# Cinematic WebGL Landing Page Hero — Design Spec

**Date:** 2026-09-03
**Status:** Approved
**Scope:** Replace the existing DOM-based Hero with a full-viewport immersive WebGL + GSAP cinematic hero for BeeKing Etman.

---

## 1. Goal

Build a production-quality,510k-style cinematic landing page hero featuring:

- Three.js honeycomb geometry + golden particle backdrop
- GSAP-powered timed entrance animation
- Full RTL Arabic + English support
- Reduced-motion fallback
- Seamless integration with the existing design system

## 2. Visual Concept

**Honeycomb Geometry + Particles:**

- Instanced hexagonal cells forming a gently undulating honeycomb surface
- ~300-500 golden particle motes floating with size attenuation
- Camera slowly drifts forward for depth
- Warm honey-gold lighting from upper-right point light

**Color palette (from `layout.css`):**

- Background: `#14120f` (`--color-ink-950`)
- Honeycomb mesh: `#d97706` (`--color-honey-600`) with `#f59e0b` emissive
- Particles: `#fbbf24` (`--color-honey-400`) with additive blending
- Point light: `#f59e0b` (`--color-honey-500`)

## 3. Architecture

### 3.1 File Structure

```
src/lib/components/hero/
├── WebGLHero.svelte          # Main hero — canvas mount, DOM overlay, GSAP orchestration
├── HoneycombScene.ts         # Three.js scene orchestrator (camera, renderer, lights, loop)
├── HoneycombMesh.ts          # Instanced hexagonal cells with breathing displacement
├── HoneyParticles.ts         # Golden particle motes (Points geometry)
└── heroEntrance.ts           # GSAP timeline factory (staggered DOM reveal)
```

### 3.2 Component Interface

**`WebGLHero.svelte`** — replaces `Hero.svelte` in `+page.svelte`.

```svelte
<WebGLHero lang={lang} productCount={data.products.length} />
```

Props (unchanged from current Hero):

- `lang: Lang` — `"ar" | "en"`, defaults to `"ar"`
- `productCount: number` — passed to countUp stats

### 3.3 Three.js Scene (`HoneycombScene.ts`)

**Class:** `HoneycombScene`

**Constructor:** `new HoneycombScene(canvas: HTMLCanvasElement, options?: { reducedMotion: boolean })`

**Renderer:**

- `WebGLRenderer({ canvas, alpha: true, antialias: true })`
- `toneMapping = ACESFilmicToneMapping`
- `outputColorSpace = SRGBColorSpace`
- `setPixelRatio(Math.min(window.devicePixelRatio, 2))` — cap at 2x for performance

**Camera:**

- `PerspectiveCamera(45, aspect, 0.1, 100)`
- Position: `(0, 0, 6)`
- LookAt: `(0, 0, 0)`
- Mobile (< 640px): FOV widened to 55

**Lights:**

- `AmbientLight(0xffffff, 0.3)` — base fill
- `PointLight(0xf59e0b, 1.5, 20)` at `(3, 2, 5)` — warm honey glow

**Background:**

- `scene.background = new Color(0x14120f)` — matches `--color-ink-950`

**Methods:**

- `animate(time: number)` — called each rAF, updates mesh + particles, renders
- `resize(width: number, height: number)` — updates camera aspect + renderer size
- `destroy()` — disposes all geometry, materials, renderer; cancels rAF

### 3.4 Honeycomb Mesh (`HoneycombMesh.ts`)

**Class:** `HoneycombMesh`

**Geometry:**

- Single `CircleGeometry(radius, 6)` — hexagon with 6 radial segments
- Instanced via `InstancedMesh(geometry, material, count)`
- Instance count: ~50 on desktop, ~25 on mobile (< 640px)

**Grid layout:**

- Hexagonal grid offset pattern: rows alternate by `radius * 1.5` in X, `radius * sqrt(3)` in Y
- Each instance gets random scale jitter: `0.8 + Math.random() * 0.4`
- Centered at origin, spanning roughly `(-4, -3)` to `(4, 3)` in world space

**Material:**

```js
MeshStandardMaterial({
  color: 0xd97706, // --color-honey-600
  emissive: 0xf59e0b, // --color-honey-500
  emissiveIntensity: 0.15,
  transparent: true,
  opacity: 0.35,
  side: DoubleSide,
});
```

**Animation (`update(time)`):**

- Each instance: sinusoidal Y-displacement `sin(time * 0.5 + instanceIndex * 0.3) * 0.15`
- Creates a slow breathing/undulating honeycomb surface
- Period: ~4 seconds

### 3.5 Particle System (`HoneyParticles.ts`)

**Class:** `HoneyParticles`

**Geometry:**

- `BufferGeometry` with `Float32Array` positions
- ~400 particles on desktop, ~150 on mobile
- Initial positions: random within sphere of radius 8

**Attributes:**

- `position`: `Float32Array` (x, y, z)
- `aSize`: custom `BufferAttribute` — random size per particle (0.02–0.08)

**Material:**

```js
PointsMaterial({
  color: 0xfbbf24, // --color-honey-400
  size: 0.04,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.6,
  blending: AdditiveBlending,
  depthWrite: false,
});
```

**Animation (`update(time)`):**

- Each particle drifts upward: `y += 0.002`
- Slight sinusoidal X/Z wobble: `x += sin(time + i) * 0.001`
- Particles exiting the bounding sphere (y > 8) reset to y = -8

### 3.6 GSAP Entrance Timeline (`heroEntrance.ts`)

**Function:** `createEntranceTimeline(elements: HeroElements, reducedMotion: boolean): gsap.core.Timeline | null`

Returns `null` if `reducedMotion` is true (no animation).

**Timeline:**

| Delay | Element        | From                    | To                   | Duration | Ease         |
| ----- | -------------- | ----------------------- | -------------------- | -------- | ------------ |
| 0.0s  | canvas wrapper | opacity: 0              | opacity: 1           | 1.2s     | `power2.out` |
| 0.3s  | eyebrow        | opacity: 0, y: 20       | opacity: 1, y: 0     | 0.6s     | `power3.out` |
| 0.6s  | headline       | opacity: 0, y: 30       | opacity: 1, y: 0     | 0.8s     | `power3.out` |
| 1.0s  | subtitle       | opacity: 0, y: 20       | opacity: 1, y: 0     | 0.6s     | `power2.out` |
| 1.3s  | CTA group      | opacity: 0, y: 15       | opacity: 1, y: 0     | 0.5s     | `power2.out` |
| 1.0s  | product image  | opacity: 0, scale: 0.92 | opacity: 1, scale: 1 | 1.0s     | `power2.out` |
| 1.6s  | stats row      | opacity: 0, y: 10       | opacity: 1, y: 0     | 0.5s     | `power2.out` |

**Dependencies:** `gsap` package (new).

### 3.7 DOM Overlay Layout

The DOM sits inside a `position: relative` container layered over the canvas:

```
┌──────────────────────────────────────────────────────┐
│ [Canvas z-0: absolute inset-0, pointer-events-none]  │
│                                                       │
│ ┌─ z-20 content ───────────────────────────────────┐  │
│ │  eyebrow (honey accent, tracking-wide)           │  │
│ │  headline (Amiri/Newsreader, 4xl→7xl)            │  │
│ │  subtitle (glass panel bg-ink-900/60 backdrop-blur)│ │
│ │  CTAs [Shop Now] [Discover]                      │  │
│ │                                                   │  │
│ │  product image (arch frame, right/lower)          │  │
│ │  stats row (3 col, countUp)                      │  │
│ └───────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Text legibility:**

- Headline: `text-shadow: 0 2px 20px rgba(20,18,15,0.8)`
- Subtitle: `bg-ink-900/60 backdrop-blur-md rounded-2xl px-5 py-3`
- Eyebrow: `text-honey-300` with `tracking-[0.3em]`

**Product image:**

- Same arched decorative frame as current Hero (rounded-t-full, border, shadow)
- Positioned right side on desktop, below text on mobile
- Uses existing `AspectRatio` from `bits-ui`

**Stats row:**

- 3-column grid with `use:countUp` action (existing)
- Product count, governorates (27), customers (12000)

## 4. Mobile & Performance

- **Mobile** (< 640px):
  - Particle count: ~150 (vs 400 desktop)
  - Honeycomb instances: ~25 (vs 50 desktop)
  - Camera FOV: 55 (vs 45 desktop)
- **Reduced motion** (`prefers-reduced-motion: reduce`):
  - Skip GSAP timeline — all DOM content visible immediately
  - Canvas renders static scene (no animation loop)
  - Same UX pattern as existing `CinematicStory.svelte` reduced-motion fallback
- **Pixel ratio**: Capped at 2x (`Math.min(devicePixelRatio, 2)`)
- **Cleanup**: `onMount` returns teardown — `scene.destroy()` disposes all GPU resources, cancels rAF

## 5. Files Modified

| File                                        | Action | Notes                                     |
| ------------------------------------------- | ------ | ----------------------------------------- |
| `src/lib/components/hero/WebGLHero.svelte`  | Create | Main hero component                       |
| `src/lib/components/hero/HoneycombScene.ts` | Create | Three.js scene orchestrator               |
| `src/lib/components/hero/HoneycombMesh.ts`  | Create | Instanced hex mesh                        |
| `src/lib/components/hero/HoneyParticles.ts` | Create | Particle system                           |
| `src/lib/components/hero/heroEntrance.ts`   | Create | GSAP timeline                             |
| `src/routes/+page.svelte`                   | Edit   | Change `import Hero` → `import WebGLHero` |
| `package.json`                              | Edit   | Add `three`, `gsap`, `@types/three`       |

**Not modified:**

- `src/lib/components/Hero.svelte` — kept as-is (rollback fallback)
- `src/lib/components/Hero.svelte.spec.ts` — still tests old Hero
- `src/routes/layout.css` — no CSS changes (all Tailwind utilities)
- i18n keys — all existing `hero.*` keys reused as-is

## 6. Testing

### 6.1 Automated (`WebGLHero.svelte.spec.ts`)

- **Renders headline**: Assert `headline` class element contains translated title
- **Locale AR**: Assert wax seal image src is `/images/etman-wax-ar.png`
- **Locale EN**: Assert wax seal image src is `/images/etman-wax-en.png`
- **Stats present**: Assert all 3 stat labels render
- **CTAs present**: Assert both CTA buttons render with correct href
- **Reduced motion**: Mock `matchMedia` for `prefers-reduced-motion: reduce`, assert canvas wrapper has no animation class

### 6.2 Manual Verification

- WebGL canvas renders honeycomb mesh + particles
- GSAP entrance timeline fires on page load
- Text is legible over canvas (glassmorphism + text-shadow)
- RTL layout renders correctly for Arabic
- Mobile responsive (text stacks, image below)
- `vp check --fix` passes with 0 errors
- `vp build` succeeds
- No console errors or WebGL warnings

## 7. i18n

No new i18n keys required. All existing `hero.*` keys are reused:

- `hero.eyebrow`, `hero.since`, `hero.titleA`, `hero.titleB`
- `hero.subtitle`, `hero.ctaShop`, `hero.ctaDiscover`
- `hero.statProducts`, `hero.statGovernorates`, `hero.statCustomers`
- `hero.sidrAlt`, `hero.imgAlt`

## 8. Rollback

If the WebGL hero causes issues:

1. Revert `src/routes/+page.svelte` import to `import Hero from "$lib/components/Hero.svelte"`
2. Old `Hero.svelte` is untouched and functional
3. Remove `three`, `gsap`, `@types/three` from `package.json`
4. Delete `src/lib/components/hero/` directory
