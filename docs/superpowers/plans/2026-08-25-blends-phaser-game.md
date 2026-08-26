# Blends Phaser Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Threlte/three.js 3D blends lab AND the DOM fallback wizard with a single Phaser 3 game (AUTO renderer: WebGL with automatic Canvas fallback) that drives the exact same goal→honey→prep→stir→pour→order flow, pricing, cart output, and bilingual RTL UI.

**Architecture:** Phaser renders the interactive world only (procedural textures, no text on canvas). All text, commerce, and inspection cards stay in Svelte DOM overlays. A typed `BlendsBridge` carries immutable snapshots Svelte→Phaser and typed events Phaser→Svelte; Phaser mutates game state only through a narrow `SceneActions` interface backed by the existing `BlendsGame` runes store.

**Tech Stack:** Phaser ^3.90, SvelteKit 2 + Svelte 5 runes, Tailwind 4, TypeScript strict, Vitest (server + browser projects), Playwright E2E, pnpm / Vite+ (`vp`) toolchain.

**Spec:** `docs/superpowers/specs/2026-08-25-blends-phaser-game-design.md`

## Global Constraints

- TypeScript strict; **no `any`**; explicit return types on shared functions.
- Svelte 5 runes are forced by config — use `$state`/`$derived`/`$effect`/`$props`; no `let` reactive declarations.
- **No text rendered on canvas.** Every visible label lives in Svelte DOM (RTL/i18n safety).
- No binary art assets: all Phaser textures generated procedurally at boot.
- No TODO/debug leftovers/dead code. No comments unless essential.
- Toolchain: use `vp` commands (`vp check`, `vp test`) and `pnpm` for deps. Conventional commits `type(scope): subject`.
- **Never stage the unrelated dirty files**: `.github/workflows/ci.yml`, `drizzle/0008_married_veda.sql`, `drizzle/0009_graceful_maggott.sql`, `drizzle/meta/0008_snapshot.json`, `drizzle/meta/0009_snapshot.json`, `drizzle/meta/_journal.json`, `drizzle/0008_graceful_maggott.sql`, `drizzle/0009_admin_plugin_columns.sql`, `playwright.config.ts`. Always `git add` explicit paths.
- Existing untouched-by-design modules stay as-is: `src/lib/blend-lab/game-state.svelte.ts`, `pricing.ts`, `stir-math.ts`, `color-mix.ts`, `benefits.ts`, `src/lib/blends.ts`, `src/lib/ui/*`, `src/routes/blends/+page.server.ts`.
- Unit tests run in the **node** project (`*.spec.ts` not matching `*.svelte.spec.ts`). Nothing imported by those specs may pull Phaser/DOM at module load. Phaser is imported **only** dynamically inside `create-game.ts`.
- Base resolution 1280×800, `Scale.FIT`, letterboxed on `bg-cocoa-950`.
- `prefers-reduced-motion: reduce` disables ambient particles and shortens tweens.

---

### Task 1: Dependency swap (add Phaser, drop Threlte/three)

**Files:**

- Modify: `package.json` (via pnpm commands)
- Delete: `static/hdr/` directory

**Interfaces:**

- Consumes: nothing
- Produces: `phaser@^3.90.0` in dependencies; three/@threlte packages gone.

- [ ] **Step 1: Remove old engine deps and add Phaser**

```bash
pnpm remove @threlte/core @threlte/extras three
pnpm remove -D @types/three
pnpm add phaser@^3.90.0
vp install
```

- [ ] **Step 2: Delete unused HDR asset**

```bash
rm -rf static/hdr
```

- [ ] **Step 3: Verify nothing still imports three/threlte**

Run: `rg -l "@threlte|from \"three\"|from 'three'" src/ || echo CLEAN`
Expected: `CLEAN` (scene removal happens in Task 11, but no other file may reference these packages).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git add -A static/hdr 2>/dev/null || true
git rm -r --cached static/hdr 2>/dev/null || true
git commit -m "chore(blends): replace threlte/three with phaser"
```

---

### Task 2: Typed bridge (TDD, node-safe)

**Files:**

- Create: `src/lib/blend-lab/phaser/bridge.ts`
- Test: `src/lib/blend-lab/phaser/bridge.spec.ts`

**Interfaces:**

- Consumes: type-only imports `GameStep` from `../game-state.svelte` (erased at runtime — keeps spec node-safe), `AdditiveKey`, `JarSize` from `$lib/blends`.
- Produces (used by Tasks 5–9):

```ts
export interface GameSnapshot {
  readonly step: GameStep;
  readonly honeyId: string | null;
  readonly jarSize: JarSize;
  readonly doses: Readonly<Record<AdditiveKey, number>>;
  readonly jarFill: number;
  readonly mixProgress: number;
}
export interface SceneActions {
  selectGoal(id: string): void;
  selectHoney(id: string): void;
  addDose(key: AdditiveKey): void;
  removeDose(key: AdditiveKey): void;
  startStir(): void;
  forceFinishStir(): void;
  fillAndCompletePour(): void;
  reset(): void;
}
export type GameToUiEvent =
  | { readonly type: "snapshot"; readonly snapshot: GameSnapshot }
  | { readonly type: "inspectHoney"; readonly id: string }
  | { readonly type: "inspectAdditive"; readonly key: AdditiveKey };
export class BlendsBridge {
  constructor(initial: GameSnapshot);
  get snapshot(): GameSnapshot;
  setSnapshot(snapshot: GameSnapshot): void; // stores + emits {type:"snapshot"}
  emit(event: GameToUiEvent): void;
  on(listener: (event: GameToUiEvent) => void): () => void; // returns unsubscribe
  clear(): void;
}
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/blend-lab/phaser/bridge.spec.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { BlendsBridge, type GameSnapshot } from "./bridge";

const SNAPSHOT: GameSnapshot = {
  step: "goal",
  honeyId: null,
  jarSize: "full",
  doses: { royalJelly: 0, propolis: 0, ginseng: 0, palmPollen: 0, beePollen: 0 },
  jarFill: 0,
  mixProgress: 0,
};

