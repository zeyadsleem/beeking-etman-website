# Cinematic WebGL Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing DOM-based Hero with a full-viewport immersive Three.js + GSAP cinematic hero featuring honeycomb geometry, golden particles, and a staggered entrance animation.

**Architecture:** A `WebGLHero.svelte` component mounts a Three.js canvas (honeycomb mesh + particles) behind a DOM overlay (headline, CTAs, product image, stats). A GSAP timeline orchestrates the entrance. The component lives in `src/lib/components/hero/` alongside its Three.js scene classes.

**Tech Stack:** Svelte 5 (runes), Three.js, GSAP, Tailwind CSS v4, bits-ui (AspectRatio), existing `countUp` action, existing i18n keys.

**Spec:** `docs/superpowers/specs/2026-09-03-cinematic-webgl-hero-design.md`

## Global Constraints

- Svelte 5 runes mode (`$state`, `$effect`, `$derived`, `$props`) — enforced project-wide via `vite.config.ts`
- Tailwind CSS v4 with `@theme inline` tokens from `src/routes/layout.css` — never hardcode colors, always use theme tokens
- TypeScript strict mode — no `any`, explicit return types on shared functions
- Arabic is the default locale (`lang="ar"`), RTL layout
- Existing i18n keys (`hero.*`) must be reused — no new keys
- `@lucide/svelte` for icons (already in project), but existing SVG icons in Hero are fine to keep
- `prefers-reduced-motion: reduce` must be respected — no WebGL animation, no GSAP timeline
- `vp check --fix` must pass with 0 errors before any commit
- `vp build` must succeed

---

### Task 1: Install Dependencies

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (auto-generated)

**Interfaces:**

- Produces: `three`, `gsap`, `@types/three` available in `node_modules`

- [ ] **Step 1: Add three, gsap, and @types/three**

```bash
pnpm add three gsap && pnpm add -D @types/three
```

- [ ] **Step 2: Verify installation**

```bash
pnpm list three gsap @types/three
```

Expected: All three packages listed with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add three, gsap, @types/three for WebGL hero"
```

---

### Task 2: Create HoneycombMesh

**Files:**

- Create: `src/lib/components/hero/HoneycombMesh.ts`

**Interfaces:**

- Consumes: `three` (InstancedMesh, CircleGeometry, MeshStandardMaterial, Matrix4, Vector3, MathUtils)
- Produces: `HoneycombMesh` class with `update(time: number): void` and `dispose(): void`

- [ ] **Step 1: Create the HoneycombMesh class**

```typescript
import * as THREE from "three";

const HEX_SEGMENTS = 6;
const HEX_RADIUS = 0.42;

export class HoneycombMesh {
  readonly mesh: THREE.InstancedMesh;
  private readonly count: number;
  private readonly scales: Float32Array;
  private readonly phases: Float32Array;

