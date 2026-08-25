# Blends Game — Phaser 3 Rebuild (Design)

**Date:** 2026-08-25
**Status:** Approved
**Branch:** `feat/blends-phaser-game`
**Supersedes:** [2026-08-23-blends-3d-game-design.md](./2026-08-23-blends-3d-game-design.md)

## Goal

Replace the entire `/blends` game experience — the Threlte/three.js 3D scene **and** the DOM
fallback wizard — with a single Phaser 3 game (`AUTO` renderer: WebGL with automatic Canvas 2D
fallback). Gameplay flow, pricing, cart integration, i18n, and accessibility behavior stay
identical.

## Non-Goals

- No gameplay redesign, scoring, or mini-games.
- No canvas-rendered text: all labels/prices remain DOM (Arabic RTL stays crisp and accessible).
- No binary art assets; no asset pipeline.

## Decisions (from brainstorming)

| Decision | Choice                                                             |
| -------- | ------------------------------------------------------------------ |
| Scope    | Replace everything (3D scene + fallback wizard) with one game      |
| Gameplay | Same flow, new engine                                              |
| Renderer | `Phaser.AUTO` (WebGL → Canvas 2D fallback)                         |
| UI split | Phaser renders the world; Svelte DOM renders all text/commerce UI  |
| Art      | Procedurally generated textures at boot — zero downloads           |
| Approach | New `phaser/` folder inside `blend-lab`; reuse existing logic + UI |

## Architecture

```
src/lib/blend-lab/phaser/
├── BlendGame.svelte      # Svelte bridge component (mount/boot/destroy lifecycle)
├── create-game.ts        # Phaser.Game config factory
├── constants.ts          # SCENE_KEYS, ASSET_KEYS, COLORS, LAYOUT (base 1280×800)
├── bridge.ts             # Typed Svelte↔Phaser bridge
├── textures.ts           # Procedural texture generation helpers
└── scenes/
    ├── BootScene.ts      # Generates textures once → starts LabScene
    └── LabScene.ts       # The single gameplay scene
```

### Kept untouched

- `game-state.svelte.ts` — remains the single source of truth (runes class)
- `pricing.ts`, `stir-math.ts`, `color-mix.ts`, `benefits.ts`, `catalog.ts`
- All `ui/*` components (`StepBar`, `InfoCard`, `MixSummary`, `StirOverlay`, `OrderPanel`)
- `+page.server.ts` catalog loading

### Deleted

- `src/lib/blend-lab/scene/**` (entire Threlte tree)
- `src/routes/blends/FallbackBlends.svelte`
- `src/lib/blend-lab/webgl.ts` + `webgl.spec.ts`
- `static/hdr/` (HDRI only used by three.js)
- Dependencies: `three`, `@threlte/core`, `@threlte/extras`, `@types/three`
- Added dependency: `phaser` (^3.90)

## Communication Model

**Svelte → Phaser.** `BlendGame.svelte` pushes state via `$effect`:

```ts
$effect(() =>
  bridge.setSnapshot({
    step: game.step,
    honeyId: game.honeyId,
    jarSize: game.jarSize,
    doses: { ...game.doses },
    jarFill: game.jarFill,
  }),
);
```

The effect tracks rune reads and forwards a typed immutable snapshot into the scene facade.

**Phaser → Svelte.** The scene receives the `BlendsGame` instance and calls its methods directly
(`selectGoal`, `selectHoney`, `addDose`, `removeDose`, `startStir`, `recordStir`, `finishStir`,
`setJarFill`, `completePour`). Purely visual requests go over a typed emitter:

```ts
type GameToUiEvents =
  | { type: "inspectHoney"; id: BaseHoneyOption["id"] }
  | { type: "inspectAdditive"; key: AdditiveKey }
  | { type: "booted" };
```

No generic stringly-typed EventBus; no polling of runes from engine code.

## Scenes & Gameplay

Base resolution **1280×800**, `Scale.FIT`, page-matched letterbox background.
`prefers-reduced-motion` disables ambient particles and shortens tweens.

All art is generated in `BootScene` with `Graphics.generateTexture`: jar silhouettes, honey
liquids tinted from catalog colors, additive cups, spoon, counter backdrop, soft particle dots.

Steps map to station layouts inside `LabScene` (station objects are plain classes, not scenes):

| Step    | World interaction                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `goal`  | 5 goal plaques on a board; click/tap → `selectGoal(id)`                                                                                                                                                |
| `honey` | Shelf of 5 tinted jars; tap → inspect card + `selectHoney(id)`                                                                                                                                         |
| `prep`  | Bowl on worktable; drag/tap additive cups → `addDose(key)`; dose **removal** happens only through the DOM action bar's − button (`removeDose(key)`)                                                    |
| `stir`  | Circular pointer drag around bowl → per-move angle delta → `recordStir(Δrad)`; spoon follows pointer angle; liquid color lerps via `color-mix.ts` as `mixProgress` rises; `finishStir()` at completion |
| `pour`  | Jar tilt + honey stream particles; fill level → `setJarFill(v)`; `completePour()` when full                                                                                                            |
| `order` | Finished jar presentation, gentle idle animation; DOM `OrderPanel` takes over                                                                                                                          |

Input is scene-owned: a step-keyed handler table routes pointer events; listeners are removed on
scene `shutdown`. Scene/asset keys live in `constants.ts`. `update()` stays orchestration-only.

## Accessibility & E2E Stability

A visually-hidden, focusable DOM action bar mirrors every canvas action (goal chips, honey chips,
dose +/−, stir, pour buttons calling the same `BlendsGame` methods). Keyboard users get real
buttons; Playwright drives these instead of pixel-clicking the canvas.

## Page Wiring

`+page.svelte` drops `hasWebGL()` / `?force2d=1` branching entirely:

- Spinner until the bridge emits `booted`
- On mount/boot failure: inline error message with a link to `/store`
- Dynamic import keeps SSR intact (same pattern as today)

## Error Handling

- Boot failure (no canvas support at all): caught in `BlendGame.svelte` → error state, never silent
- Texture generation wrapped in try/catch → same error state
- WebGL context loss: delegated to Phaser's built-in handling; Canvas renderer unaffected
- SPA navigation: `game.destroy(true)` in the bridge's cleanup (no leaks)

## Testing

| Layer           | Coverage                                                                            |
| --------------- | ----------------------------------------------------------------------------------- |
| Unit (existing) | pricing, stir-math, color-mix, benefits, game-state specs stay green untouched      |
| Unit (new)      | bridge spec: typed events, snapshot forwarding, listener cleanup                    |
| E2E rewrite     | `blends.e2e.ts` against hidden action bar + `[data-testid="blends-scene"]` presence |
| E2E removal     | delete `blends-3d.e2e.ts`                                                           |
| E2E fixup       | remove `?force2d=1` navigation from `store.e2e.ts`                                  |
| Quality gate    | `vp check`, `vp test`                                                               |

## Docs

Update `docs/architecture.md`, `docs/decisions.md`, `docs/todo.md` after implementation.