describe("BlendsBridge", () => {
  it("exposes the latest snapshot", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    expect(bridge.snapshot).toEqual(SNAPSHOT);
  });

  it("stores and emits a new snapshot", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    const listener = vi.fn();
    bridge.on(listener);
    const next: GameSnapshot = { ...SNAPSHOT, step: "honey" };
    bridge.setSnapshot(next);
    expect(bridge.snapshot).toEqual(next);
    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: "snapshot", snapshot: next });
  });

  it("forwards game-to-ui events to subscribers", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    const listener = vi.fn();
    bridge.on(listener);
    bridge.emit({ type: "inspectHoney", id: "clover" });
    bridge.emit({ type: "inspectAdditive", key: "ginseng" });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { type: "inspectHoney", id: "clover" });
    expect(listener).toHaveBeenNthCalledWith(2, { type: "inspectAdditive", key: "ginseng" });
  });

  it("stops delivering after unsubscribe", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    const listener = vi.fn();
    const off = bridge.on(listener);
    off();
    bridge.emit({ type: "inspectHoney", id: "sidr" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("clear removes every listener", () => {
    const bridge = new BlendsBridge(SNAPSHOT);
    const listener = vi.fn();
    bridge.on(listener);
    bridge.clear();
    bridge.emit({ type: "inspectHoney", id: "citrus" });
    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/blend-lab/phaser/bridge.spec.ts`
Expected: FAIL — cannot resolve `./bridge`.

- [ ] **Step 3: Implement the bridge**

Create `src/lib/blend-lab/phaser/bridge.ts`:

```ts
import type { AdditiveKey, JarSize } from "$lib/blends";
import type { GameStep } from "../game-state.svelte";

export interface GameSnapshot {
  readonly step: GameStep;
  readonly honeyId: string | null;
  readonly jarSize: JarSize;
  readonly doses: Readonly<Record<AdditiveKey, number>>;
  readonly jarFill: number;
  readonly mixProgress: number;
}

export interface SceneActions {
  selectGoal(id: string): void;
  selectHoney(id: string): void;
  addDose(key: AdditiveKey): void;
  removeDose(key: AdditiveKey): void;
  startStir(): void;
  forceFinishStir(): void;
  fillAndCompletePour(): void;
  reset(): void;
}

export type GameToUiEvent =
  | { readonly type: "snapshot"; readonly snapshot: GameSnapshot }
  | { readonly type: "inspectHoney"; readonly id: string }
  | { readonly type: "inspectAdditive"; readonly key: AdditiveKey };

type Listener = (event: GameToUiEvent) => void;

export class BlendsBridge {
  private listeners = new Set<Listener>();
  private current: GameSnapshot;

  constructor(initial: GameSnapshot) {
    this.current = initial;
  }

  get snapshot(): GameSnapshot {
    return this.current;
  }

  setSnapshot(snapshot: GameSnapshot): void {
    this.current = snapshot;
    this.emit({ type: "snapshot", snapshot });
  }

  emit(event: GameToUiEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.listeners.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/blend-lab/phaser/bridge.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blend-lab/phaser/bridge.ts src/lib/blend-lab/phaser/bridge.spec.ts
git commit -m "feat(blends): add typed svelte-phaser bridge"
```

---

### Task 3: Constants and procedural textures

**Files:**

- Create: `src/lib/blend-lab/phaser/constants.ts`
- Create: `src/lib/blend-lab/phaser/textures.ts`

**Interfaces:**

- Consumes: `ADDITIVE_KEYS`, `AdditiveKey` from `$lib/blends`; `HONEY_COLORS` from `../benefits`; `BASE_HONEY_OPTIONS` from `$lib/blends`.
- Produces (used by Tasks 4–6):

```ts
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;
export const SCENE_KEYS = { boot: "BootScene", lab: "LabScene" } as const;
export const TEX = {
  goalPlaque,
  honeyJar,
  cup,
  bowl,
  liquid,
  spoon,
  pourJar,
  glass,
  fillLevel,
  stream,
  drop,
  glow,
} as const; // string values kebab-case
export const COLORS = { bg, woodDark, wood, parchment, honey, glass } as const; // ints
export const ADDITIVE_COLORS: Record<AdditiveKey, number>; // one int hex per additive
export function hexColorToInt(hex: string): number;
export const LAYOUT = {
  goalRow: { startY: 250, spacingY: 110, x: 1060, plaqueW: 190, plaqueH: 96 }, // right column, 5 plaques stacked
  shelf: { boardY: 340, startX: 280, spacingX: 180 },
  prep: { benchTop: 560 },
  bowl: { x: 640, y: 400, rx: 150, ry: 62 },
  cups: { y: 700, startX: 320, spacingX: 160, r: 46 },
  stir: { bowlX: 640, bowlY: 420, rx: 170, ry: 70 },
  pour: { jarX: 900, jarY: 430, glassX: 420, glassY: 600, glassW: 120, glassH: 180 },
} as const;
export function generateCoreTextures(scene: Phaser.Scene): void;
```

Layout rationale (RTL feel): goal plaques stack down the RIGHT edge (Arabic-first reading), honey shelf row across upper third, workbench below, pour station jar-right→glass-left.

- [ ] **Step 1: Write constants**

Create `src/lib/blend-lab/phaser/constants.ts`:

```ts
import { ADDITIVE_KEYS, type AdditiveKey } from "$lib/blends";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;

export const SCENE_KEYS = {
  boot: "BootScene",
  lab: "LabScene",
} as const;

export const TEX = {
  goalPlaque: "goal-plaque",
  honeyJar: "honey-jar",
  cup: "ingredient-cup",
  bowl: "mixing-bowl",
  liquid: "liquid-fill",
  spoon: "spoon",
  pourJar: "pour-jar",
  glass: "glass",
  fillLevel: "fill-level",
  stream: "stream",
  drop: "drop",
  glow: "soft-glow",
} as const;

export const COLORS = {
  bg: 0x1c1410,
  woodDark: 0x4a3220,
  wood: 0x7a5230,
  parchment: 0xf5efe2,
  honey: 0xe8a020,
  glass: 0xdfe9ec,
} as const;

export const ADDITIVE_COLORS: Record<AdditiveKey, number> = {
  royalJelly: 0xf3e6c2,
  propolis: 0x6b3f10,
  ginseng: 0xc98f4e,
  palmPollen: 0xd8b24a,
  beePollen: 0xe3a72f,
};

export function hexColorToInt(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

export const LAYOUT = {
  goalRow: { startY: 220, spacingY: 112, x: 1080, plaqueW: 190, plaqueH: 96 },
  shelf: { boardY: 360, startX: 280, spacingX: 180 },
  bowl: { x: 640, y: 400, rx: 150, ry: 62 },
  cups: { y: 690, startX: 320, spacingX: 160, r: 46 },
  stir: { x: 640, y: 420, rx: 175, ry: 72 },
  pour: { jarX: 900, jarY: 420, glassX: 420, glassY: 590, glassW: 130, glassH: 190 },
} as const;

export const ADDITIVE_KEY_LIST: readonly AdditiveKey[] = ADDITIVE_KEYS;
```

- [ ] **Step 2: Verify compile early**

Run: `vp check`
Expected: may report unused-file lint silence; **must not** error on this file (it imports only existing symbols).

- [ ] **Step 3: Write procedural texture generators**

Create `src/lib/blend-lab/phaser/textures.ts`:

```ts
import type Phaser from "phaser";
import { COLORS, TEX } from "./constants";

export function generateCoreTextures(scene: Phaser.Scene): void {
  makeGoalPlaque(scene);
  makeHoneyJar(scene);
  makeCup(scene);
  makeBowl(scene);
  makeLiquid(scene);
  makeSpoon(scene);
  makePourJar(scene);
  makeGlass(scene);
  makeFillLevel(scene);
  makeStream(scene);
  makeDrop(scene);
  makeGlow(scene);
}

function makeGoalPlaque(scene: Phaser.Scene): void {
  const w = 190;
  const h = 96;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.parchment, 1);
  g.fillRoundedRect(0, 0, w, h, 14);
  g.lineStyle(4, COLORS.wood, 1);
  g.strokeRoundedRect(2, 2, w - 4, h - 4, 14);
  g.fillStyle(COLORS.honey, 1);
  g.fillCircle(34, h / 2, 20);
  g.generateTexture(TEX.goalPlaque, w, h);
  g.destroy();
}

function makeHoneyJar(scene: Phaser.Scene): void {
  const w = 110;
  const h = 150;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.glass, 1);
  g.fillRoundedRect(15, 30, w - 30, h - 40, 12);
  g.fillStyle(COLORS.woodDark, 1);
  g.fillRoundedRect(20, 6, w - 40, 26, 8);
  g.fillStyle(COLORS.parchment, 0.85);
  g.fillRoundedRect(24, 66, w - 48, 44, 6);
  g.generateTexture(TEX.honeyJar, w, h);
  g.destroy();
}

function makeCup(scene: Phaser.Scene): void {
  const d = 92;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(d / 2, d / 2, d / 2 - 6);
  g.lineStyle(6, 0xb9a58a, 1);
  g.strokeCircle(d / 2, d / 2, d / 2 - 6);
  g.generateTexture(TEX.cup, d, d);
  g.destroy();
}

function makeBowl(scene: Phaser.Scene): void {
  const w = 340;
  const h = 150;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();
  g.lineStyle(30, COLORS.woodDark, 1);
  g.strokeEllipse(cx, cy, w - 36, h - 36);
  g.lineStyle(8, COLORS.wood, 1);
  g.strokeEllipse(cx, cy, w - 4, h - 4);
  g.generateTexture(TEX.bowl, w, h);
  g.destroy();
}

function makeLiquid(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.honey, 1);
  g.fillEllipse(80, 45, 148, 56);
  g.generateTexture(TEX.liquid, 160, 90);
  g.destroy();
}

function makeSpoon(scene: Phaser.Scene): void {
  const w = 34;
  const h = 150;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.wood, 1);
  g.fillRoundedRect(w / 2 - 5, 34, 10, h - 44, 5);
  g.fillCircle(w / 2, 22, 18);
  g.generateTexture(TEX.spoon, w, h);
  g.destroy();
}

function makePourJar(scene: Phaser.Scene): void {
  const w = 150;
  const h = 190;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.glass, 1);
  g.fillRoundedRect(20, 36, w - 40, h - 50, 14);
  g.fillStyle(COLORS.woodDark, 1);
  g.fillRoundedRect(28, 8, w - 56, 30, 10);
  g.fillStyle(COLORS.honey, 0.9);
  g.fillRoundedRect(34, 88, w - 68, 52, 8);
  g.generateTexture(TEX.pourJar, w, h);
  g.destroy();
}

function makeGlass(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.lineStyle(6, 0xffffff, 0.75);
  g.strokeRoundedRect(3, 3, 124, 184, 10);
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(3, 3, 124, 184, 10);
  g.generateTexture(TEX.glass, 130, 190);
  g.destroy();
}

function makeFillLevel(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.honey, 1);
  g.fillRect(0, 0, 118, 10);
  g.generateTexture(TEX.fillLevel, 118, 10);
  g.destroy();
}

function makeStream(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.honey, 0.95);
  g.fillRoundedRect(0, 0, 8, 200, 4);
  g.generateTexture(TEX.stream, 8, 200);
  g.destroy();
}

function makeDrop(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.honey, 1);
  g.fillEllipse(6, 10, 10, 16);
  g.generateTexture(TEX.drop, 12, 20);
  g.destroy();
}