  constructor(count: number) {
    this.count = count;
    this.scales = new Float32Array(count);
    this.phases = new Float32Array(count);

    const geo = new THREE.CircleGeometry(HEX_RADIUS, HEX_SEGMENTS);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const spacingX = HEX_RADIUS * 2.1;
    const spacingY = HEX_RADIUS * Math.sqrt(3) * 1.15;

    let idx = 0;
    const cols = Math.ceil(Math.sqrt(count * 1.5));
    const rows = Math.ceil(count / cols);

    for (let row = 0; row < rows && idx < count; row++) {
      for (let col = 0; col < cols && idx < count; col++) {
        const x = (col - cols / 2) * spacingX + (row % 2 === 1 ? spacingX / 2 : 0);
        const y = (row - rows / 2) * spacingY;

        const scale = 0.8 + Math.random() * 0.4;
        this.scales[idx] = scale;
        this.phases[idx] = Math.random() * Math.PI * 2;

        dummy.position.set(x, y, 0);
        dummy.scale.set(scale, scale, 1);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(time: number): void {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.count; i++) {
      const phase = this.phases[i];
      const scale = this.scales[i];
      const yOff = Math.sin(time * 0.5 + phase) * 0.15;

      dummy.position.y = yOff;
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 2: Verify no type errors**

```bash
pnpm run check
```

Expected: 0 new errors related to `HoneycombMesh.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/hero/HoneycombMesh.ts
git commit -m "feat(hero): add instanced honeycomb mesh with breathing displacement"
```

---

### Task 3: Create HoneyParticles

**Files:**

- Create: `src/lib/components/hero/HoneyParticles.ts`

**Interfaces:**

- Consumes: `three` (BufferGeometry, Float32BufferAttribute, PointsMaterial, Points, AdditiveBlending)
- Produces: `HoneyParticles` class with `update(time: number): void` and `dispose(): void`

- [ ] **Step 1: Create the HoneyParticles class**

```typescript
import * as THREE from "three";

const BOUND = 8;

export class HoneyParticles {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly count: number;

  constructor(count: number) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      this.positions[i3] = (Math.random() - 0.5) * BOUND * 2;
      this.positions[i3 + 1] = (Math.random() - 0.5) * BOUND * 2;
      this.positions[i3 + 2] = (Math.random() - 0.5) * BOUND * 2;

      this.velocities[i3] = (Math.random() - 0.5) * 0.001;
      this.velocities[i3 + 1] = 0.001 + Math.random() * 0.002;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.001;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.04,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geo, mat);
  }

  update(time: number): void {
    const pos = this.positions;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      pos[i3] += this.velocities[i3] + Math.sin(time + i) * 0.001;
      pos[i3 + 1] += this.velocities[i3 + 1];
      pos[i3 + 2] += this.velocities[i3 + 2];

      if (pos[i3 + 1] > BOUND) {
        pos[i3 + 1] = -BOUND;
        pos[i3] = (Math.random() - 0.5) * BOUND * 2;
        pos[i3 + 2] = (Math.random() - 0.5) * BOUND * 2;
      }
    }

    const attr = this.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 2: Verify no type errors**

```bash
pnpm run check
```

Expected: 0 new errors related to `HoneyParticles.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/hero/HoneyParticles.ts
git commit -m "feat(hero): add golden particle motes system"
```

---

### Task 4: Create HoneycombScene

**Files:**

- Create: `src/lib/components/hero/HoneycombScene.ts`

**Interfaces:**

- Consumes: `HoneycombMesh` (from Task 2), `HoneyParticles` (from Task 3), `three` (Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, PointLight, Color, ACESFilmicToneMapping, SRGBColorSpace)
- Produces: `HoneycombScene` class with `animate(time: number): void`, `resize(w: number, h: number): void`, `destroy(): void`

- [ ] **Step 1: Create the HoneycombScene class**

```typescript
import * as THREE from "three";
import { HoneycombMesh } from "./HoneycombMesh";
import { HoneyParticles } from "./HoneyParticles";

const BG_COLOR = 0x14120f;
const MOBILE_WIDTH = 640;

export class HoneycombScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly honeycomb: HoneycombMesh;
  private readonly particles: HoneyParticles;
  private rafId = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, reducedMotion: boolean) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const isMobile = w < MOBILE_WIDTH;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG_COLOR);

    this.camera = new THREE.PerspectiveCamera(isMobile ? 55 : 45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 6);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const point = new THREE.PointLight(0xf59e0b, 1.5, 20);
    point.position.set(3, 2, 5);
    this.scene.add(point);

    this.honeycomb = new HoneycombMesh(isMobile ? 25 : 50);
    this.scene.add(this.honeycomb.mesh);

    this.particles = new HoneyParticles(isMobile ? 150 : 400);
    this.scene.add(this.particles.points);

    if (!reducedMotion) {
      this.running = true;
      this.loop();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const t = performance.now() * 0.001;
    this.honeycomb.update(t);
    this.particles.update(t);
    this.renderer.render(this.scene, this.camera);
  };

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  destroy(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.honeycomb.dispose();
    this.particles.dispose();
    this.renderer.dispose();
  }
}
```

- [ ] **Step 2: Verify no type errors**

```bash
pnpm run check
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/hero/HoneycombScene.ts
git commit -m "feat(hero): compose Three.js scene with camera, lights, mesh, particles"
```

---

### Task 5: Create heroEntrance (GSAP Timeline)

**Files:**

- Create: `src/lib/components/hero/heroEntrance.ts`

**Interfaces:**

- Consumes: `gsap` (gsap core)
- Produces: `createEntranceTimeline(el: HeroElements, reduced: boolean): gsap.core.Timeline | null`

- [ ] **Step 1: Create the GSAP timeline factory**

```typescript
import gsap from "gsap";

export interface HeroElements {
  canvasWrap: HTMLElement;
  eyebrow: HTMLElement;
  headline: HTMLElement;
  subtitle: HTMLElement;
  ctaGroup: HTMLElement;
  imageWrap: HTMLElement;
  stats: HTMLElement;
}

export function createEntranceTimeline(
  el: HeroElements,
  reducedMotion: boolean,
): gsap.core.Timeline | null {
  if (reducedMotion) return null;

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  tl.fromTo(el.canvasWrap, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power2.out" })
    .fromTo(el.eyebrow, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, 0.3)
    .fromTo(el.headline, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8 }, 0.6)
    .fromTo(
      el.subtitle,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
      1.0,
    )
    .fromTo(
      el.ctaGroup,
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
      1.3,
    )
    .fromTo(
      el.imageWrap,
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 1.0, ease: "power2.out" },
      1.0,
    )
    .fromTo(
      el.stats,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" },
      1.6,
    );

  return tl;
}
```

- [ ] **Step 2: Verify no type errors**

```bash
pnpm run check
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/hero/heroEntrance.ts
git commit -m "feat(hero): add GSAP entrance timeline for staggered DOM reveal"
```

---

### Task 6: Create WebGLHero.svelte

**Files:**

- Create: `src/lib/components/hero/WebGLHero.svelte`
- Create: `src/lib/components/hero/WebGLHero.svelte.spec.ts`

**Interfaces:**

- Consumes: `HoneycombScene` (Task 4), `createEntranceTimeline` (Task 5), `HeroElements` type (Task 5), `countUp` action (`$lib/actions/countup.svelte`), `t` / `Lang` (`$lib/i18n/messages`), `Button` (`$lib/components/Button.svelte`), `AspectRatio` (`bits-ui`)
- Produces: `WebGLHero` Svelte component — drop-in replacement for `Hero.svelte`

- [ ] **Step 1: Write the spec test**

```typescript
// src/lib/components/hero/WebGLHero.svelte.spec.ts
import { page } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import WebGLHero from "./WebGLHero.svelte";

describe("WebGLHero", () => {
  it("renders the Arabic wax seal for Arabic locale", async () => {
    render(WebGLHero, { props: { lang: "ar", productCount: 5 } });

    await expect
      .element(page.getByTestId("hero-brand-img"))
      .toHaveAttribute("src", "/images/etman-wax-ar.png");
  });

  it("renders the English wax seal for English locale", async () => {
    render(WebGLHero, { props: { lang: "en", productCount: 5 } });

    await expect
      .element(page.getByTestId("hero-brand-img"))
      .toHaveAttribute("src", "/images/etman-wax-en.png");
  });

  it("renders headline, subtitle, and CTA buttons", async () => {
    render(WebGLHero, { props: { lang: "ar", productCount: 3 } });

    await expect.element(page.getByTestId("hero-headline")).toBeInTheDocument();
    await expect.element(page.getByTestId("hero-subtitle")).toBeInTheDocument();
    await expect.element(page.getByTestId("hero-cta-shop")).toBeInTheDocument();
    await expect.element(page.getByTestId("hero-cta-discover")).toBeInTheDocument();
  });

  it("renders all three stats", async () => {
    render(WebGLHero, { props: { lang: "ar", productCount: 10 } });

    await expect.element(page.getByTestId("hero-stat-products")).toBeInTheDocument();
    await expect.element(page.getByTestId("hero-stat-governorates")).toBeInTheDocument();
    await expect.element(page.getByTestId("hero-stat-customers")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm run test:unit -- --run src/lib/components/hero/WebGLHero.svelte.spec.ts
```

Expected: FAIL — component does not exist yet.

- [ ] **Step 3: Create the WebGLHero.svelte component**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { AspectRatio } from "bits-ui";
  import { countUp } from "$lib/actions/countup.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import Button from "$lib/components/Button.svelte";
  import { HoneycombScene } from "./HoneycombScene";
  import { createEntranceTimeline, type HeroElements } from "./heroEntrance";

  let { lang = "ar", productCount }: { lang?: Lang; productCount: number } = $props();

  const mainImage = "/images/Beeking Etman/برطمان السدر المصرى.jpg";

  let canvasEl = $state<HTMLCanvasElement>();
  let canvasWrapEl = $state<HTMLElement>();
  let eyebrowEl = $state<HTMLElement>();
  let headlineEl = $state<HTMLElement>();
  let subtitleEl = $state<HTMLElement>();
  let ctaGroupEl = $state<HTMLElement>();
  let imageWrapEl = $state<HTMLElement>();
  let statsEl = $state<HTMLElement>();

  let reduced = $state(false);
  let scene: HoneycombScene | null = null;

  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (reduced = mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else if (mq.addListener) mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else if (mq.removeListener) mq.removeListener(update);
    };
  });

  onMount(() => {
    if (!canvasEl || !canvasWrapEl) return;

    scene = new HoneycombScene(canvasEl, reduced);

    const els: HeroElements = {
      canvasWrap: canvasWrapEl,
      eyebrow: eyebrowEl!,
      headline: headlineEl!,
      subtitle: subtitleEl!,
      ctaGroup: ctaGroupEl!,
      imageWrap: imageWrapEl!,
      stats: statsEl!,
    };

    const tl = createEntranceTimeline(els, reduced);

    const onResize = () => {
      const w = canvasWrapEl?.clientWidth ?? window.innerWidth;
      const h = canvasWrapEl?.clientHeight ?? window.innerHeight;
      scene?.resize(w, h);
    };

    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      tl?.kill();
      window.removeEventListener("resize", onResize);
      scene?.destroy();
      scene = null;
    };
  });
</script>

<section
  class="relative min-h-screen overflow-hidden"
>
  <!-- WebGL Canvas -->
  <div
    bind:this={canvasWrapEl}
    class="absolute inset-0 -z-10"
    aria-hidden="true"
  >
    <canvas
      bind:this={canvasEl}
      class="h-full w-full"
    ></canvas>
  </div>

  <!-- DOM Content Overlay -->
  <div class="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-8">
    <div class="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
      <!-- Text Column -->
      <div class="flex flex-col gap-6">
        <!-- Wax seal (mobile inline) -->
        <div
          class="pointer-events-none absolute -top-2 end-0 z-10 h-28 w-28 sm:h-36 sm:w-36 lg:hidden"
          aria-hidden="true"
        >
          <img
            data-testid="hero-brand-img"
            src={lang === "ar" ? "/images/etman-wax-ar.png" : "/images/etman-wax-en.png"}
            alt=""
            draggable="false"
            class="h-full w-full select-none"
          />
        </div>

        <!-- Eyebrow -->
        <div bind:this={eyebrowEl} style="opacity: 0">
          <p class="brand-wordmark flex items-center gap-2.5">
            <svg class="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
              <defs>
                <linearGradient id="crown-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="var(--color-amber-400)" />
                  <stop offset="100%" stop-color="var(--color-honey-700)" />
                </linearGradient>
              </defs>
              <path
                d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1Z"
                fill="url(#crown-gradient)"
              />
            </svg>
            {t(lang, "hero.eyebrow")}
          </p>

          <p class="mt-2 flex items-center gap-3 text-sm tracking-wider text-honey-300">
            <span class="h-px w-3 bg-honey-400"></span>
            {t(lang, "hero.since")}
            <span class="h-px w-3 bg-honey-400"></span>
          </p>
        </div>

        <!-- Headline -->
        <div bind:this={headlineEl} style="opacity: 0">
          <h1
            data-testid="hero-headline"
            class="headline text-4xl leading-[1.15] text-parchment sm:text-5xl lg:text-7xl"
            style="text-shadow: 0 2px 20px rgba(20,18,15,0.8)"
          >
            {t(lang, "hero.titleA")}<br />
            <span class="relative inline-block text-honey-400">
              {t(lang, "hero.titleB")}
              <svg
                class="absolute -bottom-3 start-0 h-2.5 w-full text-honey-500"
                viewBox="0 0 200 10"
                preserveAspectRatio="none"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8c50-5 130-6 194-2"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                />
              </svg>
            </span>
          </h1>
        </div>

        <!-- Subtitle (glass panel) -->
        <div bind:this={subtitleEl} style="opacity: 0">
          <p
            data-testid="hero-subtitle"
            class="max-w-md rounded-2xl bg-ink-900/60 px-5 py-3 text-base font-medium leading-relaxed text-parchment/90 backdrop-blur-md sm:text-lg"
          >
            {t(lang, "hero.subtitle")}
          </p>
        </div>

        <!-- CTAs -->
        <div bind:this={ctaGroupEl} class="flex flex-wrap items-center gap-3 sm:gap-4" style="opacity: 0">
          <Button data-testid="hero-cta-shop" variant="primary" href="/products">
            {t(lang, "hero.ctaShop")}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </Button>
          <Button data-testid="hero-cta-discover" variant="outline" href="#categories">
            {t(lang, "hero.ctaDiscover")}
          </Button>
        </div>

        <!-- Stats -->
        <dl
          bind:this={statsEl}
          class="mt-2 grid max-w-lg grid-cols-3 gap-4 sm:gap-6"
          style="opacity: 0"
        >
          <div>
            <dt data-testid="hero-stat-products" class="text-xs font-semibold text-parchment/70">
              {t(lang, "hero.statProducts")}
            </dt>
            <dd class="headline mt-1 text-2xl text-parchment sm:text-3xl" use:countUp={{ target: productCount, lang }}>
              0
            </dd>
          </div>
          <div>
            <dt data-testid="hero-stat-governorates" class="text-xs font-semibold text-parchment/70">
              {t(lang, "hero.statGovernorates")}
            </dt>
            <dd class="headline mt-1 text-2xl text-parchment sm:text-3xl" use:countUp={{ target: 27, lang }}>
              0
            </dd>
          </div>
          <div>
            <dt data-testid="hero-stat-customers" class="text-xs font-semibold text-parchment/70">
              {t(lang, "hero.statCustomers")}
            </dt>
            <dd class="headline mt-1 text-2xl text-parchment sm:text-3xl" use:countUp={{ target: 12000, lang }}>
              0
            </dd>
          </div>
        </dl>
      </div>

      <!-- Product Image Column -->
      <div
        bind:this={imageWrapEl}
        class="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-md"
        style="opacity: 0"
      >
        <!-- Desktop wax seal -->
        <div
          class="absolute -top-9 end-0 z-10 hidden h-36 w-36 lg:block"
          aria-hidden="true"
        >
          <img
            data-testid="hero-brand-img-desktop"
            src={lang === "ar" ? "/images/etman-wax-ar.png" : "/images/etman-wax-en.png"}
            alt=""
            draggable="false"
            class="h-full w-full select-none"
          />
        </div>

        <figure class="relative">
          <div class="absolute inset-0 -z-10 rounded-full bg-honey-400/20 blur-3xl" aria-hidden="true"></div>
          <div class="relative overflow-hidden rounded-t-full rounded-b-2xl border border-honey-600/30 bg-ink-900/40 shadow-warm-lg backdrop-blur-sm lg:rounded-b-[1.5rem]">
            <AspectRatio.Root ratio={4 / 5}>
              <img
                src={mainImage}
                alt={t(lang, "hero.sidrAlt")}
                class="h-full w-full object-cover"
              />
            </AspectRatio.Root>
            <div
              class="pointer-events-none absolute inset-3 rounded-t-full rounded-b-2xl ring-1 ring-inset ring-parchment/20 lg:rounded-b-[1.2rem]"
              aria-hidden="true"
            ></div>
          </div>
        </figure>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm run test:unit -- --run src/lib/components/hero/WebGLHero.svelte.spec.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Run quality gate**

```bash
pnpm run check
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/hero/WebGLHero.svelte src/lib/components/hero/WebGLHero.svelte.spec.ts
git commit -m "feat(hero): add WebGLHero component with canvas, DOM overlay, GSAP entrance"
```

---

### Task 7: Wire Up in +page.svelte

**Files:**

- Modify: `src/routes/+page.svelte:2` (change import)
- Verify: `src/routes/+page.svelte:22` (update component usage)

**Interfaces:**

- Consumes: `WebGLHero` (Task 6)
- Produces: Home page renders the new hero

- [ ] **Step 1: Update the import in +page.svelte**

Change line 2 from:

```svelte
import Hero from "$lib/components/Hero.svelte";
```

to:

```svelte
import Hero from "$lib/components/hero/WebGLHero.svelte";
```

The component name in the template (`<Hero lang={lang} productCount={data.products.length} />`) stays the same — no template changes needed.

- [ ] **Step 2: Verify build succeeds**

```bash
vp build
```

Expected: Build completes successfully.

- [ ] **Step 3: Run full quality gate**

```bash
vp check --fix
```

Expected: 0 errors.

- [ ] **Step 4: Run all unit tests**

```bash
pnpm run test:unit -- --run
```

Expected: All tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(hero): swap home page to WebGLHero component"
```

---

### Task 8: Final Verification

**Files:**

- No file changes — verification only

- [ ] **Step 1: Run vp check for lint/type errors**

```bash
vp check
```

Expected: 0 errors, warnings OK.

- [ ] **Step 2: Run vp build**

```bash
vp build
```

Expected: Build succeeds without errors.

- [ ] **Step 3: Run all unit tests**

```bash
pnpm run test:unit -- --run
```

Expected: All tests pass.

- [ ] **Step 4: Start dev server and visually verify**

```bash
vp dev
```

Manual checks:

- Open `http://localhost:5173` in browser
- WebGL canvas renders dark background with honeycomb mesh + golden particles
- GSAP entrance animation fires (text elements stagger in)
- Headline is legible with text-shadow
- Subtitle has glassmorphism panel
- Product image renders with arched frame
- Stats display with countUp animation
- RTL layout correct for Arabic
- Mobile responsive (test with DevTools responsive mode)
- No console errors or WebGL warnings
- Check `prefers-reduced-motion` in DevTools → all content visible immediately, no canvas animation

- [ ] **Step 5: If all passes, final commit is ready — no additional commit needed**