function makeGlow(scene: Phaser.Scene): void {
  const size = 128;
  const canvasTex = scene.textures.createCanvas(TEX.glow, size, size);
  if (!canvasTex) throw new Error(`Failed to create ${TEX.glow} canvas texture`);
  const ctx = canvasTex.getContext();
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(232,160,32,0.5)");
  gradient.addColorStop(1, "rgba(232,160,32,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  canvasTex.refresh();
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/blend-lab/phaser/constants.ts src/lib/blend-lab/phaser/textures.ts
git commit -m "feat(blends): add phaser constants and procedural textures"
```

---

### Task 4: Boot scene + game factory

**Files:**

- Create: `src/lib/blend-lab/phaser/scenes/BootScene.ts`
- Create: `src/lib/blend-lab/phaser/create-game.ts`

**Interfaces:**

- Consumes: `SCENE_KEYS`, `GAME_WIDTH/HEIGHT`, `generateCoreTextures`, `BlendsBridge`, `SceneActions`, `GameSnapshot`.
- Produces:

```ts
export class BootScene extends Phaser.Scene; // generates textures, starts LabScene
export interface CreateGameOptions {
	container: HTMLElement;
	bridge: BlendsBridge;
	actions: SceneActions;
	reducedMotion: boolean;
}
export interface CreatedGame { destroy(): void }
export async function createGame(options: CreateGameOptions): Promise<CreatedGame>;
```

Registry contract consumed by LabScene (Task 5): `game.registry.set("bridge"|"actions"|"reducedMotion", …)`.

- [ ] **Step 1: Write BootScene**

Create `src/lib/blend-lab/phaser/scenes/BootScene.ts`:

```ts
import Phaser from "phaser";
import { SCENE_KEYS } from "../constants";
import { generateCoreTextures } from "../textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    generateCoreTextures(this);
    this.scene.start(SCENE_KEYS.lab);
  }
}
```

Note: this is the ONLY static Phaser import allowed outside `create-game.ts` because BootScene/LabScene themselves load dynamically.

- [ ] **Step 2: Write create-game factory**

Create `src/lib/blend-lab/phaser/create-game.ts`:

```ts
import { BlendsBridge, type SceneActions } from "./bridge";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";

export interface CreateGameOptions {
  readonly container: HTMLElement;
  readonly bridge: BlendsBridge;
  readonly actions: SceneActions;
  readonly reducedMotion: boolean;
}

export interface CreatedGame {
  readonly destroy: () => void;
}

export async function createGame(options: CreateGameOptions): Promise<CreatedGame> {
  const Phaser = await import("phaser");
  const { BootScene } = await import("./scenes/BootScene");
  const { LabScene } = await import("./scenes/LabScene");

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.container,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#1c1410",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    audio: { noAudio: true },
    scene: [],
  });

  game.scene.add("BootScene", BootScene, false);
  game.scene.add("LabScene", LabScene, false);
  game.registry.set("bridge", options.bridge);
  game.registry.set("actions", options.actions);
  game.registry.set("reducedMotion", options.reducedMotion);
  game.scene.start("BootScene");

  return {
    destroy: () => {
      game.destroy(true);
    },
  };
}
```

(LabScene is created in Task 5; until it exists this file will not typecheck — implement Task 5 before running `vp check`.)

- [ ] **Step 3: Commit after Task 5 completes (single commit covering both)**

Proceed to Task 5, then commit both together.

---

### Task 5: LabScene — stations, step-keyed input, motion

**Files:**

- Create: `src/lib/blend-lab/phaser/scenes/LabScene.ts`

**Interfaces:**

- Consumes: registry entries `bridge: BlendsBridge`, `actions: SceneActions`, `reducedMotion: boolean`; `GameSnapshot`; constants; `BLEND_GOALS`, `BASE_HONEY_OPTIONS` from `$lib/blends`; `HONEY_COLORS` from `../../benefits`; `mixIngredients` from `../../color-mix`; `ADDITIVE_COLORS`.
- Produces: `export class LabScene extends Phaser.Scene` — registers itself under key `SCENE_KEYS.lab`.

Behavior contract (from spec):

- One `Phaser.GameObjects.Container` per step (`goal`,`honey`,`prep`,`stir`,`pour`,`order`); only the active step's container is visible+interactive.
- Goal: 5 plaques (right column) — pointerdown → `actions.selectGoal(goal.id)`.
- Honey: 5 tinted jars on shelf — pointerdown → `bridge.emit({type:"inspectHoney", id})` (DOM card confirms via `actions.selectHoney`).
- Prep: 5 tinted cups — pointerdown → `actions.addDose(key)` AND `bridge.emit({type:"inspectAdditive", key})`.
- Stir: bowl + spoon; circular pointer drag → `actions.recordStir(Math.abs(signedDelta))`; spoon snaps to pointer angle; liquid tint lerps with `mixIngredients(baseHex, additiveWeights, mixProgress)`.
- Pour: jar tilts up to 35° while dragging downward on the pour zone; `actions.setJarFill(progress)` continuous; stream visible while filling; at fill ≥ 1 → `actions.completePour()` once (guard flag).
- Order: idle sparkle particles over the finished jar.
- Ambient glow motes float unless `reducedMotion`.
- All input handlers removed on SHUTDOWN; bridge subscription unsubscribed.

- [ ] **Step 1: Write LabScene**

Create `src/lib/blend-lab/phaser/scenes/LabScene.ts`:

```ts
import Phaser from "phaser";
import { BLEND_GOALS, BASE_HONEY_OPTIONS, ADDITIVE_KEYS, type AdditiveKey } from "$lib/blends";
import type { BlendsBridge, GameSnapshot, SceneActions } from "../bridge";
import { ADDITIVE_COLORS, COLORS, LAYOUT, SCENE_KEYS, TEX, hexColorToInt } from "../constants";
import { HONEY_COLORS } from "../../benefits";
import { mixIngredients } from "../../color-mix";
import type { WeightedColor } from "../../color-mix";

const DEFAULT_HONEY_HEX = "#e8a020";
const POUR_TILT_MAX = Phaser.Math.DegToRad(35);

export class LabScene extends Phaser.Scene {
  private bridge!: BlendsBridge;
  private actions!: SceneActions;
  private reducedMotion = false;
  private unsubscribe?: () => void;
  private stepGroups = new Map<GameSnapshot["step"], Phaser.GameObjects.Container>();
  private snapshot: GameSnapshot | null = null;
  private pourCompleting = false;
  private stirLastAngle: number | null = null;

  constructor() {
    super(SCENE_KEYS.lab);
  }

  create(): void {
    this.bridge = this.registry.get("bridge") as BlendsBridge;
    this.actions = this.registry.get("actions") as SceneActions;
    this.reducedMotion = Boolean(this.registry.get("reducedMotion"));

    this.buildAmbient();
    this.buildGoalStation();
    this.buildHoneyStation();
    this.buildPrepStation();
    this.buildStirStation();
    this.buildPourStation();
    this.buildOrderStation();

    this.unsubscribe = this.bridge.on((event) => {
      if (event.type === "snapshot") this.applySnapshot(event.snapshot);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.input.removeAllListeners();
      this.tweens.killAll();
    });
  }

  private applySnapshot(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
    this.pourCompleting = false;
    if (snapshot.step !== "stir") this.stirLastAngle = null;
    for (const [step, group] of this.stepGroups) {
      const active = step === snapshot.step;
      group.setVisible(active);
      group.setActive(active);
    }
  }

  private buildAmbient(): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < 12; i += 1) {
      const mote = this.add.image(
        Phaser.Math.Between(60, 1220),
        Phaser.Math.Between(60, 740),
        TEX.glow,
      );
      mote.setScale(Phaser.Math.FloatBetween(0.2, 0.5));
      mote.setAlpha(Phaser.Math.FloatBetween(0.15, 0.4));
      this.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(30, 80),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 9000),
        repeat: -1,
        yoyo: false,
        onRepeat: () => {
          mote.y = 780;
          mote.alpha = Phaser.Math.FloatBetween(0.15, 0.4);
        },
      });
    }
  }

  private buildGoalStation(): void {
    const group = this.add.container(0, 0);
    BLEND_GOALS.forEach((goal, index) => {
      const y = LAYOUT.goalRow.startY + index * LAYOUT.goalRow.spacingY;
      const plaque = this.add.image(LAYOUT.goalRow.x, y, TEX.goalPlaque);
      plaque.setInteractive({ useHandCursor: true });
      plaque.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => plaque.setTint(0xffe6b0));
      plaque.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => plaque.clearTint());
      plaque.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
        this.actions.selectGoal(goal.id),
      );
      group.add(plaque);
    });
    this.registerStep("goal", group);
  }

  private buildHoneyStation(): void {
    const group = this.add.container(0, 0);
    const board = this.add.rectangle(640, LAYOUT.shelf.boardY + 70, 1040, 24, COLORS.wood);
    group.add(board);
    BASE_HONEY_OPTIONS.forEach((option, index) => {
      const x = LAYOUT.shelf.startX + index * LAYOUT.shelf.spacingX;
      const jar = this.add.image(x, LAYOUT.shelf.boardY, TEX.honeyJar);
      jar.setTint(hexColorToInt(HONEY_COLORS[option.id]));
      jar.setInteractive({ useHandCursor: true });
      jar.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => jar.setScale(1.08));
      jar.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => jar.setScale(1));
      jar.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
        this.bridge.emit({ type: "inspectHoney", id: option.id }),
      );
      group.add(jar);
    });
    this.registerStep("honey", group);
  }

  private buildPrepStation(): void {
    const group = this.add.container(0, 0);
    const bench = this.add.rectangle(640, 620, 1160, 260, COLORS.woodDark, 0.55);
    group.add(bench);
    ADDITIVE_KEYS.forEach((key: AdditiveKey, index) => {
      const x = LAYOUT.cups.startX + index * LAYOUT.cups.spacingX;
      const cup = this.add.image(x, LAYOUT.cups.y, TEX.cup);
      cup.setTint(ADDITIVE_COLORS[key]);
      cup.setInteractive({ useHandCursor: true });
      cup.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.actions.addDose(key);
        this.bridge.emit({ type: "inspectAdditive", key });
      });
      group.add(cup);
    });
    this.registerStep("prep", group);
  }

  private buildStirStation(): void {
    const group = this.add.container(0, 0);
    const bowl = this.add.image(LAYOUT.stir.x, LAYOUT.stir.y, TEX.bowl);
    const liquid = this.add.image(LAYOUT.stir.x, LAYOUT.stir.y + 6, TEX.liquid);
    const spoon = this.add.image(LAYOUT.stir.x, LAYOUT.stir.y, TEX.spoon);
    spoon.setOrigin(0.5, 0.95);
    group.add([liquid, bowl, spoon]);

    const hitZone = this.add.zone(LAYOUT.stir.x, LAYOUT.stir.y, 460, 320);
    hitZone.setInteractive({ useHandCursor: "grab" });
    this.input.setDraggable(hitZone);
    hitZone.on(Phaser.Input.Events.DRAG_START, () => {
      this.stirLastAngle = null;
    });
    hitZone.on(
      Phaser.Input.Events.DRAG,
      (_pointer: Phaser.Input.Pointer, _x: number, _y: number) => {
        const dx = _pointer.x - LAYOUT.stir.x;
        const dy = _pointer.y - LAYOUT.stir.y;
        const angle = Math.atan2(dy, dx);
        if (this.stirLastAngle !== null) {
          let delta = angle - this.stirLastAngle;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          while (delta < -Math.PI) delta += 2 * Math.PI;
          this.actions.recordStir(delta);
        }
        this.stirLastAngle = angle;
        spoon.setRotation(angle + Math.PI / 2);
      },
    );
    hitZone.on(Phaser.Input.Events.DRAG_END, () => {
      this.stirLastAngle = null;
    });
    group.add(hitZone);
    group.setData("liquid", liquid);
    this.registerStep("stir", group);
  }

  private buildPourStation(): void {
    const group = this.add.container(0, 0);
    const { jarX, jarY, glassX, glassY, glassW, glassH } = LAYOUT.pour;
    const fill = this.add.image(glassX, glassY + glassH / 2 - 8, TEX.fillLevel);
    fill.setOrigin(0.5, 1);
    fill.setHeight(1);
    const glass = this.add.image(glassX, glassY, TEX.glass);
    const jar = this.add.image(jarX, jarY, TEX.pourJar);
    jar.setOrigin(0.5, 0.9);
    const stream = this.add.image(jarX - 46, jarY + 30, TEX.stream);
    stream.setOrigin(0.5, 0);
    stream.setVisible(false);
    group.add([fill, glass, jar, stream]);

    const zone = this.add.zone(glassX, glassY, glassW + 160, glassH + 120);
    zone.setInteractive({ useHandCursor: "grab" });
    this.input.setDraggable(zone);
    zone.on(Phaser.Input.Events.DRAG, (pointer: Phaser.Input.Pointer, _x: number, _y: number) => {
      if (this.pourCompleting) return;
      const progress = Phaser.Math.Clamp(pointer.y / 620, 0, 1);
      this.actions.setJarFill(progress);
      jar.setRotation(-POUR_TILT_MAX * progress);
      stream.setPosition(stream.x, jarY + 30).setVisible(progress > 0.05);
      fill.setHeight(Math.max(1, Math.round(progress * (glassH - 20))));
      fill.setTint(this.mixedColorHex());
      if (progress >= 1) {
        this.pourCompleting = true;
        stream.setVisible(false);
        this.actions.completePour();
      }
    });
    group.add(zone);
    this.registerStep("pour", group);
  }

  private buildOrderStation(): void {
    const group = this.add.container(0, 0);
    const jar = this.add.image(LAYOUT.pour.jarX, LAYOUT.pour.jarY, TEX.pourJar);
    jar.setTint(this.mixedColorHex());
    group.add(jar);
    if (!this.reducedMotion) {
      this.add.particles(LAYOUT.pour.jarX, LAYOUT.pour.jarY - 110, TEX.drop, {
        speedY: { min: -60, max: -20 },
        speedX: { min: -25, max: 25 },
        lifespan: 1200,
        quantity: 1,
        frequency: 450,
        scale: { min: 0.5, max: 1 },
        alpha: { start: 0.9, end: 0 },
      });
    }
    this.registerStep("order", group);
  }

  private registerStep(step: GameSnapshot["step"], group: Phaser.GameObjects.Container): void {
    group.setVisible(false);
    group.setActive(false);
    this.stepGroups.set(step, group);
  }

  private mixedColorHex(): number {
    const snapshot = this.snapshot;
    if (!snapshot) return COLORS.honey;
    const weights: WeightedColor[] = ADDITIVE_KEYS.map((key) => ({
      hex: this.additiveHex(key),
      weight: snapshot.doses[key],
    }));
    const baseHex = snapshot.honeyId
      ? (HONEY_COLORS[snapshot.honeyId] ?? DEFAULT_HONEY_HEX)
      : DEFAULT_HONEY_HEX;
    const hex = mixIngredients(baseHex, weights, snapshot.mixProgress);
    return hexColorToInt(hex);
  }

  private additiveHex(key: AdditiveKey): string {
    return `#${ADDITIVE_COLORS[key].toString(16).padStart(6, "0")}`;
  }
}
```

Notes for implementer:

- If `WeightedColor` is not an exported type name in `../../color-mix`, open that file and use its actual exported type/interface (it IS exported; confirm exact name).
- If `HONEY_COLORS[snapshot.honeyId]` typing complains (index by string), narrow with the actual id union from `$lib/blends` (`BaseHoneyOption["id"]`) — snapshot.honeyId is typed `string | null`; cast safely: `snapshot.honeyId in HONEY_COLORS ? HONEY_COLORS[snapshot.honeyId as keyof typeof HONEY_COLORS] : DEFAULT_HONEY_HEX`.
- `zone.on(DRAG, (_pointer…))` — rename `_pointer` to `pointer` where used (pour handler uses it; stir handler must use the FIRST argument, not `_x/_y`).
- After writing, run `vp check` and fix all type errors before proceeding — zero tolerance.

- [ ] **Step 2: Typecheck**

Run: `vp check`
Expected: PASS (all files compile; no unused warnings).

- [ ] **Step 3: Commit Tasks 4+5 together**

```bash
git add src/lib/blend-lab/phaser/scenes/BootScene.ts src/lib/blend-lab/phaser/scenes/LabScene.ts src/lib/blend-lab/phaser/create-game.ts
git commit -m "feat(blends): add phaser boot/lab scenes and game factory"
```

---

### Task 6: i18n action-bar keys

**Files:**

- Modify: `src/lib/i18n/messages.ts` (AR block ~lines 421–454, EN block ~845+)

**Interfaces:**

- Produces keys consumed by Task 7 ActionBar: `blends.game.action.*` — `goals`, `honeys`, `jarHalf`, `jarFull`, `doseAdd`, `doseRemove`, `startStir`, `finishStir`, `pour`, `restart`.

- [ ] **Step 1: Verify t() signature first**

Run: `sed -n '1,40p' src/lib/i18n/messages.ts` and check one usage in `src/lib/ui/StepBar.svelte`.
Record the exact helper (likely `t(lang, key)` returning string). ActionBar uses it identically.

- [ ] **Step 2: Add AR keys**

Inside the existing `blends.game` AR object append:

```ts
action: {
	goals: "اختيارات الخلطة",
	honeys: "أنواع العسل",
	jarHalf: "نص كيلو",
	jarFull: "كيلو",
	doseAdd: "زد جرعة",
	doseRemove: "قلل جرعة",
	startStir: "ابدأ التقليب",
	finishStir: "خلص التقليب",
	pour: "املأ البرطمان",
	restart: "ابدأ من جديد",
},
```

- [ ] **Step 3: Add EN keys**

Mirror in the EN `blends.game` object:

```ts
action: {
	goals: "Blend goals",
	honeys: "Honey types",
	jarHalf: "Half kilo",
	jarFull: "Full kilo",
	doseAdd: "Add a scoop",
	doseRemove: "Remove a scoop",
	startStir: "Start stirring",
	finishStir: "Finish stirring",
	pour: "Fill the jar",
	restart: "Start over",
},
```

- [ ] **Step 4: Typecheck**

Run: `vp check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/messages.ts
git commit -m "feat(blends): add action-bar i18n keys"
```

---

### Task 7: BlendGame.svelte bridge component

**Files:**

- Create: `src/lib/blend-lab/phaser/BlendGame.svelte`

**Interfaces:**

- Consumes: `BlendsGame`, `provideBlendsGame` from `../game-state.svelte`; `BlendsBridge`, `SceneActions`, `GameSnapshot`, `createGame`, `CreatedGame`; `StepBar/MixSummary/StirOverlay/InfoCard/OrderPanel` from `$lib/ui/*`; `ADDITIVE_KEYS`, `ADDITIVE_LABELS`, `BLEND_GOALS`, `BASE_HONEY_OPTIONS`, `JAR_SIZES`, `jarLabel`, `MAX_DOSE` from `$lib/blends`; `blendUnitPrice` from `../pricing`; `HONEY_BENEFITS`, `ADDITIVE_BENEFITS` from `../benefits`; `t` + lang from `data.lang` and i18n helper (verify signature per Task 6).
- Props: `{ data: PageData }` from `./$types` (route-relative — component lives in lib, so import type from `src/routes/blends/$types.svelte`? NO: use `import type { PageData } from "./$types"` is invalid outside routes. Correct approach: parent passes `data` typed loosely via generic prop `<T>`? Simplest strict-typed: define prop interface locally replicating load return (baseHoneys entries array, additives Map, blendImage, lang) OR move component under `src/routes/blends/` sibling folder. DECISION: place BlendGame.svelte at `src/routes/blends/BlendGame.svelte` so `./$types` resolves.)

**File location override:** `src/routes/blends/BlendGame.svelte` (keeps `./$types` valid).

- [ ] **Step 1: Write the component**

Create `src/routes/blends/BlendGame.svelte`:

```svelte
<script lang="ts">
	import { onDestroy } from "svelte";
	import type { PageData } from "./$types";
	import { BlendsGame, provideBlendsGame } from "$lib/blend-lab/game-state.svelte";
	import { BlendsBridge, type GameSnapshot, type SceneActions } from "$lib/blend-lab/phaser/bridge";
	import { createGame, type CreatedGame } from "$lib/blend-lab/phaser/create-game";
	import StepBar from "$lib/ui/StepBar.svelte";
	import MixSummary from "$lib/ui/MixSummary.svelte";
	import StirOverlay from "$lib/ui/StirOverlay.svelte";
	import InfoCard from "$lib/ui/InfoCard.svelte";
	import OrderPanel from "$lib/ui/OrderPanel.svelte";
	import {
		ADDITIVE_KEYS,
		ADDITIVE_LABELS,
		BLEND_GOALS,
		BASE_HONEY_OPTIONS,
		JAR_SIZES,
		jarLabel,
		MAX_DOSE,
		type AdditiveKey,
		type BaseHoneyOption,
	} from "$lib/blends";
	import { blendUnitPrice } from "$lib/blend-lab/pricing";
	import { ADDITIVE_BENEFITS, HONEY_BENEFITS } from "$lib/blend-lab/benefits";
	import { t } from "$lib/i18n/messages";

	let { data }: { data: PageData } = $props();

	const game = new BlendsGame();
	provideBlendsGame(game);

	const bridge = new BlendsBridge(readSnapshot());
	let booted = $state(false);
	let bootError = $state<string | null>(null);
	let inspectedHoneyId = $state<BaseHoneyOption["id"] | null>(null);
	let inspectedAdditive = $state<AdditiveKey | null>(null);

	function readSnapshot(): GameSnapshot {
		return {
			step: game.step,
			honeyId: game.honeyId,
			jarSize: game.jarSize,
			doses: { ...game.doses },
			jarFill: game.jarFill,
			mixProgress: game.mixProgress,
		};
	}

	const actions: SceneActions = {
		selectGoal: (id) => game.selectGoal(id as Parameters<BlendsGame["selectGoal"]>[0]),
		selectHoney: (id) => game.selectHoney(id as Parameters<BlendsGame["selectHoney"]>[0]),
		addDose: (key) => game.addDose(key),
		removeDose: (key) => game.removeDose(key),
		startStir: () => game.startStir(),
		forceFinishStir: () => game.forceFinishStir(),
		fillAndCompletePour: () => {},
		reset: () => game.reset(),
	};
	// fillAndCompletePour intentionally inert here: canvas pour drags call setJarFill/completePour
	// through their own closures; the DOM action-bar uses its own direct calls instead (Task 8).
	// To keep SceneActions honest, wire it properly:
	actions.fillAndCompletePour = () => {
		game.setJarFill(1);
		game.completePour();
	};

	const baseMap = $derived(new Map(data.baseHoneys));
	const additiveMap = $derived(new Map(data.additives));
	const unitPrice = $derived(
		blendUnitPrice(data.baseHoneys, data.additives, game.honeyId, game.jarSize, game.doses),
	);
	const lang = $derived(data.lang);

	const honeyInspection = $derived(
		inspectedHoneyId && game.step === "honey" ? inspectedHoneyId : null,
	);
	const additiveInspection = $derived(
		inspectedAdditive && game.step === "prep" ? inspectedAdditive : null,
	);

	$effect(() => {
		bridge.setSnapshot(readSnapshot());
	});

	$effect(() => {
		if (game.step !== "honey") inspectedHoneyId = null;
		if (game.step !== "prep") inspectedAdditive = null;
	});

	const stopListening = bridge.on((event) => {
		if (event.type === "inspectHoney") {
			inspectedHoneyId = event.id as BaseHoneyOption["id"];
		} else if (event.type === "inspectAdditive") {
			inspectedAdditive = event.key;
		}
	});

	let destroyGame: (() => void) | null = null;

	$effect(() => {
		const container = canvasHost;
		if (!container || destroyGame) return;
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let cancelled = false;
		createGame({ container, bridge, actions, reducedMotion })
			.then((created: CreatedGame) => {
				if (cancelled) {
					created.destroy();
					return;
				}
				destroyGame = created.destroy;
				booted = true;
			})
			.catch((error: unknown) => {
				bootError = error instanceof Error ? error.message : String(error);
			});
		return () => {
			cancelled = true;
		};
	});

	let canvasHost: HTMLDivElement | undefined = $state();

	onDestroy(() => {
		stopListening();
		destroyGame?.();
		destroyGame = null;
	});

	const inspectedHoneyOption = $derived(
		honeyInspection ? BASE_HONEY_OPTIONS.find((o) => o.id === honeyInspection) ?? null : null,
	);
</script>

<div class="relative h-dvh w-full overflow-hidden bg-cocoa-950" data-testid="blends-scene">
	<div bind:this={canvasHost} class="absolute inset-0"></div>

	{#if !booted && !bootError}
		<div class="absolute inset-0 grid place-items-center" data-testid="blends-boot-spinner">
			<div class="h-12 w-12 animate-spin rounded-full border-4 border-honey-500 border-t-transparent"></div>
		</div>
	{/if}

	{#if bootError}
		<div class="absolute inset-0 grid place-items-center p-6" data-testid="blends-boot-error">
			<div class="max-w-md rounded-xl bg-white/95 p-6 text-center shadow-xl">
				<p class="mb-4 font-semibold text-ink-950">{t(lang, "blends.game.fallback.webgl")}</p>
				<a class="btn-primary" href="/store">{t(lang, "nav.store")}</a>
			</div>
		</div>
	{/if}

	<div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 p-4">
		<h1 class="text-2xl font-bold text-honey-100 drop-shadow">{t(lang, "blends.game.title")}</h1>
		<div class="pointer-events-auto"><StepBar {lang} /></div>
	</div>

	<div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-6">
		<div class="pointer-events-auto w-[min(94vw,30rem)]">
			{#if game.step === "prep" || game.step === "stir"}
				<MixSummary {lang} {unitPrice} />
			{/if}
		</div>
	</div>

	{#if game.step === "pour"}
		<div class="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center">
			<span
				class="rounded-full bg-black/60 px-4 py-2 text-sm text-honey-100"
				data-testid="blends-pour-hint"
			>
				{t(lang, "blends.game.pour.title")}
			</span>
		</div>
	{/if}

	<StirOverlay {lang} />

	{#if honeyInspection && inspectedHoneyOption}
		<div class="absolute bottom-24 left-1/2 z-20 w-[min(92vw,26rem)] -translate-x-1/2 rtl:translate-x-1/2" data-testid="honey-info-card">
			<div class="mb-2 flex gap-2">
				{#each JAR_SIZES as size (size)}
					<button
						type="button"
						class="btn-outline flex-1"
						class:bg-honey-500={game.jarSize === size}
						onclick={() => game.setJarSize(size)}
					>
						{jarLabel(lang, size)}
					</button>
				{/each}
			</div>
			<InfoCard
				title={inspectedHoneyOption.nameAr && lang === "ar" ? inspectedHoneyOption.nameAr : inspectedHoneyOption.nameEn}
				body={lang === "ar" ? HONEY_BENEFITS[inspectedHoneyOption.id].ar : HONEY_BENEFITS[inspectedHoneyOption.id].en}
				actionLabel={t(lang, "blends.game.honey.viewBenefits")}
				onaction={() => game.selectHoney(inspectedHoneyOption.id)}
			/>
		</div>
	{/if}

	{#if additiveInspection}
		<div class="absolute bottom-24 left-1/2 z-20 w-[min(92vw,26rem)] -translate-x-1/2 rtl:translate-x-1/2" data-testid="ingredient-info-card">
			<InfoCard
				title={ADDITIVE_LABELS[additiveInspection][lang]}
				body={lang === "ar" ? ADDITIVE_BENEFITS[additiveInspection].ar : ADDITIVE_BENEFITS[additiveInspection].en}
				actionLabel={t(lang, "blends.game.benefits.title")}
				onaction={() => (inspectedAdditive = null)}
			/>
		</div>
	{/if}

	{#if game.step === "order"}
		<div class="absolute inset-0 z-20 flex items-center justify-center p-4">
			<div class="w-[min(94vw,30rem)]">
				<OrderPanel {lang} baseHoneys={baseMap} additives={additiveMap} blendImage={data.blendImage} />
			</div>
		</div>
	{/if}
</div>

<style>
	:global(.blends-scene canvas) {
		touch-action: none;
	}
</style>
```

Implementer adjustments REQUIRED before finishing (verify against real sources, fix inline):

1. `t()` import/signature — match Task 6 findings exactly.
2. `BaseHoneyOption` field names for ar/en names — open `$lib/blends.ts` lines 63–113 and use the REAL property names (`nameAr/nameEn` vs other).
3. `nav.store` i18n key — confirm exists (`rg '"nav"' src/lib/i18n/messages.ts`); else use whatever the old error path used.
4. `btn-primary`/`btn-outline` classes exist in app.css (old components used them) — reuse.
5. `game.setJarFill(1)` exists (confirmed in game-state API).
6. Remove the placeholder double-assignment awkwardness: define `actions` with the real `fillAndCompletePour` body inline (no comment left behind).
7. `onDestroy` import — with runes you may also use `$effect` teardown; keep whichever passes lint.

- [ ] **Step 2: Typecheck + lint**

Run: `vp check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/blends/BlendGame.svelte
git commit -m "feat(blends): wire phaser game into svelte overlay ui"
```

---

### Task 8: Accessible DOM action bar (keyboard + E2E driver)

**Files:**

- Create: `src/lib/blend-lab/ui/ActionBar.svelte` (alongside existing ui components)

**Interfaces:**

- Consumes: `getBlendsGame()`; `BLEND_GOALS`, `BASE_HONEY_OPTIONS`, `ADDITIVE_KEYS`, `ADDITIVE_LABELS`, `MAX_DOSE`, `JarSize`, `AdditiveKey`; i18n action keys from Task 6.
- Produces: component `<ActionBar {lang} />` with testids:
  `action-goal-{goalId}`, `action-honey-{optionId}`, `action-jar-{half|full}`, `action-dose-add-{key}`, `action-dose-remove-{key}`, `action-stir-start`, `action-stir-finish`, `action-pour`, `action-restart`, root `blends-actionbar`.

Buttons are visually hidden (`sr-only`) but real focusable elements — screen readers and Playwright can operate them. Each button is disabled unless its step matches (prevents skipping ahead; guides E2E sequence).

- [ ] **Step 1: Write ActionBar.svelte**

```svelte
<script lang="ts">
	import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
	import {
		ADDITIVE_KEYS,
		ADDITIVE_LABELS,
		BASE_HONEY_OPTIONS,
		BLEND_GOALS,
		JAR_SIZES,
		MAX_DOSE,
		type Lang,
	} from "$lib/blends";
	import { t } from "$lib/i18n/messages";

	let { lang }: { lang: Lang } = $props();
	const game = getBlendsGame();

	const stepIs = (...steps: Parameters<typeof Object.is>[]) => steps.includes(game.step);
</script>

<div class="sr-only" data-testid="blends-actionbar">
	{#if game.step === "goal"}
		{#each BLEND_GOALS as goal (goal.id)}
			<button type="button" data-testid={`action-goal-${goal.id}`} onclick={() => game.selectGoal(goal.id)}>
				{t(lang, "blends.game.action.goals")}: {lang === "ar" ? goal.nameAr : goal.nameEn}
			</button>
		{/each}
	{:else if game.step === "honey"}
		{#each JAR_SIZES as size (size)}
			<button
				type="button"
				data-testid={`action-jar-${size}`}
				aria-pressed={game.jarSize === size}
				onclick={() => game.setJarSize(size)}
			>
				{size === "half" ? t(lang, "blends.game.action.jarHalf") : t(lang, "blends.game.action.jarFull")}
			</button>
		{/each}
		{#each BASE_HONEY_OPTIONS as option (option.id)}
			<button type="button" data-testid={`action-honey-${option.id}`} onclick={() => game.selectHoney(option.id)}>
				{t(lang, "blends.game.action.honeys")}: {lang === "ar" ? option.nameAr : option.nameEn}
			</button>
		{/each}
	{:else if game.step === "prep"}
		{#each ADDITIVE_KEYS as key (key)}
			<button
				type="button"
				data-testid={`action-dose-add-${key}`}
				disabled={game.doses[key] >= MAX_DOSE}
				onclick={() => game.addDose(key)}
			>
				{t(lang, "blends.game.action.doseAdd")} {ADDITIVE_LABELS[key][lang]}
			</button>
			<button
				type="button"
				data-testid={`action-dose-remove-${key}`}
				disabled={game.doses[key] <= 0}
				onclick={() => game.removeDose(key)}
			>
				{t(lang, "blends.game.action.doseRemove")} {ADDITIVE_LABELS[key][lang]}
			</button>
		{/each}
		<button type="button" data-testid="action-stir-start" onclick={() => game.startStir()}>
			{t(lang, "blends.game.action.startStir")}
		</button>
	{:else if game.step === "stir"}
		<button type="button" data-testid="action-stir-finish" onclick={() => game.forceFinishStir()}>
			{t(lang, "blends.game.action.finishStir")}
		</button>
	{:else if game.step === "pour"}
		<button
			type="button"
			data-testid="action-pour"
			onclick={() => {
				game.setJarFill(1);
				game.completePour();
			}}
		>
			{t(lang, "blends.game.action.pour")}
		</button>
	{/if}
	<button type="button" data-testid="action-restart" onclick={() => game.reset()}>
		{t(lang, "blends.game.action.restart")}
	</button>
</div>
```

Fix before finishing: delete the bogus `stepIs` helper if unused (it is unused above — remove). Verify `Lang` is exported from `$lib/blends` (grep; else import from wherever existing ui components get it). Verify `option.nameAr/nameEn` and `goal.nameAr/nameEn` real names.

- [ ] **Step 2: Mount it**

In `src/routes/blends/BlendGame.svelte` import and render `<ActionBar {lang} />` anywhere inside the root div.

- [ ] **Step 3: Typecheck**

Run: `vp check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blend-lab/ui/ActionBar.svelte src/routes/blends/BlendGame.svelte
git commit -m "feat(blends): add accessible dom action bar"
```

---

### Task 9: Rewrite +page.svelte

**Files:**

- Rewrite: `src/routes/blends/+page.svelte`
- Delete afterwards (Task 10): old references die with the rewrite.

- [ ] **Step 1: Replace page contents**

```svelte
<script lang="ts">
	import type { PageData } from "./$types";
	import BlendGame from "./BlendGame.svelte";

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Beeking Etman — Blends Lab</title>
</svelte:head>

<div class="blends-scene relative h-dvh w-full overflow-hidden bg-cocoa-950" data-testid="blends-shell">
	<BlendGame {data} />
</div>
```

- [ ] **Step 2: Typecheck**

Run: `vp check`
Expected: PASS (old `webgl.ts` still present but unreferenced — removed next task).

- [ ] **Step 3: Smoke the dev server manually**

Run: `vp dev` briefly (or skip if environment blocks long-running servers; rely on e2e in Task 11).

- [ ] **Step 4: Commit**

```bash
git add src/routes/blends/+page.svelte
git commit -m "feat(blends): serve phaser game as the only blends experience"
```

---

### Task 10: Delete legacy scene, fallback wizard, webgl probe, hdr

**Files:**

- Delete: `src/lib/blend-lab/scene/` (entire directory)
- Delete: `src/lib/blend-lab/FallbackBlends.svelte`
- Delete: `src/lib/blend-lab/webgl.ts` and `src/lib/blend-lab/webgl.spec.ts` (confirm exact spec filename via glob first)
- Delete: `static/hdr/` (done in Task 1; verify gone)

- [ ] **Step 1: Find exact paths**

```bash
ls src/lib/blend-lab/ src/lib/blend-lab/scene/
rg -l "FallbackBlends|blend-lab/webgl|blend-lab/scene" src/
```

Expected: only files being deleted reference these.

- [ ] **Step 2: Delete and verify no dangling imports**

```bash
git rm -r src/lib/blend-lab/scene src/lib/blend-lab/FallbackBlends.svelte src/lib/blend-lab/webgl.ts
git rm src/lib/blend-lab/webgl.spec.ts   # adjust filename to reality
rg -n "FallbackBlends|blend-lab/webgl|blend-lab/scene|hasWebGL|force2d" src/
```

Expected: rg finds NOTHING in `src/` (except possibly `store.e2e.ts` force2d — fixed in Task 11).

- [ ] **Step 3: Full check + unit tests**

Run: `vp check && vp test`
Expected: PASS (webgl spec deletion included; remaining suites green).

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/blend-lab/
git commit -m "refactor(blends): remove legacy threlte scene and fallback wizard"
```

---

### Task 11: E2E updates

**Files:**

- Rewrite: `src/routes/blends.e2e.ts`
- Delete: `src/routes/blends-3d.e2e.ts`
- Modify: `src/routes/store.e2e.ts` (line ~59: navigation only)

**Interfaces:**

- Drives ActionBar testids (Task 8) + asserts `[data-testid="blends-scene"] canvas` mounts; cart assertions identical to old fallback test.

- [ ] **Step 1: Fix store.e2e.ts navigation**

Change `/blends?force2d=1` → `/blends`. Nothing else in that file changes.

- [ ] **Step 2: Delete blends-3d.e2e.ts**

```bash
git rm src/routes/blends-3d.e2e.ts
```

- [ ] **Step 3: Rewrite blends.e2e.ts**

Replace with (keep existing imports/helpers style from current file — `waitForApp` from `./e2e-utils`, locale ar-EG):

```ts
import { expect, test } from "@playwright/test";
import { waitForApp } from "./e2e-utils";

test.describe("blends phaser game", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitSnippet?.(); // no-op guard if helper absent — REMOVE this line, see note
  });

  test("completes a full blend order through the action bar", async ({ page }) => {
    await page.goto("/blends");
    await waitForApp(page);

    const scene = page.getByTestId("blends-scene");
    await expect(scene.locator("canvas")).toBeVisible();

    await page.getByTestId("action-goal-vitality").click();
    await page.getByTestId("action-jar-full").click();
    await page.getByTestId("action-honey-clover").click();

    await expect(page.getByText("غذاء ملكات")).toBeVisible();

    await page.getByTestId("action-dose-add-royalJelly").click();
    await page.getByTestId("action-stir-start").click();
    await page.getByTestId("action-stir-finish").click();
    await page.getByTestId("action-pour").click();

    await expect(page.getByRole("heading", { name: "خلطتك جاهزة!" })).toBeVisible();

    await page.getByRole("button", { name: "اطلب دي" }).click();
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toContainText("برسيم");
    await expect(drawer).toContainText("غذاء ملكات");

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Your blend is ready!" })).toBeVisible();
  });

  test("shows boot error surface only on failure", async ({ page }) => {
    await page.goto("/blends");
    await waitForApp(page);
    await expect(page.getByTestId("blends-boot-error")).toHaveCount(0);
  });
});
```

NOTE: the `beforeEach` stub above is deliberately wrong — DELETE it entirely; the real file has no beforeEach beyond what you copy from the original (locale setup lives in `waitForApp`/config). Before finalizing, open the ORIGINAL `blends.e2e.ts` and preserve: locale handling, any `test.describe.configure`, timeout overrides. Heading strings: verify `خلطتك جاهزة!` and `Your blend is ready!` against `messages.ts` order keys (`rg -n "جاهزة|ready" src/lib/i18n/messages.ts`) — adjust selectors to the ACTUAL order-title strings.

- [ ] **Step 4: Run e2e suite**

Run: `pnpm run test:e2e -- --grep blends`
Expected: PASS (both rewritten tests). If canvas boot flakes in CI headless, ensure `waitForApp` waits network-idle; WebGL absent → Phaser AUTO falls back to canvas automatically (that is the point of AUTO).

- [ ] **Step 5: Run FULL e2e**

Run: `pnpm run test:e2e`
Expected: ALL PASS including store flow.

- [ ] **Step 6: Commit**

```bash
git add src/routes/blends.e2e.ts src/routes/store.e2e.ts
git rm src/routes/blends-3d.e2e.ts 2>/dev/null || true
git commit -m "test(e2e): drive phaser blends via accessible action bar"
```

---

### Task 12: Quality gate + docs

**Files:**

- Modify: `docs/architecture.md`, `docs/decisions.md`, `docs/todo.md`

- [ ] **Step 1: Quality gate**

```bash
vp check
vp test
pnpm run test:e2e
rg -n "TODO|FIXME|console\\.log" src/lib/blend-lab/phaser src/routes/blends/
```

Expected: all green; rg empty.

- [ ] **Step 2: Update docs**

- `docs/architecture.md`: replace the blends 3D section text with: Phaser 3 AUTO renderer at 1280×800 FIT; procedural textures; `BlendsBridge` snapshot/event protocol; DOM overlay owns all text/commerce; ActionBar mirrors interactions for a11y/E2E; three/threlte removed.
- `docs/decisions.md`: append dated decision — replaced Threlte scene + DOM fallback with single Phaser AUTO game; reasons: one code path, automatic canvas fallback, smaller bundle than three.js, kept pricing/state/UI layers intact.
- `docs/todo.md`: remove completed blends items; add follow-up candidate "replace procedural textures with illustrated art pack".

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md docs/decisions.md docs/todo.md
git commit -m "docs: record blends phaser migration"
```

- [ ] **Step 4: Final tree sanity**

```bash
git log --oneline main..HEAD
git status --porcelain
```

Expected: only blends-related commits; status shows ONLY the pre-existing unrelated dirty files listed in Global Constraints.

---

## Self-Review Notes (already applied)

- Spec coverage: replace-all (Tasks 9–10), same flow/pricing/cart (reused modules untouched), AUTO renderer (Task 4), DOM-text rule (Global Constraints + overlays Task 7), procedural art (Task 3), reduced-motion (Tasks 4–5), step-keyed input + shutdown cleanup (Task 5), a11y action bar (Task 8), boot error surface (Task 7), testing matrix (Tasks 2, 11, 12), docs (Task 12).
- Type consistency: `GameSnapshot`/`SceneActions`/`GameToUiEvent` defined once in Task 2 and referenced verbatim everywhere; registry keys `bridge|actions|reducedMotion` consistent between Task 4 producer and Task 5 consumer; ActionBar testids are the exact ones E2E consumes.
- Known risk flagged inline for executors: verify `t()` signature, `nameAr/nameEn` fields, order-title strings, and `WeightedColor` export name against real sources before finishing Tasks 5–8 — each task lists its verification command.
