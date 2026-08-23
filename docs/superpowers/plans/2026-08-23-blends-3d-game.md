# Blends 3D Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/blends` as a single continuous realistic 3D game (goal table → honey shelf → prep table with drag-to-bowl → hand stirring with wooden spoon → auto pour → multi-quantity order).

**Architecture:** One Threlte (Three.js) scene driven by a single Svelte-5-runes state machine (`BlendsGame`). Pure logic (state transitions, stir math, color mixing) lives in plain TS modules with vitest unit tests; 3D components are thin visual layers over that state. HTML overlays sit above the canvas for info cards, totals, and ordering. Full fallback to the existing 2D wizard when WebGL is unavailable.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), Threlte v9 (`@threlte/core`, `@threlte/extras`), Three.js, Tailwind 4, vitest, Playwright, Cloudflare Pages (unchanged backend).

**Spec:** `docs/superpowers/specs/2026-08-23-blends-3d-game-design.md`

## Global Constraints

- TypeScript strict; no `any`; explicit return types on exported/shared functions.
- No code comments unless essential; no TODOs/debug leftovers.
- Svelte 5 runes everywhere (`$state`, `$derived`, `$props`) — no legacy stores/reactive syntax in new code.
- Conventional commits (`feat(blends): …`, `test(blends): …`, `docs: …`). Never push; local commits only.
- Package manager: pnpm. Run checks with `pnpm check` (svelte-check) and tests with `pnpm exec vitest run <path>`; full suite via `pnpm test`.
- All user-visible copy bilingual via `$lib/i18n/messages` (`t(lang, key)`); Arabic strings Egyptian-friendly, RTL-safe layout (logical CSS properties).
- Dose rules unchanged: `MAX_DOSE = 3`, presets from `DOSE_FOR`. New: `MAX_ORDER_QTY = 10`.
- Assets CC0-only (Poly Haven) or procedural. No external model downloads beyond Poly Haven/Kenney.
- 3D libs load lazily inside `/blends` route chunk only (`dynamic import`).
- Existing server code (`+page.server.ts`, `orders.ts`, schema) must NOT change.
- Quality gate per task: `pnpm check` passes; new/affected unit tests pass before commit.

## File Structure (target)

```
src/lib/blend-lab/
├── benefits.ts                  # Task 1 — benefit texts + ingredient/honey colors
├── benefits.spec.ts             # Task 1
├── color-mix.ts                 # Task 2 — pure color mixing math
├── color-mix.spec.ts            # Task 2
├── stir-math.ts                 # Task 2 — stir progress math
├── stir-math.spec.ts            # Task 2
├── game-state.svelte.ts         # Task 3 — BlendsGame runes class + context helpers
├── game-state.spec.ts           # Task 3
├── webgl.ts                     # Task 5 — capability probe
├── webgl.spec.ts                # Task 5
├── scene/
│   ├── HoneyScene.svelte        # Task 6 — Canvas root, env, lights
│   ├── CameraRig.svelte         # Task 6 — per-step camera tween
│   ├── stations/
│   │   ├── GoalTable.svelte     # Task 8
│   │   ├── HoneyShelf.svelte    # Task 9
│   │   └── WorkTable.svelte     # Tasks 10–11 (cups, bowl, spoon)
│   │   └── JarStation.svelte    # Task 12 (jar, pour animation)
│   ├── models/
│   │   ├── GlassBowl.svelte     # Task 7
│   │   ├── WoodenSpoon.svelte   # Task 7
│   │   ├── HoneyJar.svelte      # Task 7
│   │   ├── LiquidHoney.svelte   # Task 7 (custom shader)
│   │   └── IngredientCup.svelte # Task 7
│   └── ui/
│   ├── StepBar.svelte           # Task 8 — top step indicator (HTML)
│   ├── InfoCard.svelte          # Task 9/10 — product benefits card
│   ├── MixSummary.svelte        # Task 10 — live composition/total bar
│   ├── StirOverlay.svelte       # Task 11 — progress ring + hint + skip
│   └── OrderPanel.svelte        # Task 12 — composition recap + QuantityPicker + add to cart
├── pricing.ts                   # Task 10 — unit price helper (+ pricing.spec.ts)
src/routes/blends/+page.svelte   # Tasks 5,13 — shell: lazy scene OR fallback (?force2d=1)
src/routes/blends/FallbackBlends.svelte # Task 5 — current wizard preserved as fallback
src/lib/i18n/messages.ts         # Task 4 — blends.game.* keys
```

---

### Task 1: Benefits & color data module

**Files:**

- Create: `src/lib/blend-lab/benefits.ts`
- Create: `src/lib/blend-lab/benefits.spec.ts`

**Interfaces:**

- Consumes: types from `$lib/blends` (`BaseHoneyOption["id"]`, `AdditiveKey`).
- Produces (used by Tasks 9, 10, 12):

```ts
export interface BenefitText {
  ar: string;
  en: string;
}
export const HONEY_BENEFITS: Record<
  "clover" | "citrus" | "marjoram" | "sidr" | "blackseed",
  BenefitText
>;
export const ADDITIVE_BENEFITS: Record<
  "royalJelly" | "propolis" | "ginseng" | "palmPollen" | "beePollen",
  BenefitText
>;
export const HONEY_COLORS: Record<BaseHoneyOption["id"], string>; // hex strings
export const INGREDIENT_COLORS: Record<AdditiveKey, string>; // hex strings
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/blend-lab/benefits.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ADDITIVE_BENEFITS, ADDITIVE_KEYS, BASE_HONEY_OPTIONS, HONEY_BENEFITS } from "$lib/blends";
import { HONEY_COLORS, INGREDIENT_COLORS } from "./benefits";

const HEX = /^#[0-9a-f]{6}$/i;

describe("benefits coverage", () => {
  it("covers every base honey with non-empty ar/en text", () => {
    for (const o of BASE_HONEY_OPTIONS) {
      expect(HONEY_BENEFITS[o.id].ar.length).toBeGreaterThan(20);
      expect(HONEY_BENEFITS[o.id].en.length).toBeGreaterThan(20);
    }
  });

  it("gives every base honey a valid hex color", () => {
    for (const o of BASE_HONEY_OPTIONS) expect(HONEY_COLORS[o.id]).toMatch(HEX);
  });

  it("covers every additive with non-empty ar/en text", () => {
    for (const k of ADDITIVE_KEYS) {
      expect(ADDITIVE_BENEFITS[k].ar.length).toBeGreaterThan(20);
      expect(ADDITIVE_BENEFITS[k].en.length).toBeGreaterThan(20);
    }
  });

  it("gives every additive a valid hex color", () => {
    for (const k of ADDITIVE_KEYS) expect(INGREDIENT_COLORS[k]).toMatch(HEX);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/blend-lab/benefits.spec.ts`
Expected: FAIL — cannot resolve `./benefits` (module missing).

- [ ] **Step 3: Write the implementation**

Create `src/lib/blend-lab/benefits.ts`:

```ts
import type { AdditiveKey, BaseHoneyOption } from "$lib/blends";

export interface BenefitText {
  ar: string;
  en: string;
}

export const HONEY_BENEFITS: Record<BaseHoneyOption["id"], BenefitText> = {
  clover: {
    ar: "عسل البرسيم الكلاسيكي: طعم لطيف محبوب للكل، غني بمضادات الأكسدة الطبيعية ووقود سريع لجسمك.",
    en: "Classic clover honey: a gentle, family-favorite taste rich in natural antioxidants and quick body fuel.",
  },
  citrus: {
    ar: "عسل الموالح المنعش برائحة الليمون والبرتقال، يساعد في تهدئة الحلق ومنح إحساس بالانتعاش.",
    en: "Refreshing citrus honey with lemon-orange aroma; traditionally used to soothe the throat and lift the mood.",
  },
  marjoram: {
    ar: "عسل البردقوش العطري المعروف دعم صحة المعدة والجهاز الهضمي وتخفيف الانتفاخ بعد الأكل.",
    en: "Aromatic marjoram honey, traditionally valued for digestive comfort and easing bloating after meals.",
  },
  sidr: {
    ar: "عسل السدر الفاخر، تاج العسول المصري: قوام كثيف ونكهة غنية، مشهور بدعم المناعة والطاقة العامة.",
    en: "Premium sidr honey, the crown of Egyptian honeys: dense texture and rich flavor, famed for immunity and vitality support.",
  },
  blackseed: {
    ar: "عسل حبة البركة ممزوج ببذرة البركة المباركة، معروف منذ القدم بدعم المناعة والتوازن العام للجسم.",
    en: "Black seed honey blended with blessed nigella seeds, long prized for immune support and overall balance.",
  },
};

export const ADDITIVE_BENEFITS: Record<AdditiveKey, BenefitText> = {
  royalJelly: {
    ar: "غذاء ملكات النحل: وجبة الملكة الوحيدة في الخلية، مصدر مركز لفيتامينات B ومعروف بدعم الطاقة والخصوبة والنشاط الذهني.",
    en: "Royal jelly: the queen bee's exclusive food, a concentrated B-vitamin source known to support energy, fertility and mental sharpness.",
  },
  propolis: {
    ar: "البروبليس: صمغ الخلية المطهّر الذي يحمي النحل من الجراثيم، مشهور بدعم المناعة وتهدئة الحلق والفم.",
    en: "Propolis: the hive's protective resin that keeps bees germ-free, renowned for immune support and soothing throat comfort.",
  },
  ginseng: {
    ar: "جذر الجينسنج: مقوّي الجسم الشهير في الطب الصيني، يساعد على تحمل التعب وزيادة التركيز والقدرة البدنية.",
    en: "Ginseng root: the famous adaptogen of Chinese tradition, helps fight fatigue while boosting focus and physical stamina.",
  },
  palmPollen: {
    ar: "طلع النخل: كنز الطاقة الطبيعي للمتزوجين، غني بالمعادن ومعروف تقليدياً بدعم القوة والحيوية.",
    en: "Palm pollen: nature's energy treasure, mineral-rich and traditionally known for supporting strength and vigor.",
  },
  beePollen: {
    ar: "حبوب اللقاح: غذاء كامل بكل معناه، يجمع بين البروتين والفيتامينات ومضادات الأكسدة لدعم النشاط اليومي.",
    en: "Bee pollen: a true superfood combining protein, vitamins and antioxidants for everyday wellness.",
  },
};

export const HONEY_COLORS: Record<BaseHoneyOption["id"], string> = {
  clover: "#e8a020",
  citrus: "#f0b73a",
  marjoram: "#c97f1d",
  sidr: "#a85a10",
  blackseed: "#6b3a08",
};

export const INGREDIENT_COLORS: Record<AdditiveKey, string> = {
  royalJelly: "#f2ead9",
  propolis: "#8a7a2a",
  ginseng: "#d9b95c",
  palmPollen: "#caa64a",
  beePollen: "#e6b800",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/blend-lab/benefits.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blend-lab/benefits.ts src/lib/blend-lab/benefits.spec.ts
git commit -m "feat(blends): add benefit texts and ingredient colors for 3D game"
```

---

### Task 2: Pure math modules — stir progress & color mixing

**Files:**

- Create: `src/lib/blend-lab/stir-math.ts`
- Create: `src/lib/blend-lab/stir-math.spec.ts`
- Create: `src/lib/blend-lab/color-mix.ts`
- Create: `src/lib/blend-lab/color-mix.spec.ts`

**Interfaces:**

- Consumes: nothing (pure functions).
- Produces (used by Task 3 state machine, Tasks 11 & 12 components):

```ts
// stir-math.ts
export const FULL_STIR_RADIANS: number; // 3 full rotations = 3 * 2*PI
export function normalizeAngleDelta(rad: number): number; // wrap to (-PI, PI]
export function accumulateStir(totalRadians: number, delta: number): number;
export function stirProgress(totalRadians: number): number; // clamp01(|t| / FULL_STIR_RADIANS)
```

```ts
// color-mix.ts
export interface WeightedColor {
  hex: string;
  weight: number;
}
export function hexToRgb(hex: string): [number, number, number];
export function rgbToHex(rgb: [number, number, number]): string;
export function mixIngredients(
  baseHex: string,
  additives: WeightedColor[],
  progress: number,
): string;
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/blend-lab/stir-math.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { accumulateStir, FULL_STIR_RADIANS, normalizeAngleDelta, stirProgress } from "./stir-math";

describe("normalizeAngleDelta", () => {
  it("keeps small deltas unchanged", () => {
    expect(normalizeAngleDelta(0.5)).toBeCloseTo(0.5);
    expect(normalizeAngleDelta(-1.2)).toBeCloseTo(-1.2);
  });

  it("wraps large deltas into (-PI, PI]", () => {
    const wrapped = normalizeAngleDelta(2 * Math.PI + 0.4);
    expect(wrapped).toBeGreaterThan(-Math.PI - 1e-9);
    expect(wrapped).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(Math.abs(wrapped)).toBeCloseTo(0.4, 5);
  });
});

describe("accumulateStir / stirProgress", () => {
  it("accumulates absolute rotation regardless of direction", () => {
    let total = 0;
    for (let i = 0; i < 10; i++) total = accumulateStir(total, 0.6);
    for (let i = 0; i < 5; i++) total = accumulateStir(total, -0.9);
    expect(total).toBeCloseTo(6 - 4.5);
  });

  it("reaches 1 after three full rotations", () => {
    expect(stirProgress(FULL_STIR_RADIANS)).toBe(1);
    expect(stirProgress(FULL_STIR_RADIANS * 2)).toBe(1);
  });

  it("is proportional and clamped at zero", () => {
    expect(stirProgress(FULL_STIR_RADIANS / 2)).toBeCloseTo(0.5);
    expect(stirProgress(-5)).toBe(0);
  });
});
```

Create `src/lib/blend-lab/color-mix.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hexToRgb, mixIngredients, rgbToHex } from "./color-mix";

describe("hex conversions", () => {
  it("round-trips hex colors", () => {
    expect(rgbToHex(hexToRgb("#E8A020"))).toBe("#e8a020");
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });
});

describe("mixIngredients", () => {
  it("returns base color at progress 0 with no additives", () => {
    expect(mixIngredients("#ff0000", [], 0)).toBe("#ff0000");
  });

  it("blends toward weighted additive average as progress rises", () => {
    const base = "#000000";
    const p0 = mixIngredients(base, [{ hex: "#ffffff", weight: 1 }], 0);
    const p1 = mixIngredients(base, [{ hex: "#ffffff", weight: 1 }], 1);
    expect(p0).toBe("#000000");
    expect(p1).toBe("#ffffff");
  });

  it("weights heavier ingredients more than lighter ones", () => {
    const heavy = mixIngredients(
      "#000000",
      [
        { hex: "#ff0000", weight: 3 },
        { hex: "#00ff00", weight: 1 },
      ],
      1,
    );
    const [r, g] = hexToRgb(heavy);
    expect(r).toBeGreaterThan(g * 2);
  });

  it("clamps out-of-range progress", () => {
    expect(mixIngredients("#101010", [], 5)).toBe("#101010");
    expect(mixIngredients("#101010", [{ hex: "#202020", weight: 1 }], -1)).toBe("#101010");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/blend-lab/stir-math.spec.ts src/lib/blend-lab/color-mix.spec.ts`
Expected: FAIL — cannot resolve both modules.

- [ ] **Step 3: Write implementations**

Create `src/lib/blend-lab/stir-math.ts`:

```ts
export const FULL_STIR_RADIANS: number = 3 * Math.PI * 2;

export function normalizeAngleDelta(rad: number): number {
  let r = rad % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

export function accumulateStir(totalRadians: number, delta: number): number {
  return totalRadians + Math.abs(normalizeAngleDelta(delta));
}

export function stirProgress(totalRadians: number): number {
  if (!Number.isFinite(totalRadians) || totalRadians <= 0) return 0;
  return Math.min(1, totalRadians / FULL_STIR_RADIANS);
}
```

Create `src/lib/blend-lab/color-mix.ts`:

```ts
export interface WeightedColor {
  hex: string;
  weight: number;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function hexToRgb(hex: string): [number, number, number] {
  if (!HEX_RE.test(hex)) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(rgb: [number, number, number]): string {
  const part = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

export function mixIngredients(
  baseHex: string,
  additives: WeightedColor[],
  progress: number,
): string {
  const p = clamp01(progress);
  const base = hexToRgb(baseHex);
  const valid = additives.filter((a) => a.weight > 0);
  if (valid.length === 0 || p === 0) return rgbToHex(base);
  const totalWeight = valid.reduce((s, a) => s + a.weight, 0);
  const avg: [number, number, number] = [0, 0, 0];
  for (const a of valid) {
    const c = hexToRgb(a.hex);
    const w = a.weight / totalWeight;
    avg[0] += c[0] * w;
    avg[1] += c[1] * w;
    avg[2] += c[2] * w;
  }
  const mixed: [number, number, number] = [
    base[0] + (avg[0] - base[0]) * p,
    base[1] + (avg[1] - base[1]) * p,
    base[2] + (avg[2] - base[2]) * p,
  ];
  return rgbToHex(mixed);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/blend-lab/stir-math.spec.ts src/lib/blend-lab/color-mix.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blend-lab/stir-math.ts src/lib/blend-lab/stir-math.spec.ts src/lib/blend-lab/color-mix.ts src/lib/blend-lab/color-mix.spec.ts
git commit -m "feat(blends): add stir-progress and honey color mixing math"
```

---

### Task 3: BlendsGame state machine

**Files:**

- Modify: `src/lib/blends.ts` (append `MAX_ORDER_QTY`)
- Create: `src/lib/blend-lab/game-state.svelte.ts`
- Create: `src/lib/blend-lab/game-state.spec.ts`

**Interfaces:**

- Consumes from `$lib/blends`: types `AdditiveKey`, `BaseHoneyOption`, `BlendGoalId`, `JarSize`; consts `ADDITIVE_KEYS`, `MAX_DOSE`, fns `presetDoses`, `zeroDoses`.
- Consumes from Task 2: `accumulateStir`, `stirProgress`.
- Produces (used by Tasks 6–12):

```ts
export type GameStep = "goal" | "honey" | "prep" | "stir" | "pour" | "order";

export class BlendsGame {
  step: GameStep; // $state field
  goal: BlendGoalId | null; // $state
  honeyId: BaseHoneyOption["id"] | null; // $state
  jarSize: JarSize; // $state, default "full"
  doses: Record<AdditiveKey, number>; // $state
  stirTotal: number; // $state, radians accumulated
  jarFill: number; // $state 0..1
  quantity: number; // $state, starts 1
  inspected: AdditiveKey | null; // $state
  readonly mixProgress: number; // getter: stirProgress(stirTotal)
  selectGoal(id: BlendGoalId): void;
  selectHoney(id: BaseHoneyOption["id"] | null): void;
  setInspected(key: AdditiveKey | null): void;
  addDose(key: AdditiveKey, n?: number): void;
  removeDose(key: AdditiveKey): void;
  startStir(): void;
  recordStir(deltaRadians: number): void;
  finishStir(): void; // only advances when mixProgress >= 1
  forceFinishStir(): void; // skip button — always advances to "pour"
  setJarFill(v: number): void;
  completePour(): void; // -> "order"
  setQuantity(q: number, maxQty: number): void; // clamp 1..maxQty (maxQty >= 1 enforced)
  goBack(): boolean; // one step back; false at "goal"/"pour"/"order"
  reset(): void;
}
export function provideBlendsGame(game: BlendsGame): void; // setContext("blendsGame", game)
export function getBlendsGame(): BlendsGame; // getContext or throws
```

Note on `.svelte.ts`: class fields are initialized with `$state(...)` in the class body. Vite processes `.svelte.ts` files with the Svelte compiler, so vitest tests importing this module work unchanged.

- [ ] **Step 1: Write the failing test**

First append to the constants section of `src/lib/blends.ts` (next to `MAX_DOSE`):

```ts
export const MAX_ORDER_QTY = 10;
```

Create `src/lib/blend-lab/game-state.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ADDITIVE_KEYS, MAX_DOSE } from "$lib/blends";
import { BlendsGame } from "./game-state.svelte";

describe("BlendsGame flow", () => {
  it("starts at goal with empty state", () => {
    const g = new BlendsGame();
    expect(g.step).toBe("goal");
    expect(g.goal).toBeNull();
    expect(g.honeyId).toBeNull();
    expect(g.jarFill).toBe(0);
    expect(g.quantity).toBe(1);
  });

  it("selectGoal presets doses and advances to honey", () => {
    const g = new BlendsGame();
    g.selectGoal("immunity");
    expect(g.step).toBe("honey");
    expect(g.goal).toBe("immunity");
    expect(Object.values(g.doses).some((v) => v > 0)).toBe(true);
  });

  it("selectHoney advances to prep; addDose clamps at MAX_DOSE", () => {
    const g = new BlendsGame();
    g.selectGoal("energy");
    g.selectHoney("clover");
    expect(g.step).toBe("prep");
    for (let i = 0; i < 10; i++) g.addDose("propolis");
    expect(g.doses.propolis).toBe(MAX_DOSE);
    g.removeDose("propolis");
    expect(g.doses.propolis).toBe(MAX_DOSE - 1);
  });

  it("finishStir requires completion but forceFinishStir always pours", () => {
    const g = new BlendsGame();
    g.selectGoal("vitality");
    g.selectHoney("sidr");
    g.startStir();
    expect(g.step).toBe("stir");
    g.finishStir();
    expect(g.step).toBe("stir");
    g.forceFinishStir();
    expect(g.step).toBe("pour");
  });

  it("recordStir accumulates progress toward 1", () => {
    const g = new BlendsGame();
    g.selectGoal("vitality");
    g.selectHoney("sidr");
    g.startStir();
    for (let i = 0; i < 20; i++) g.recordStir(0.5);
    expect(g.mixProgress).toBeGreaterThan(0);
  });

  it("completePour moves to order and quantity clamps", () => {
    const g = new BlendsGame();
    g.selectGoal("children");
    g.selectHoney("citrus");
    g.startStir();
    g.forceFinishStir();
    g.setJarFill(1);
    g.completePour();
    expect(g.step).toBe("order");
    g.setQuantity(99, 10);
    expect(g.quantity).toBe(10);
    g.setQuantity(0, 10);
    expect(g.quantity).toBe(1);
  });

  it("goBack walks backwards but never from pour/order/goal", () => {
    const g = new BlendsGame();
    expect(g.goBack()).toBe(false);
    g.selectGoal("digestive");
    g.selectHoney("marjoram");
    expect(g.goBack()).toBe(true);
    expect(g.step).toBe("honey");
    expect(g.goBack()).toBe(true);
    expect(g.step).toBe("goal");
    expect(g.goBack()).toBe(false);
  });

  it("reset returns everything to initial values", () => {
    const g = new BlendsGame();
    g.selectGoal("immunity");
    g.selectHoney("sidr");
    g.reset();
    expect(g.step).toBe("goal");
    expect(g.goal).toBeNull();
    expect(g.honeyId).toBeNull();
    expect(Object.values(g.doses).every((v) => v === 0)).toBe(true);
  });

  it("exposes every additive key in doses", () => {
    const g = new BlendsGame();
    for (const k of ADDITIVE_KEYS) expect(g.doses[k]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/blend-lab/game-state.spec.ts`
Expected: FAIL — cannot resolve `./game-state.svelte`.

- [ ] **Step 3: Implement**

Create `src/lib/blend-lab/game-state.svelte.ts`:

```ts
import { getContext, setContext } from "svelte";
import {
  MAX_DOSE,
  presetDoses,
  zeroDoses,
  type AdditiveKey,
  type BaseHoneyOption,
  type BlendGoalId,
  type JarSize,
} from "$lib/blends";
import { accumulateStir, stirProgress } from "./stir-math";

export type GameStep = "goal" | "honey" | "prep" | "stir" | "pour" | "order";

const CONTEXT_KEY = "blendsGame";

const PREV_STEP: Record<GameStep, GameStep | null> = {
  goal: null,
  honey: "goal",
  prep: "honey",
  stir: "prep",
  pour: null,
  order: null,
};

export class BlendsGame {
  step = $state<GameStep>("goal");
  goal = $state<BlendGoalId | null>(null);
  honeyId = $state<BaseHoneyOption["id"] | null>(null);
  jarSize = $state<JarSize>("full");
  doses = $state<Record<AdditiveKey, number>>(zeroDoses());
  stirTotal = $state(0);
  jarFill = $state(0);
  quantity = $state(1);
  inspected = $state<AdditiveKey | null>(null);

  get mixProgress(): number {
    return stirProgress(this.stirTotal);
  }

  selectGoal(id: BlendGoalId): void {
    this.goal = id;
    this.doses = presetDoses(id, this.jarSize);
    this.step = "honey";
  }

  selectHoney(id: BaseHoneyOption["id"] | null): void {
    this.honeyId = id;
    this.step = "prep";
  }

  setInspected(key: AdditiveKey | null): void {
    this.inspected = key;
  }

  addDose(key: AdditiveKey, n: number = 1): void {
    this.doses[key] = Math.min(MAX_DOSE, this.doses[key] + n);
  }

  removeDose(key: AdditiveKey): void {
    this.doses[key] = Math.max(0, this.doses[key] - 1);
  }

  startStir(): void {
    this.step = "stir";
  }

  recordStir(deltaRadians: number): void {
    this.stirTotal = accumulateStir(this.stirTotal, deltaRadians);
  }

  finishStir(): void {
    if (this.mixProgress >= 1) this.completeStir();
  }

  forceFinishStir(): void {
    this.completeStir();
  }

  private completeStir(): void {
    this.step = "pour";
    this.inspected = null;
  }

  setJarFill(v: number): void {
    this.jarFill = Math.min(1, Math.max(0, v));
  }

  completePour(): void {
    this.step = "order";
  }

  setQuantity(q: number, maxQty: number): void {
    const cap = Math.max(1, maxQty);
    this.quantity = Math.min(cap, Math.max(1, q));
  }

  goBack(): boolean {
    const prev = PREV_STEP[this.step];
    if (prev === null) return false;
    this.step = prev;
    return true;
  }

  reset(): void {
    this.step = "goal";
    this.goal = null;
    this.honeyId = null;
    this.doses = zeroDoses();
    this.stirTotal = 0;
    this.jarFill = 0;
    this.quantity = 1;
    this.inspected = null;
  }
}

export function provideBlendsGame(game: BlendsGame): void {
  setContext(CONTEXT_KEY, game);
}

export function getBlendsGame(): BlendsGame {
  const game = getContext<BlendsGame | undefined>(CONTEXT_KEY);
  if (!game) throw new Error("BlendsGame context missing");
  return game;
}
```

If `pnpm check` reports unused imports (`ADDITIVE_KEYS`, `BASE_HONEY_OPTIONS`, `BLEND_GOALS`, `DOSE_FOR`), remove them — only import what is used above.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/blend-lab/game-state.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm check`
Expected: no new errors.

```bash
git add src/lib/blends.ts src/lib/blend-lab/game-state.svelte.ts src/lib/blend-lab/game-state.spec.ts
git commit -m "feat(blends): add BlendsGame runes state machine for 3D flow"
```

---

### Task 4: i18n keys for the 3D game

**Files:**

- Modify: `src/lib/i18n/messages.ts` — add a `game` sub-object inside BOTH `blends` blocks (ar block and en block)

**Interfaces:**

- Produces keys consumed by Tasks 8–12. Access pattern matches existing code: `t(lang, "blends.game.stirHint")` or direct object access as the file already does.
- Keys and exact strings:

| Key                  | ar value                                                           | en value                                                                     |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `title`              | `مختبر العسل التفاعلي`                                             | `Interactive Honey Lab`                                                      |
| `subtitle`           | `اصنع خلطتك بنفسك من الجدول للبرطمان`                              | `Craft your own blend from table to jar`                                     |
| `back`               | `رجوع`                                                             | `Back`                                                                       |
| `restart`            | `ابدأ من جديد`                                                     | `Start over`                                                                 |
| `skip`               | `تخطي`                                                             | `Skip`                                                                       |
| `step.goal`          | `الهدف`                                                            | `Goal`                                                                       |
| `step.honey`         | `العسل`                                                            | `Honey`                                                                      |
| `step.prep`          | `المكونات`                                                         | `Ingredients`                                                                |
| `step.stir`          | `التحريك`                                                          | `Stirring`                                                                   |
| `step.pour`          | `التعبئة`                                                          | `Pouring`                                                                    |
| `step.order`         | `الطلب`                                                            | `Order`                                                                      |
| `goal.title`         | `إيه هدفك من الخلطة؟`                                              | `What is your blend goal?`                                                   |
| `goal.subtitle`      | `دوس على الهدف المناسب على الطاولة`                                | `Tap the matching card on the table`                                         |
| `honey.title`        | `اختار عسل الأساس`                                                 | `Pick your base honey`                                                       |
| `honey.subtitle`     | `اقترب من الرف ودوس على البرطمان اللي يعجبك`                       | `Move closer to the shelf and tap a jar`                                     |
| `honey.sizeHalf`     | `نص كيلو`                                                          | `Half kg`                                                                    |
| `honey.sizeFull`     | `كيلو`                                                             | `Full kg`                                                                    |
| `honey.viewBenefits` | `شوف الفوائد`                                                      | `View benefits`                                                              |
| `prep.title`         | `حط مكوناتك في الزبادية`                                           | `Add your ingredients to the bowl`                                           |
| `prep.subtitle`      | `اسحب أي كوب وارميه في الزبادية الزجاج`                            | `Drag any cup and drop it into the glass bowl`                               |
| `benefits.title`     | `الفوائد`                                                          | `Benefits`                                                                   |
| `stir.title`         | `حرّك الخلطة بإيدك!`                                               | `Stir the mix yourself!`                                                     |
| `stir.hint`          | `لفّ الماوس أو صبعتك حوالين الزبادية ٣ لفات`                       | `Circle your pointer around the bowl three times`                            |
| `stir.done`          | `تمام! الخلطة بقت متجانسة`                                         | `Perfect! Your blend is fully mixed`                                         |
| `pour.title`         | `بنعبّي البرطمان…`                                                 | `Filling your jar…`                                                          |
| `order.title`        | `خلطتك جاهزة! 🍯`                                                  | `Your blend is ready!`                                                       |
| `order.quantity`     | `عدد البرطمانات`                                                   | `Number of jars`                                                             |
| `order.unitPrice`    | `سعر البرطمان`                                                     | `Per jar`                                                                    |
| `order.total`        | `الإجمالي`                                                         | `Total`                                                                      |
| `order.addToCart`    | `أضف للسلة`                                                        | `Add to cart`                                                                |
| `order.outOfStock`   | `الكمية المتاحة غير كافية`                                         | `Not enough stock available`                                                 |
| `fallback.webgl`     | `جهازك مش بيدعم العرض ثلاثي الأبعاد، ففتحنا لك النسخة الكلاسيكية.` | `Your device does not support 3D, so we opened the classic version for you.` |

- [ ] **Step 1: Add the keys**

Open `src/lib/i18n/messages.ts`. Inside the `ar` translations find the existing `blends` object (~line 286) and append a `game` child object with every Arabic string above keyed exactly as listed (`title`, `subtitle`, `back`, … `fallback.webgl` becomes nested `{ webgl }`). Mirror it inside the `en` `blends` object (~line 574).

- [ ] **Step 2: Verify**

Run: `pnpm check`
Expected: PASS (both language trees have identical key sets; the file's types enforce this if it uses `as const satisfies` — fix any mismatch it reports).

Run a quick sanity test by adding a temporary spec? No — coverage is verified in Task 13's i18n parity check below (add this file now):

Create `src/lib/i18n/messages.spec.ts` ONLY IF no equivalent exists yet (check with `ls src/lib/i18n/`); content:

```ts
import { describe, expect, it } from "vitest";
import { messages } from "./messages";

function flatten(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

describe("i18n parity", () => {
  it("ar and en expose identical key trees", () => {
    expect(flatten(messages.ar).sort()).toEqual(flatten(messages.en).sort());
  });

  it("has all blends.game keys", () => {
    const gameAr = (messages.ar as Record<string, never>)["blends"]["game"];
    expect(Object.keys(gameAr).length).toBeGreaterThanOrEqual(28);
  });
});
```

Adjust imports to the actual export shape after reading `messages.ts` (it may export `t` only — then export a `messages` const too, keeping backward compatibility).

- [ ] **Step 3: Run tests**

Run: `pnpm exec vitest run src/lib/i18n/messages.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/messages.ts src/lib/i18n/messages.spec.ts
git commit -m "feat(blends): add bilingual copy for 3D blend lab"
```

---

### Task 5: Dependencies, WebGL probe, page shell with 2D fallback

**Files:**

- Modify: `package.json` (via pnpm add)
- Create: `src/lib/blend-lab/webgl.ts`
- Create: `src/lib/blend-lab/webgl.spec.ts`
- Create: `src/routes/blends/FallbackBlends.svelte` (moved from current `+page.svelte`)
- Modify: `src/routes/blends/+page.svelte` (becomes thin shell)

**Interfaces:**

- Consumes: current `+page.svelte` implementation (to be moved verbatim into `FallbackBlends.svelte`, props `{ data }`), server data shape unchanged.
- Produces:

```ts
// webgl.ts
export function hasWebGL(): boolean;
```

Page shell behavior: SSR renders nothing game-specific; client mounts → probe WebGL → dynamic-import scene; any failure → fallback. `data-testid="blends-shell"`, fallback wrapper gets `data-testid="blends-fallback"`.

- [ ] **Step 1: Install 3D dependencies**

Run:

```bash
pnpm add -D three @types/three
pnpm add @threlte/core@^9 @threlte/extras@^9 three
```

Note: `three` may already be pulled transitively — installing explicitly at the version resolved by threlte is correct. Verify installed versions:

```bash
pnpm list @threlte/core @threlte/extras three
```

Expected: core/extras ^9.x, three >= r160.

- [ ] **Step 2: Write failing test for webgl probe**

Create `src/lib/blend-lab/webgl.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasWebGL } from "./webgl";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCanvas(contexts: Record<string, unknown>): void {
  const fake = {
    getContext: (type: string): unknown => contexts[type] ?? null,
  };
  vi.stubGlobal("document", {
    ...document,
    createElement: (tag: string): unknown => (tag === "canvas" ? fake : null),
  });
}

describe("hasWebGL", () => {
  it("returns true when webgl2 context is available", () => {
    stubCanvas({ webgl2: {} });
    expect(hasWebGL()).toBe(true);
  });

  it("returns true when only webgl1 is available", () => {
    stubCanvas({ webgl: {} });
    expect(hasWebGL()).toBe(true);
  });

  it("returns false when no context is available", () => {
    stubCanvas({});
    expect(hasWebGL()).toBe(false);
  });

  it("returns false when canvas creation throws", () => {
    vi.stubGlobal("document", {
      createElement: (): never => {
        throw new Error("boom");
      },
    });
    expect(hasWebGL()).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm exec vitest run src/lib/blend-lab/webgl.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement probe**

Create `src/lib/blend-lab/webgl.ts`:

```ts
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
```

Run tests again → PASS.

- [ ] **Step 5: Extract current wizard as fallback**

Create `src/routes/blends/FallbackBlends.svelte`: copy the ENTIRE current implementation of `src/routes/blends/+page.svelte` into it, changing the top to accept data via props:

```svelte
<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  /* ...rest of the existing script exactly as it was,
     replacing every `data.` reference accordingly (they already match) ... */
```

Keep all markup/styles unchanged. Do NOT delete the original file yet — next step replaces its content.

- [ ] **Step 6: Replace page shell**

Rewrite `src/routes/blends/+page.svelte` as:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import FallbackBlends from "./FallbackBlends.svelte";
  import { hasWebGL } from "$lib/blend-lab/webgl";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  type SceneComponent = import("$lib/blend-lab/scene/HoneyScene.svelte").default;

  let mode: "loading" | "game" | "fallback" = $state(
    typeof window === "undefined" ? "loading" : "loading",
  );
  let Scene: SceneComponent | null = $state(null);

  onMount(() => {
    if (!hasWebGL()) {
      mode = "fallback";
      return;
    }
    import("$lib/blend-lab/scene/HoneyScene.svelte")
      .then((m) => {
        Scene = m.default;
        mode = "game";
      })
      .catch((err) => {
        console.error("3D scene failed to load", err);
        mode = "fallback";
      });
  });
</script>

<svelte:head>
  <title>Beeking & Etman</title>
</svelte:head>

<div class="relative min-h-dvh bg-parchment" data-testid="blends-shell">
  {#if mode === "game" && Scene}
    <Scene {data} />
  {:else if mode === "fallback"}
    <p
      class="mx-auto max-w-xl px-4 pt-6 text-center text-sm text-cocoa-700"
      data-testid="webgl-fallback-message"
    >
      {t(data.lang, "blends.game.fallback.webgl")}
    </p>
    <div data-testid="blends-fallback">
      <FallbackBlends {data} />
    </div>
  {:else}
    <div class="grid min-h-dvh place-items-center">
      <span class="h-10 w-10 animate-spin rounded-full border-4 border-honey-500 border-t-transparent"></span>
    </div>
  {/if}
</div>
```

Import `t` alongside the i18n convention already used in the repo (`import { t } from "$lib/i18n/messages"`) and confirm `cocoa-700`/`honey-500` exist in the Tailwind theme (use nearest existing tokens otherwise).

NOTE: Task 6 creates HoneyScene.svelte. Until then `pnpm check` will fail on the missing import — create a minimal placeholder in this task:

Create `src/lib/blend-lab/scene/HoneyScene.svelte` (placeholder, replaced in Task 6):

```svelte
<script lang="ts">
  import FallbackBlends from "../../routes/blends/FallbackBlends.svelte";
  import type { PageData } from "../../../routes/blends/$types";

  let { data }: { data: PageData } = $props();
</script>

<FallbackBlends {data} />
```

Importing a route file from lib is temporary ONLY for typecheck survival; Task 6 replaces this whole file. If svelte-check complains about cross-boundary imports, instead duplicate the shell logic inline here for one commit — acceptable because Task 6 deletes it.

- [ ] **Step 7: Verify + commit**

Run: `pnpm check && pnpm exec vitest run src/lib/blend-lab/webgl.spec.ts`
Expected: PASS both.
Manual: `pnpm dev` → open `/blends` → classic wizard still works (now inside shell).

```bash
git add package.json pnpm-lock.yaml src/lib/blend-lab/webgl.ts src/lib/blend-lab/webgl.spec.ts src/routes/blends/ src/lib/blend-lab/scene/HoneyScene.svelte
git commit -m "feat(blends): lazy-load 3D blend lab with classic-wizard fallback"
```

---

### Task 6: HoneyScene root + CameraRig + environment

**Files:**

- Create: `src/lib/blend-lab/scene/HoneyScene.svelte` (replaces placeholder)
- Create: `src/lib/blend-lab/scene/CameraRig.svelte`
- Modify: `src/routes/blends/+page.svelte` (remove temporary import note if any)

**Interfaces:**

- Consumes: Task 3 (`BlendsGame`, `provideBlendsGame`, `getBlendsGame`), Task 4 i18n keys.
- Produces: `HoneyScene.svelte` with `let { data }: { data: PageData } = $props()` — creates ONE `new BlendsGame()`, provides it via context, renders `<Canvas>` plus all stations (imported as empty stubs in this task, filled by Tasks 8–12) and HTML overlays. Stations receive nothing via props — they call `getBlendsGame()` themselves.

Camera positions (world units; scene layout fixed here):

```ts
// src/lib/blend-lab/scene/cameras.ts
import type { GameStep } from "$lib/blend-lab/game-state.svelte";

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export const STEP_CAMERAS: Record<GameStep, CameraPose> = {
  goal: { position: [0, 2.2, 4.2], target: [0, 0.9, -2.5] },
  honey: { position: [-3.4, 1.8, 1.2], target: [-3.4, 1.1, -3.0] },
  prep: { position: [0.0, 2.6, 2.6], target: [0, 0.8, 0] },
  stir: { position: [0, 2.9, 1.7], target: [0, 0.75, 0] },
  pour: { position: [2.8, 1.6, 2.2], target: [1.6, 0.7, 0] },
  order: { position: [1.6, 1.4, 1.9], target: [1.6, 0.8, 0] },
};
```

Station anchor positions (document for Tasks 8–12): goal table at `[0, 0, -2.5]`; honey shelf at `[-3.4, 0, -3.0]`; work table (bowl) at origin; jar station at `[1.6, 0, 0]`.

- [ ] **Step 1: Download environment asset**

From https://polyhaven.com/a/studio_small_09 (or another warm studio HDRI, CC0): download the **1k HDR** file and save to `static/hdr/studio.hdr`. If download tooling is unavailable, use any CC0 warm studio HDR and document its source in the commit message.

- [ ] **Step 2: Implement cameras module**

Create `src/lib/blend-lab/scene/cameras.ts` with the exact content above.

- [ ] **Step 3: Implement CameraRig**

Create `src/lib/blend-lab/scene/CameraRig.svelte`. Threlte v9 API notes: `useThrelte()` returns `{ camera }`; `useFrame(cb)` runs per frame. Hand-rolled damped lerp (no tween dep):

```svelte
<script lang="ts">
  import { useFrame, useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { STEP_CAMERAS } from "./cameras";

  const game = getBlendsGame();
  const { camera } = useThrelte();

  const currentTarget = new THREE.Vector3(...STEP_CAMERAS.goal.target);
  const tmpPos = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();

  const ease = (t: number): number => t * t * (3 - 2 * t);

  useFrame((delta) => {
    const pose = STEP_CAMERAS[game.step];
    if (!pose) return;
    const k = Math.min(1, delta * 2.5);
    camera.position.lerp(tmpPos.set(...pose.position), ease(k));
    currentTarget.lerp(tmpTarget.set(...pose.target), ease(k));
    camera.lookAt(currentTarget);
  });
</script>
```

Respect reduced motion: read `prefers-reduced-motion` once on mount; when true snap instantly (`k = 1`). Add:

```ts
let instant = false;
$effect(() => {
  instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
});
```

…and use `const k = instant ? 1 : Math.min(1, delta * 2.5);`

- [ ] **Step 4: Implement HoneyScene root**

Replace `src/lib/blend-lab/scene/HoneyScene.svelte` entirely:

```svelte
<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { Environment, Preview } from "@threlte/extras";
  import type { PageData } from "../../../routes/blends/$types";
  import { BlendsGame, provideBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import CameraRig from "./CameraRig.svelte";

  let { data }: { data: PageData } = $props();

  const game = new BlendsGame();
  provideBlendsGame(game);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
</script>

<div class="relative h-dvh w-full overflow-hidden bg-cocoa-950" data-testid="blends-scene">
  <Canvas frameloop={reducedMotion ? "demand" : "always"} dpr={[1, 2]}>
    <Environment files="/hdr/studio.hdr" />
    <ambientLight intensity={0.35} />
    <directionalLight position={[4, 6, 3]} intensity={1.4} castShadow />
    <CameraRig />
    <!-- Stations are added in Tasks 8–12 -->
    <Preview />
  </Canvas>

  <!-- HTML overlay layer -->
  <div class="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
    <header class="text-center text-parchment">
      <h1 class="headline text-2xl font-bold drop-shadow">{data.lang === "ar" ? "مختبر العسل التفاعلي" : "Interactive Honey Lab"}</h1>
    </header>
  </div>
</div>
```

Notes:

- `<Preview />` from `@threlte/extras` shows a small perf/stats overlay during development only — remove before final commit of Task 13.
- Verify actual export names against installed @threlte/extras v9 docs (`node_modules/@threlte/extras/dist` or viteplus node_modules docs). If `Preview` does not exist, omit that line.
- `dpr={[1, 2]}` caps device pixel ratio per spec.

- [ ] **Step 5: Wire smoke verification**

Run: `pnpm check`
Expected: PASS.

Manual (`pnpm dev`, open `/blends`):

1. Scene renders with HDRI lighting, no console errors.
2. Camera sits at the "goal" pose.
3. Fallback path still works by temporarily forcing `mode="fallback"` — then revert.

- [ ] **Step 6: Commit**

```bash
git add src/lib/blend-lab/scene/ static/hdr/
git commit -m "feat(blends): add Threlte scene root, camera rig and studio HDRI"
```

---

### Task 7: Procedural models — glass bowl, wooden spoon, jar, liquid honey shader, ingredient cup

**Files:**

- Create: `src/lib/blend-lab/scene/models/GlassBowl.svelte`
- Create: `src/lib/blend-lab/scene/models/WoodenSpoon.svelte`
- Create: `src/lib/blend-lab/scene/models/HoneyJar.svelte`
- Create: `src/lib/blend-lab/scene/models/LiquidHoney.svelte`
- Create: `src/lib/blend-lab/scene/models/IngredientCup.svelte`

**Interfaces:**

- Consumes: Task 1 colors (`HONEY_COLORS`, `INGREDIENT_COLORS`), Task 2 (`mixIngredients`), Task 3 game state (via `getBlendsGame()` in LiquidHoney).
- Produces components with these exact props:

```ts
// GlassBowl.svelte
let { radius = 0.55, height = 0.5 }: { radius?: number; height?: number } = $props();

// WoodenSpoon.svelte  (parent animates position/rotation via the wrapper group)
let { length = 0.9 }: { length?: number } = $props();

// HoneyJar.svelte
let {
  scale = 1,
  fillLevel = 0.75, // 0..1 visual fill of honey inside
  color = "#e8a020",
}: { scale?: number; fillLevel?: number; color?: string } = $props();

// LiquidHoney.svelte — lives INSIDE GlassBowl coordinates; reads game state itself
// (no props; uses getBlendsGame())

// IngredientCup.svelte
let { color, label }: { color: string; label: string } = $props();
```

All models are procedural Three.js geometry through Threlte `<T>` components. No GLTF downloads.

- [ ] **Step 1: GlassBowl**

Realistic glass: lathe profile + `MeshPhysicalMaterial` transmission.

```svelte
<script lang="ts">
  import { T } from "@threlte/core";
  import * as THREE from "three";

  let { radius = 0.55, height = 0.5 }: { radius?: number; height?: number } =
    $props();

  const points: THREE.Vector2[] = [];
  const segments = 12;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = radius * Math.sin((t * Math.PI) / 2) ** 0.6;
    points.push(new THREE.Vector2(Math.max(r, 0.02), t * height));
  }
  const geometry = new THREE.LatheGeometry(points, 48);
</script>

<T.Mesh {geometry} castShadow receiveShadow>
  <T.MeshPhysicalMaterial
    color="#ffffff"
    transmission={0.95}
    thickness={0.05}
    roughness={0.06}
    ior={1.5}
    transparent
    opacity={0.4}
    side={THREE.DoubleSide}
  />
</T.Mesh>
```

- [ ] **Step 2: WoodenSpoon**

```svelte
<script lang="ts">
  import { T } from "@threlte/core";
  import * as THREE from "three";

  let { length = 0.9 }: { length?: number } = $props();

  const handleGeo = new THREE.CylinderGeometry(0.03, 0.035, length * 0.7, 16);
  const bowlGeo = new THREE.SphereGeometry(0.11, 24, 16);
</script>

<T.Group>
  <T.Mesh
    geometry={handleGeo}
    position={[0, length * 0.35, 0]}
    rotation={[Math.PI / 2, 0, 0]}
    castShadow
  >
    <T.MeshStandardMaterial color="#8b5a2b" roughness={0.65} metalness={0} />
  </T.Mesh>
  <T.Mesh geometry={bowlGeo} scale={[1, 0.45, 1]} castShadow>
    <T.MeshStandardMaterial color="#a06a33" roughness={0.55} />
  </T.Mesh>
</T.Group>
```

- [ ] **Step 3: HoneyJar**

Cylindrical glass jar + inner honey cylinder scaled by `fillLevel` + metal lid:

```svelte
<script lang="ts">
  import { T } from "@threlte/core";

  let {
    scale = 1,
    fillLevel = 0.75,
    color = "#e8a020",
  }: { scale?: number; fillLevel?: number; color?: string } = $props();

  const H = 0.62;
  const R = 0.22;
  const innerH = H * 0.85;
</script>

<T.Group {scale}>
  <T.Mesh position={[0, H / 2, 0]} castShadow>
    <T.CylinderGeometry args={[R, R, H, 32]} />
    <T.MeshPhysicalMaterial
      color="#ffffff"
      transmission={0.92}
      roughness={0.08}
      ior={1.5}
      thickness={0.04}
      transparent
      opacity={0.5}
    />
  </T.Mesh>

  <T.Mesh position={[0, 0.02 + (innerH * fillLevel) / 2, 0]}>
    <T.CylinderGeometry args={[R - 0.02, R - 0.02, Math.max(innerH * fillLevel, 0.001), 32]} />
    <T.MeshPhysicalMaterial {color} roughness={0.25} clearcoat={0.6} />
  </T.Mesh>

  <T.Mesh position={[0, H + 0.03, 0]} castShadow>
    <T.CylinderGeometry args={[R + 0.02, R + 0.02, 0.07, 32]} />
    <T.MeshStandardMaterial color="#c9930a" roughness={0.35} metalness={0.7} />
  </T.Mesh>
</T.Group>
```

- [ ] **Step 4: LiquidHoney shader**

Custom ShaderMaterial driven by game state. Uniforms per spec: `uBaseColor`, `uAdditiveColors[5]`, `uAdditiveWeights[5]`, `uMixProgress`, `uFill`, `uTime`, `uStirVelocity`.

Create `src/lib/blend-lab/scene/models/LiquidHoney.svelte`:

```svelte
<script lang="ts">
  import { T } from "@threlte/core";
  import { useFrame } from "@threlte/core";
  import * as THREE from "three";
  import { ADDITIVE_KEYS } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { HONEY_COLORS, INGREDIENT_COLORS } from "$lib/blend-lab/benefits";
  import { hexToRgb, mixIngredients } from "$lib/blend-lab/color-mix";

  const game = getBlendsGame();
  const BOWL_R = 0.5;
  const BOWL_H = 0.42;

  const uniforms = {
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(HONEY_COLORS.clover) },
    uSurfaceColor: { value: new THREE.Color(HONEY_COLORS.clover) },
    uFill: { value: 0 },
    uStirVelocity: { value: 0 },
  };

  useFrame(({ clock }, delta) => {
    uniforms.uTime.value = clock.elapsedTime;
    const baseId = game.honeyId ?? "clover";
    uniforms.uBaseColor.value.set(HONEY_COLORS[baseId]);

    const weighted = ADDITIVE_KEYS.map((k) => ({
      hex: INGREDIENT_COLORS[k],
      weight: game.doses[k],
    }));
    uniforms.uSurfaceColor.value.set(
      mixIngredients(HONEY_COLORS[baseId], weighted, game.mixProgress),
    );
    uniforms.uFill.value += (game.jarFill - uniforms.uFill.value) * delta * 4;
    uniforms.uStirVelocity.value +=
      (game.stirTotal - lastTotal) * 8 - uniforms.uStirVelocity.value * delta * 6;
    lastTotal = game.stirTotal;
  });

  let lastTotal = 0;

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uStirVelocity;
    varying vec2 vUv;
    varying vec3 vNormalW;

    void main() {
      vUv = uv;
      vec3 p = position;
      float ripple = sin(p.x * 18.0 + uTime * 4.0) *
                     cos(p.z * 15.0 - uTime * 3.0);
      p.y += ripple * 0.008 * (0.4 + uStirVelocity);
      vNormalW = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uSurfaceColor;
    uniform float uTime;
    uniform float uStirVelocity;
    varying vec2 vUv;
    varying vec3 vNormalW;

    void main() {
      float swirl = smoothstep(0.35, 0.65, sin(vUv.x * 40.0 +
        vUv.y * 12.0 + uTime * (1.5 + uStirVelocity * 2.0)) * 0.5 + 0.5);
      vec3 col = mix(uBaseColor, uSurfaceColor, clamp(swirl, 0.0, 1.0));
      float fresnel = pow(1.0 - abs(dot(normalize(vNormalW),
        vec3(0.0, 0.0, 1.0))), 2.0);
      col += fresnel * 0.25;
      gl_FragColor = vec4(col, 0.94);
    }
  `;
</script>

<T.Mesh position={[0, 0.02 + BOWL_H * 0.5, 0]}>
  <T.CylinderGeometry args={[BOWL_R, BOWL_R * 0.7, Math.max(BOWL_H * uniforms.uFill.value, 0.001), 40]} />
  <T.ShaderMaterial
    {uniforms}
    vertexShader={vertexShader}
    fragmentShader={fragmentShader}
    transparent
  />
</T.Mesh>
```

Implementation note: reactive geometry args tied to `uniforms.uFill.value` do NOT auto-update in Three.js — replace this line with an explicit `useFrame` resize: keep a `geometry` created once (`new THREE.CylinderGeometry(...)`) and each frame set `mesh.scale.y = Math.max(uniforms.uFill.value, 0.001)` on a unit-height cylinder instead of rebuilding geometry. Final component must avoid per-frame allocations.

- [ ] **Step 5: IngredientCup**

Small ceramic cup holding a colored ingredient mound:

```svelte
<script lang="ts">
  import { T } from "@threlte/core";

  let { color, label }: { color: string; label: string } = $props();
</script>

<T.Group data-label={label}>
  <T.Mesh position={[0, 0.09, 0]} castShadow>
    <T.CylinderGeometry args={[0.13, 0.10, 0.18, 24]} />
    <T.MeshStandardMaterial color="#f5efe2" roughness={0.5} />
  </T.Mesh>
  <T.Mesh position={[0, 0.185, 0]} castShadow>
    <T.SphereGeometry args={[0.115, 20, 12]} />
    <T.MeshStandardMaterial {color} roughness={0.7} />
  </T.Mesh>
</T.Group>
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm check`
Expected: PASS.

Manual smoke (`pnpm dev`): temporarily mount `<GlassBowl />`, `<LiquidHoney />`, `<WoodenSpoon />`, `<HoneyJar />` and one `<IngredientCup color="#e6b800" label="beePollen" />` inside HoneyScene's Canvas at origin; confirm all render with realistic materials, no shader console errors; then REMOVE the temporary mounts (stations will mount them properly).

```bash
git add src/lib/blend-lab/scene/models/
git commit -m "feat(blends): procedural glass bowl, spoon, jar and honey shader"
```

---

### Task 8: GoalTable station + StepBar overlay

**Files:**

- Create: `src/lib/blend-lab/scene/stations/GoalTable.svelte`
- Create: `src/lib/blend-lab/ui/StepBar.svelte`
- Modify: `src/lib/blend-lab/scene/HoneyScene.svelte` (mount both)

**Interfaces:**

- Consumes: `getBlendsGame()`; i18n keys `blends.game.goal.*`, `blends.game.step.*`; `$lib/i18n/messages` `t(lang, key)` convention used elsewhere in the repo.
- Produces: interactive goal table; StepBar HTML overlay (props `{ lang }`).

Threlte v9 supports pointer events directly on `<T>` objects (`onclick`, `onpointerenter`, `onpointerleave`) — use them instead of a hand-rolled raycaster.

- [ ] **Step 1: GoalTable**

```svelte
<script lang="ts">
  import { T } from "@threlte/core";
  import { Text } from "@threlte/extras";
  import { BLEND_GOALS, type BlendGoalId } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang }: { lang: Lang } = $props();
  const game = getBlendsGame();

  let hovered = $state<BlendGoalId | null>(null);

  const CARD_W = 0.62;
  const GAP = 0.14;
  const totalW = BLEND_GOALS.length * CARD_W + (BLEND_GOALS.length - 1) * GAP;

  const nameOf = (g: (typeof BLEND_GOALS)[number]): string =>
    lang === "ar" ? g.nameAr : g.nameEn;
</script>

<T.Group position={[0, 0, -2.5]}>
  <T.Mesh position={[0, 0.72, 0]} receiveShadow>
    <T.BoxGeometry args={[totalW + 0.5, 0.06, 1.4]} />
    <T.MeshStandardMaterial color="#7a4f21" roughness={0.7} />
  </T.Mesh>
  {#each BLEND_GOALS as g, i (g.id)}
    {@const x = -totalW / 2 + CARD_W / 2 + i * (CARD_W + GAP)}
    <T.Group
      position={[x, 0.78, 0]}
      onclick={() => game.selectGoal(g.id)}
      onpointerenter={() => (hovered = g.id)}
      onpointerleave={() => (hovered === g.id ? (hovered = null) : null)}
    >
      <T.Mesh position={[0, 0.16, 0]} castShadow>
        <T.BoxGeometry args={[CARD_W, 0.32, 0.02]} />
        <T.MeshStandardMaterial
          color={hovered === g.id ? "#e8a020" : "#f5efe2"}
          roughness={0.4}
        />
      </T.Mesh>
      <Text
        position={[0, 0.16, 0.02]}
        fontSize={0.05}
        color="#3b2314"
        maxWidth={CARD_W - 0.04}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
      >
        {nameOf(g)}
      </Text>
    </T.Group>
  {/each}
</T.Group>
```

Verify the actual field names on `BLEND_GOALS` items by opening `$lib/blends.ts` (they may be `nameAr/nameEn` or similar) and adapt `nameOf`.

- [ ] **Step 2: StepBar**

Create `src/lib/blend-lab/ui/StepBar.svelte`:

```svelte
<script lang="ts">
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang }: { lang: Lang } = $props();
  const game = getBlendsGame();

  const STEPS = ["goal", "honey", "prep", "stir", "pour", "order"] as const;
</script>

<div class="pointer-events-auto mx-auto flex w-fit items-center gap-2 rounded-full bg-ink-950/70 px-4 py-2 backdrop-blur" data-testid="blends-stepbar">
  {#each STEPS as s, i (s)}
    {#if i > 0}<span class="h-1 w-4 rounded bg-white/25"></span>{/if}
    <span
      class={`rounded-full px-3 py-1 text-sm ${
        game.step === s ? "bg-honey-500 font-bold text-ink-950" : "text-parchment/80"
      }`}
    >
      {t(lang, `blends.game.step.${s}`)}
    </span>
  {/each}
  {#if game.goBack()}
    <button
      class="ms-2 rounded-full border border-parchment/40 px-3 py-1 text-sm text-parchment hover:bg-parchment/10"
      onclick={() => game.goBack()}
    >
      {t(lang, "blends.game.back")}
    </button>
  {/if}
</div>
```

Note: `{#if game.goBack()}` runs a mutation-free predicate — acceptable here because reactivity re-renders on `game.step` reads. If svelte-check flags it, precompute `const canBack = $derived(game.step !== "goal" && game.step !== "pour" && game.step !== "order")` and branch on that.

- [ ] **Step 3: Mount in HoneyScene**

Inside HoneyScene's Canvas after `<CameraRig />`: `<GoalTable lang={data.lang} />`.
In the HTML overlay header area, below `<h1>`: `<StepBar lang={data.lang} />` wrapped so it is visible from step `goal` onward (always fine).

Add missing imports. Run `pnpm check` → PASS.

Manual smoke: goals render as cards on a wooden table; hovering highlights; clicking a goal moves camera to shelf pose and StepBar highlights "العسل".

- [ ] **Step 4: Commit**

```bash
git add src/lib/blend-lab/scene/stations/GoalTable.svelte src/lib/blend-lab/ui/StepBar.svelte src/lib/blend-lab/scene/HoneyScene.svelte
git commit -m "feat(blends): goal table station with clickable cards and step bar"
```

---

### Task 9: HoneyShelf station + benefits InfoCard

**Files:**

- Create: `src/lib/blend-lab/scene/stations/HoneyShelf.svelte`
- Create: `src/lib/blend-lab/ui/InfoCard.svelte`
- Modify: `src/lib/blend-lab/scene/HoneyScene.svelte`

**Interfaces:**

- Consumes: `getBlendsGame()`; Task 1 `HONEY_BENEFITS`; Task 7 `HoneyJar`; page data `data.baseHoneys` (array of `[optionId, Record<JarSize, { name, image, price, stock, productId, variantId }> ]` entries — read its real type from `./$types` and reuse).
- Produces: `HoneyShelf` props `{ lang, baseHoneys }`; `InfoCard` generic props:

```ts
let {
  title,
  body, // BenefitText already localized string
  image, // optional product image URL
  priceLabel, // optional formatted price line
  actionLabel, // optional confirm button label
  onaction, // optional () => void
}: {
  title: string;
  body: string;
  image?: string;
  priceLabel?: string;
  actionLabel?: string;
  onaction?: () => void;
} = $props();
```

- [ ] **Step 1: HoneyShelf**

Wall-mounted shelf at `[-3.4, 0, -3.0]` facing camera; five jars in a row; hover previews (sets local `previewId` driving an `InfoCard` via slot in HoneyScene overlay OR self-contained fixed-position card inside this component — choose self-contained for simplicity):

```svelte
<script lang="ts">
  import { T } from "@threlte/core";
  import { BASE_HONEY_OPTIONS, type BaseHoneyOption } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { HONEY_BENEFITS } from "$lib/blend-lab/benefits";
  import HoneyJar from "../models/HoneyJar.svelte";
  import InfoCard from "$lib/blend-lab/ui/InfoCard.svelte";
  import { formatEGP } from "$lib/format"; // match the repo's actual currency helper location
  import { t, type Lang } from "$lib/i18n/messages";

  type Entry = {
    optionId: BaseHoneyOption["id"];
    variants: Partial<Record<"half" | "full", { name: string; price: number; stock: number }>>;
  };

  let { lang, baseHoneys }: { lang: Lang; baseHoneys: Entry[] } = $props();

  const game = getBlendsGame();
  let preview = $state<BaseHoneyOption["id"] | null>(null);

  const byId = new Map(baseHoneys.map((e) => [e.optionId, e]));
  const labelOf = (id: BaseHoneyOption["id"]): string =>
    BASE_HONEY_OPTIONS.find((o) => o.id === id)?.name ?? id;

  function pick(id: BaseHoneyOption["id"]): void {
    game.selectHoney(id);
    preview = null;
  }
</script>

<T.Group position={[-3.4, 0, -3.0]}>
  <T.Mesh position={[0, 1.15, 0]} castShadow receiveShadow>
    <T.BoxGeometry args={[2.6, 0.08, 0.55]} />
    <T.MeshStandardMaterial color="#8b5a2b" roughness={0.65} />
  </T.Mesh>
  {#each BASE_HONEY_OPTIONS as o, i (o.id)}
    <T.Group
      position={[-1.0 + i * 0.5, 1.19, 0]}
      scale={preview === o.id ? 1.12 : 1}
      onclick={() => (preview = o.id)}
      ondblclick={() => pick(o.id)}
      onpointerenter={() => (preview = o.id)}
    >
      <HoneyJar
        fillLevel={1}
        color={{ clover: "#e8a020", citrus: "#f0b73a", marjoram: "#c97f1d", sidr: "#a85a10", blackseed: "#6b3a08" }[o.id]}
      />
    </T.Group>
  {/each}
</T.Group>

{#if preview && game.step === "honey"}
  {@const entry = byId.get(preview)}
  <div class="pointer-events-auto absolute bottom-24 start-1/2 z-10 w-[min(92vw,26rem)] -translate-x-1/2 rtl:translate-x-1/2" data-testid="honey-info-card">
    <InfoCard
      title={`${labelOf(preview)} · ${t(lang, "blends.game.honey.sizeFull")}`}
      body={(lang === "ar" ? HONEY_BENEFITS[preview].ar : HONEY_BENEFITS[preview].en)}
      priceLabel={entry?.variants.full ? formatEGP(entry.variants.full.price, lang) : undefined}
      actionLabel={t(lang, "blends.game.honey.viewBenefits")}
      onaction={() => pick(preview!)}
    />
  </div>
{/if}
```

Adapt: the exact `formatEGP` import path, `BASE_HONEY_OPTIONS` item field holding display names, and the `Entry` type must mirror what `+page.server.ts` actually returns (inspect `./$types` `PageData["baseHoneys"]`). Single-click opens the card; the card's action button confirms and advances. Remove the `ondblclick` once single-click flow works (kept initially for fast manual testing).

Size choice (half/full): add two chips above the InfoCard calling `game.setJarSize` — ADD `setJarSize(size: JarSize)` to BlendsGame in this task:

```ts
setJarSize(size: JarSize): void {
  this.jarSize = size;
  if (this.goal) this.doses = presetDoses(this.goal, size);
}
```

…plus one test in `game-state.spec.ts`:

```ts
it("setJarSize re-presets doses when a goal exists", () => {
  const g = new BlendsGame();
  g.selectGoal("immunity");
  const before = { ...g.doses };
  g.setJarSize("half");
  expect(g.jarSize).toBe("half");
});
```

Run `pnpm exec vitest run src/lib/blend-lab/game-state.spec.ts` → PASS.

- [ ] **Step 2: InfoCard**

```svelte
<script lang="ts">
  let {
    title,
    body,
    image,
    priceLabel,
    actionLabel,
    onaction,
  }: {
    title: string;
    body: string;
    image?: string;
    priceLabel?: string;
    actionLabel?: string;
    onaction?: () => void;
  } = $props();
</script>

<article class="rounded-2xl bg-parchment/95 p-4 shadow-xl ring-1 ring-cocoa-900/10 backdrop-blur">
  <div class="flex gap-3">
    {#if image}<img src={image} alt="" class="h-16 w-16 rounded-xl object-cover" />{/if}
    <div class="min-w-0 flex-1">
      <h3 class="headline text-lg font-bold text-cocoa-900">{title}</h3>
      {#if priceLabel}<p class="mt-0.5 text-sm font-semibold text-honey-700">{priceLabel}</p>{/if}
      <p class="mt-1 text-sm leading-relaxed text-cocoa-800">{body}</p>
    </div>
  </div>
  {#if actionLabel}
    <button class="btn-primary mt-3 w-full" onclick={() => onaction?.()}>{actionLabel}</button>
  {/if}
</article>
```

Match token names to the Tailwind theme actually defined (check `honey-700` exists; else use nearest).

- [ ] **Step 3: Mount**

In HoneyScene: `<HoneyShelf lang={data.lang} baseHoneys={data.baseHoneys} />`. Typecheck + dev smoke: shelf visible at honey step; tap jar → card with Arabic benefits + EGP price; action advances to prep; back button returns.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blend-lab/
git commit -m "feat(blends): honey shelf with inspection card and jar size choice"
```

---

### Task 10: WorkTable — cups, drag-to-bowl, MixSummary

**Files:**

- Create: `src/lib/blend-lab/scene/stations/WorkTable.svelte`
- Create: `src/lib/blend-lab/ui/MixSummary.svelte`
- Modify: `src/lib/blend-lab/scene/HoneyScene.svelte`

**Interfaces:**

- Consumes: `getBlendsGame()`; Task 7 `GlassBowl`, `LiquidHoney`, `WoodenSpoon`, `IngredientCup`; Task 1 `ADDITIVE_BENEFITS`, `INGREDIENT_COLORS`; i18n `blends.game.prep.*`, `blends.game.benefits.*`; page data `data.additives` (entries `[key, { key, label, price, stock, productId, variantId, image }]` — mirror the real type from `$types`).
- Produces: drag interaction; tap-to-inspect sets `game.inspected` driving an `InfoCard`; `MixSummary` bottom bar (props `{ lang, unitPrice }`).

Drag design (no external lib): each cup handles `onpointerdown` capturing its key + starting NDC pointer position. WorkTable-level `svelte:window` handlers (`onpointermove`, `onpointerup`) track the gesture: if total movement < 6px it is a TAP → `game.setInspected(key)`; otherwise the cup group follows a horizontal plane at y=0.35 via raycast against that plane on each move; on release, if the cup's xz lands inside the bowl radius → `game.addDose(key)` + splash pulse.

- [ ] **Step 1: Implement WorkTable**

```svelte
<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import { ADDITIVE_KEYS, type AdditiveKey } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { INGREDIENT_COLORS } from "$lib/blend-lab/benefits";
  import GlassBowl from "../models/GlassBowl.svelte";
  import LiquidHoney from "../models/LiquidHoney.svelte";
  import IngredientCup from "../models/IngredientCup.svelte";

  const game = getBlendsGame();
  const { camera, raycaster, pointer } = useThrelte();

  const BOWL_POS = new THREE.Vector3(0, 0, 0);
  const PLANE_Y = 0.35;

  let dragging = $state<AdditiveKey | null>(null);
  let draggedPos = $state<{ x: number; z: number }>({ x: 0, z: 0 });
  let startPx = $state<{ x: number; y: number } | null>(null);

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLANE_Y);
  const hit = new THREE.Vector3();

  function cupHome(i: number): [number, number, number] {
    const angle = Math.PI + (i / ADDITIVE_KEYS.length) * Math.PI;
    return [Math.cos(angle) * 0.95, PLANE_Y, -0.25 + Math.sin(angle) * 0.55];
  }

  function posOf(key: AdditiveKey): { x: number; z: number } {
    if (dragging === key) return draggedPos;
    const i = ADDITIVE_KEYS.indexOf(key);
    const [x, , z] = cupHome(i);
    return { x, z };
  }

  function begin(key: AdditiveKey, e: PointerEvent): void {
    dragging = key;
    startPx = { x: e.clientX, y: e.clientY };
    const home = posOf(key);
    draggedPos = { x: home.x, z: home.z };
  }

  function move(e: PointerEvent): void {
    if (!dragging || !startPx) return;
    pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    draggedPos = { x: hit.x, z: hit.z };
  }

  function end(e: PointerEvent): void {
    if (!dragging || !startPx) return;
    const key = dragging;
    const start = startPx;
    dragging = null;
    startPx = null;
    const movedPx = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (movedPx < 6) {
      game.setInspected(game.inspected === key ? null : key);
      return;
    }
    const inBowl =
      Math.hypot(draggedPos.x - BOWL_POS.x, draggedPos.z - BOWL_POS.z) < 0.5;
    if (inBowl) {
      game.addDose(key);
      game.setInspected(null);
    }
  }
</script>

<svelte:window onpointermove={move} onpointerup={end} />

<T.Group>
  <T.Mesh position={[0, 0.4, 0]} receiveShadow>
    <T.BoxGeometry args={[2.6, 0.08, 1.8]} />
    <T.MeshStandardMaterial color="#7a4f21" roughness={0.7} />
  </T.Mesh>
  <T.Group position={[0, 0.44, 0]}>
    <GlassBowl />
    <LiquidHoney />
  </T.Group>

  {#each ADDITIVE_KEYS as key (key)}
    {@const p = posOf(key)}
    <T.Group
      position={[p.x, PLANE_Y, p.z]}
      onpointerdown={(e: PointerEvent) => begin(key, e)}
    >
      <IngredientCup color={INGREDIENT_COLORS[key]} label={key} />
    </T.Group>
  {/each}
</T.Group>
```

Tap-vs-drag: `end()` receives the pointerup event and treats movement under 6px as a tap (inspect card toggle); anything longer is a drag evaluated against the bowl radius.

Drop feedback: animate the cup returning home with a small bounce (Svelte `spring` on the position used by `posOf`) — acceptable simplification per spec ("drop feedback"); note it in the commit message.

- [ ] **Step 2: Benefits card for cups**

In WorkTable markup tail:

```svelte
{#if game.inspected}
  <!-- InfoCard imported like Task 9 -->
  <div class="pointer-events-auto absolute bottom-24 start-1/2 z-10 w-[min(92vw,26rem)] -translate-x-1/2 rtl:translate-x-1/2" data-testid="ingredient-info-card">
    <InfoCard
      title={game.inspected}
      body={lang === "ar" ? ADDITIVE_BENEFITS[game.inspected].ar : ADDITIVE_BENEFITS[game.inspected].en}
      actionLabel={t(lang, "blends.game.prep.title")}
      onaction={() => game.setInspected(null)}
    />
  </div>
{/if}
```

Title should use the additive display label from `data.additives` entry (`label`) — pass `additives` prop into WorkTable and look it up; add prop `{ lang }: { lang: Lang }` too and import InfoCard + t. Fix title to `{additiveLabel(game.inspected)}` helper built from the passed catalog.

- [ ] **Step 3: MixSummary bar**

Create `src/lib/blend-lab/ui/MixSummary.svelte`:

```svelte
<script lang="ts">
  import { ADDITIVE_KEYS, MAX_DOSE } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let {
    lang,
    unitPrice,
  }: { lang: Lang; unitPrice: number } = $props();

  const game = getBlendsGame();
</script>

<div class="pointer-events-auto mx-auto flex w-fit flex-wrap items-center gap-2 rounded-full bg-ink-950/70 px-4 py-2 text-sm text-parchment backdrop-blur" data-testid="blends-mix-summary">
  <span class="font-bold text-honey-400">{unitPrice > 0 ? `${t(lang, "blends.order.unitPrice")}: ${unitPrice} EGP` : ""}</span>
  {#each ADDITIVE_KEYS as k (k)}
    {#if game.doses[k] > 0}
      <span class="rounded-full bg-honey-500/20 px-2 py-0.5">
        {k} ×{game.doses[k]}<span class="text-parchment/50">/{MAX_DOSE}</span>
      </span>
    {/if}
  {/each}
</div>
```

Replace the hardcoded EGP string with the repo's `formatEGP(unitPrice, lang)` helper once confirmed (Task 9 located it). Labels for additives should use `ADDITIVE_LABELS[k][lang]` from `$lib/blends`.

- [ ] **Step 4: Mount + verify**

In HoneyScene: `<WorkTable lang={data.lang} additives={data.additives} />`; show `<MixSummary>` only while `game.step === "prep" || game.step === "stir"` — compute unitPrice here from catalogs (base variant price by `game.honeyId`+`game.jarSize` + Σ additive price×dose; extract helper `blendUnitPrice(baseHoneys, additives, honeyId, jarSize, doses): number` into `src/lib/blend-lab/pricing.ts` WITH unit test):

Create `src/lib/blend-lab/pricing.spec.ts` first:

```ts
import { describe, expect, it } from "vitest";
import { blendUnitPrice } from "./pricing";

const base = new Map([["clover", { full: { price: 300 }, half: { price: 170 } }]]);
const adds = new Map([["propolis", { price: 60 }]]);

describe("blendUnitPrice", () => {
  it("sums base plus dose-weighted additives", () => {
    expect(
      blendUnitPrice(base as never, adds as never, "clover", "full", {
        royalJelly: 0,
        propolis: 2,
        ginseng: 0,
        palmPollen: 0,
        beePollen: 0,
      }),
    ).toBe(420);
  });
});
```

Implement `src/lib/blend-lab/pricing.ts` with explicit types matching the real catalog shapes (replace the `as never` in the test with real object literals after typing). Run vitest → PASS before wiring UI.

Manual smoke: drag cup over bowl releases → dose chip appears in summary; tap cup → benefits card; drop outside bowl returns cup home.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blend-lab/
git commit -m "feat(blends): work table with drag-to-bowl dosing and live mix summary"
```

---

### Task 11: Stir interaction — spoon control + progress ring

**Files:**

- Create: `src/lib/blend-lab/ui/StirOverlay.svelte`
- Modify: `src/lib/blend-lab/scene/stations/WorkTable.svelte` (spoon follows pointer while stirring)
- Modify: `src/lib/blend-lab/scene/HoneyScene.svelte` (mount overlay during stir step)

**Interfaces:**

- Consumes: Task 2 stir math (already wired through `game.recordStir`); Task 7 `WoodenSpoon`.
- Produces: `StirOverlay` (props `{ lang }`) rendering circular progress + hint + skip button; spoon orbit driven by pointer angle.

Interaction model: while `game.step === "stir"`, pointer movement on the window accumulates angle deltas around a fixed screen anchor approximating the bowl (`cx = innerWidth/2`, `cy = innerHeight * 0.62`). Each `pointermove` computes `atan2(py - cy, px - cx)`; delta = wrapped difference; when a button is pressed (or pointer type is touch) call `game.recordStir(delta)`. **WorkTable owns this handler** (it also drives the spoon); `StirOverlay` is purely presentational. When `game.mixProgress >= 1`, auto-advance after 600ms via `game.finishStir()` (owned by StirOverlay's `$effect`).

- [ ] **Step 1: Add stir tracking + spoon follow to WorkTable**

Add inside WorkTable's script:

```ts
let spoonAngle = $state(0);
let lastAngle: number | null = null;

function stirMove(e: PointerEvent): void {
  if (game.step !== "stir") return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.62;
  const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
  if (lastAngle !== null) {
    let d = angle - lastAngle;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    if (e.buttons > 0 || e.pointerType !== "mouse") {
      game.recordStir(d);
      spoonAngle = angle;
    }
  }
  lastAngle = angle;
}

function resetAngle(): void {
  lastAngle = null;
}
```

Extend the existing `<svelte:window>` line:

```svelte
<svelte:window
  onpointermove={(e) => { move(e); stirMove(e); }}
  onpointerup={end}
  onpointercancel={end}
  onpointerup={resetAngle}
/>
```

NOTE: duplicate `onpointerup` attributes are invalid — merge into one handler each: `onpointerup={(e) => { end(e); resetAngle(); }}` and same for `onpointercancel`.

Render the spoon after the cups `{#each}` block:

```svelte
  {#if game.step === "stir"}
    <T.Group
      position={[Math.cos(spoonAngle) * 0.42, 0.62, Math.sin(spoonAngle) * 0.42]}
      rotation={[0.9, 0, 0]}
    >
      <WoodenSpoon length={0.85} />
    </T.Group>
  {/if}
```

(Import `WoodenSpoon` from `../models/WoodenSpoon.svelte`.)

- [ ] **Step 2: Create presentational StirOverlay**

Create `src/lib/blend-lab/ui/StirOverlay.svelte` — no pointer handlers here:

```svelte
<script lang="ts">
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang }: { lang: Lang } = $props();
  const game = getBlendsGame();

  const R = 64;
  const CIRC = 2 * Math.PI * R;

  let doneNotified = $state(false);
  $effect(() => {
    if (game.mixProgress >= 1 && !doneNotified) {
      doneNotified = true;
      setTimeout(() => game.finishStir(), 600);
    }
  });
</script>

{#if game.step === "stir"}
  <div class="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex flex-col items-center gap-2">
    <svg width={R * 2 + 16} height={R * 2 + 16} viewBox="0 0 {R * 2 + 16} {R * 2 + 16}" role="img" aria-label={t(lang, "blends.game.stir.title")} class="-rotate-90">
      <circle cx={R + 8} cy={R + 8} r={R} fill="none" stroke="#ffffff33" stroke-width="10" />
      <circle
        cx={R + 8}
        cy={R + 8}
        r={R}
        fill="none"
        stroke="#e8a020"
        stroke-width="10"
        stroke-linecap="round"
        stroke-dasharray={CIRC}
        stroke-dashoffset={CIRC * (1 - game.mixProgress)}
        data-testid="stir-progress-ring"
      />
    </svg>
    <p class="rounded-full bg-ink-950/70 px-4 py-1 text-sm text-parchment backdrop-blur">
      {game.mixProgress >= 1 ? t(lang, "blends.game.stir.done") : t(lang, "blends.game.stir.hint")}
    </p>
    {#if game.mixProgress < 1}
      <button class="btn-outline pointer-events-auto" onclick={() => game.forceFinishStir()}>
        {t(lang, "blends.game.skip")}
      </button>
    {/if}
  </div>
{/if}
```

- [ ] **Step 3: Mount + verify**

Mount `<StirOverlay lang={data.lang} />` in HoneyScene's overlay layer. Manual: circle-drag builds ring and spoon follows; skip works; completion advances to pour pose automatically.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blend-lab/
git commit -m "feat(blends): hand-stirring interaction with spoon follow and progress ring"
```

---

### Task 12: JarStation — pour animation + OrderPanel

**Files:**

- Create: `src/lib/blend-lab/scene/stations/JarStation.svelte`
- Create: `src/lib/blend-lab/ui/OrderPanel.svelte`
- Modify: `src/lib/blend-lab/scene/HoneyScene.svelte`

**Interfaces:**

- Consumes: `getBlendsGame()`; Task 7 `HoneyJar`; existing `QuantityPicker` (`$lib/components/QuantityPicker.svelte`, props `{ lang, value, max, onChange(q) }`); cart store `addBlend(...)` + `openDrawer()` (same call shape the current wizard uses, but with `quantity: game.quantity`); `MAX_ORDER_QTY`, `jarLabel(lang,size)` from `$lib/blends`; `formatEGP`; pricing helper from Task 10.
- Produces: pour timeline (bowl tilts over jar, stream, fill rises 0→1 over ~4s) then order panel.

- [ ] **Step 1: JarStation**

```svelte
<script lang="ts">
  import { T, useFrame } from "@threlte/core";
  import * as THREE from "three";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import HoneyJar from "../models/HoneyJar.svelte";

  const game = getBlendsGame();
  const JAR_POS = new THREE.Vector3(1.6, 0.44, 0);
  const POUR_SECONDS = 4;

  let elapsed = $state(0);
  let tilt = $state(0); // radians

  useFrame((_ctx, delta) => {
    if (game.step === "pour") {
      elapsed += delta;
      const t = Math.min(1, elapsed / POUR_SECONDS);
      tilt = Math.min(Math.PI / 2.2, tilt + delta * 1.8);
      game.setJarFill(t);
      if (t >= 1 && game.jarFill >= 0.999) {
        game.completePour();
      }
    } else if (game.step !== "order") {
      elapsed = 0;
      tilt = Math.max(0, tilt - delta * 3);
    }
  });
</script>

<T.Group>
  <T.Mesh position={[JAR_POS.x - 0.25, 0.22, JAR_POS.z]} receiveShadow castShadow>
    <T.BoxGeometry args={[0.5, 0.44, 0.5]} />
    <T.MeshStandardMaterial color="#6f4a20" roughness={0.75} />
  </T.Mesh>

  <T.Group position={[JAR_POS.x, 0.44, JAR_POS.z]}>
    <HoneyJar scale={0.9} fillLevel={game.jarFill} color={"#e8a020"} />
  </T.Group>

  {#if game.step === "pour"}
    <!-- honey bowl flying over the jar -->
    <T.Group
      position={[
        THREE.MathUtils.lerp(0, JAR_POS.x + 0.05, Math.min(1, elapsed / 0.8)),
        THREE.MathUtils.lerp(0.44, 1.15, Math.min(1, elapsed / 0.8)),
        0,
      ]}
      rotation={[0, 0, -tilt]}
    >
      <GlassBowl radius={0.45} height={0.42} />
      <LiquidHoney />
    </T.Group>

    <!-- stream -->
    <T.Mesh position={[JAR_POS.x, 0.95, JAR_POS.z]}>
      <T.CylinderGeometry args={[0.02, 0.03, 0.5, 12]} />
      <T.MeshStandardMaterial color="#e8a020" roughness={0.2} transparent opacity={0.9} />
    </T.Mesh>
  {/if}
</T.Group>
```

Import GlassBowl/LiquidHoney at top (add to imports). Jar color should use Task 2's `mixIngredients` result for consistency:

```ts
const jarColor = $derived(
  mixIngredients(
    HONEY_COLORS[game.honeyId ?? "clover"],
    ADDITIVE_KEYS.map((k) => ({ hex: INGREDIENT_COLORS[k], weight: game.doses[k] })),
    1,
  ),
);
```

…passed as `color={jarColor}`.

Reduced motion: if `prefers-reduced-motion`, set `POUR_SECONDS = 1.2`.

- [ ] **Step 2: OrderPanel**

```svelte
<script lang="ts">
  import { MAX_ORDER_QTY, jarLabel } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import { addBlend, openDrawer } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/format"; // confirm actual module path used by current wizard
  import { t, type Lang } from "$lib/i18n/messages";

  type CatalogEntry = {
    productId: string;
    variantId: string;
    name: string;
    image: string;
    price: number;
    stock: number;
  };

  let {
    lang,
    baseHoneys,
    additives,
    blendImage,
  }: {
    lang: Lang;
    baseHoneys: Map<BaseHoneyOption["id"], Record<"half" | "full", CatalogEntry>>;
    additives: Map<AdditiveKey, CatalogEntry & { key: AdditiveKey; label: string }>;
    blendImage: string;
  } = $props();

  const game = getBlendsGame();

  const base = $derived(
    game.honeyId ? baseHoneys.get(game.honeyId)?.[game.jarSize] : undefined,
  );

  const selectedAdditives = $derived(
    Object.entries(game.doses)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => ({ entry: additives.get(key as AdditiveKey)!, qty })),
  );

  const unitPrice = $derived(
    (base?.price ?? 0) +
      selectedAdditives.reduce((sum, a) => sum + a.entry.price * a.qty, 0),
  );

  // stock of the composite line = min(base stock, each chosen additive stock floor)
  const maxQty = $derived(
    Math.min(
      MAX_ORDER_QTY,
      base?.stock ?? 1,
      ...selectedAdditives.map((a) => Math.floor(a.entry.stock / Math.max(1, a.qty))),
    ),
  );
</script>

<section class="pointer-events-auto absolute inset-x-4 bottom-6 z-20 mx-auto w-[min(96vw,34rem)] rounded-3xl bg-parchment/95 p-5 shadow-2xl ring-1 ring-cocoa-900/10 backdrop-blur" data-testid="blends-order-panel">
  <h2 class="headline text-xl font-bold text-cocoa-900">{t(lang, "blends.game.order.title")}</h2>

  <ul class="mt-2 space-y-1 text-sm text-cocoa-800">
    {#if base}
      <li class="font-semibold">{base.name} · {jarLabel(lang, game.jarSize)} — {formatEGP(base.price, lang)}</li>
    {/if}
    {#each selectedAdditives as a (a.entry.key)}
      <li class="ps-4">+ {a.entry.label} ×{a.qty} — {formatEGP(a.entry.price * a.qty, lang)}</li>
    {/each}
  </ul>

  <div class="mt-3 flex items-center justify-between gap-3">
    <span class="text-sm font-semibold text-cocoa-800">{t(lang, "blends.game.order.quantity")}</span>
    <QuantityPicker
      {lang}
      value={game.quantity}
      max={maxQty}
      onChange={(q) => game.setQuantity(q, maxQty)}
    />
  </div>

  <p class="mt-1 text-xs text-cocoa-600">{t(lang, "blends.game.order.unitPrice")}: {formatEGP(unitPrice, lang)}</p>
  <p class="mt-0.5 text-base font-bold text-honey-700" data-testid="order-total">
    {t(lang, "blends.game.order.total")}: {formatEGP(unitPrice * game.quantity, lang)}
  </p>

  <button
    class="btn-primary mt-3 w-full disabled:opacity-50"
    disabled={maxQty < 1}
    onclick={() => {
      if (!base || !game.goal) return;
      addBlend({
        baseVariantId: base.variantId,
        productId: base.productId,
        name: base.name,
        variantName: jarLabel(lang, game.jarSize),
        image: blendImage,
        jarSize: game.jarSize,
        basePrice: base.price,
        stock: base.stock,
        quantity: game.quantity,
        additives: selectedAdditives.map((a) => ({
          key: a.entry.key,
          variantId: a.entry.variantId,
          productId: a.entry.productId,
          name: a.entry.label,
          image: a.entry.image ?? "",
          qty: a.qty,
          price: a.entry.price,
          stock: a.entry.stock,
        })),
        goalId: game.goal,
      });
      openDrawer();
    }}
    data-testid="add-to-cart-btn"
  >
    {maxQty < 1 ? t(lang, "blends.game.order.outOfStock") : t(lang, "blends.game.order.addToCart")}
  </button>

  <button class="btn-outline mt-2 w-full" onclick={() => game.reset()}>
    {t(lang, "blends.game.restart")}
  </button>
</section>
```

CRITICAL — align `addBlend` payload EXACTLY with the cart store schema: open `$lib/cart-store.svelte.ts`, copy the zod schema fields, and adapt the object above field-by-field (the shape shown mirrors the current wizard's call which includes `goalId`; if the schema does not accept `goalId`, remove it). Do not modify the cart store.

Catalog types: `data.baseHoneys`/`data.additives` may arrive as arrays of `[key, value]` entries (devalue serializes Maps that way). In HoneyScene, normalize once before passing down:

```ts
const baseMap = $derived(new Map(data.baseHoneys));
const additiveMap = $derived(new Map(data.additives));
```

…then pass `baseHoneys={baseMap}` / `additives={additiveMap}` so the panel's `Map` props hold.

- [ ] **Step 3: Mount in HoneyScene**

`<JarStation />` inside Canvas; `{#if game.step === "order"}<OrderPanel … />{/if}` in overlay layer. Also show `pour.title` hint during pour step. Typecheck + full manual run-through of all six steps end-to-end.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blend-lab/
git commit -m "feat(blends): jar station pour animation and multi-quantity order panel"
```

---

### Task 13: E2E smoke, quality gate, docs

**Files:**

- Modify: `src/routes/blends/+page.svelte` (support `?force2d=1`)
- Create: e2e spec next to existing Playwright specs (find them: `git ls-files '*e2e*' '*.spec.ts' | grep -i playwright` — follow their directory convention)
- Modify: `docs/architecture.md`, `docs/todo.md`
- Modify: `README.md` only if it documents `/blends` behavior

- [ ] **Step 1: Deterministic fallback flag**

In the shell script block:

```ts
const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
let mode: "loading" | "game" | "fallback" = $state("loading");
onMount(() => {
  if (params?.has("force2d") || !hasWebGL()) {
    mode = "fallback";
    return;
  }
  /* dynamic import as before */
});
```

- [ ] **Step 2: E2E smoke test**

Following the repo's existing Playwright config/baseURL conventions, create `blends-3d.spec.ts` (adjust path):

```ts
import { expect, test } from "@playwright/test";

test.describe("/blends", () => {
  test("loads either the 3D scene or the classic fallback", async ({ page }) => {
    await page.goto("/blends");
    const scene = page.getByTestId("blends-scene");
    const fallback = page.getByTestId("blends-fallback");
    await expect(scene.or(fallback)).toBeVisible({ timeout: 15000 });
  });

  test("force2d shows the classic wizard and notice", async ({ page }) => {
    await page.goto("/blends?force2d=1");
    await expect(page.getByTestId("blends-fallback")).toBeVisible();
    await expect(page.getByTestId("webgl-fallback-message")).toBeVisible();
  });

  test("classic fallback can complete an order flow", async ({ page }) => {
    await page.goto("/blends?force2d=1");
    // Reuse assertions mirroring the pre-existing blends e2e (if any):
    // pick goal → pick honey → add → checkout button enabled.
    await expect(page.getByTestId("blends-shell")).toBeVisible();
  });
});
```

Run: `pnpm exec playwright test blends-3d` (or the repo's documented command).
Expected: PASS. If the dev server needs starting, follow the repo's playwright webServer config.

Remove `<Preview />` from HoneyScene before this step.

- [ ] **Step 3: Full quality gate**

Run in order; fix anything red before proceeding:

```bash
pnpm check
pnpm test            # or vp run test per package.json
pnpm build
pnpm exec playwright test
```

Manual checklist (`pnpm dev`, Arabic + English locales):

1. Full happy path: goal → honey (+size chips re-preset doses) → prep drag/tap → stir circles OR skip → pour auto → order.
2. Back navigation works until pour.
3. Restart resets everything.
4. Quantity picker caps at stock and 10; total updates; add-to-cart opens drawer with correct line.
5. Reduced motion: camera snaps, pour is fast.
6. No console errors/warnings.

- [ ] **Step 4: Update project docs**

Append to `docs/architecture.md` under a new heading `## Blend Lab (/blends)`:

```markdown
## Blend Lab (/blends)

Interactive 3D honey-blending game built with Threlte v9 (Three.js) on Svelte 5 runes.

- State: single `BlendsGame` runes class (`src/lib/blend-lab/game-state.svelte.ts`) drives steps
  goal → honey → prep → stir → pour → order. All stations/components read state via context.
- Pure logic (stir math, color mixing, pricing, benefits data) lives in plain TS modules under
  `src/lib/blend-lab/` with vitest coverage.
- Scene loads lazily client-side; devices without WebGL (or `?force2d=1`) fall back to the
  classic wizard preserved verbatim in `src/routes/blends/FallbackBlends.svelte`.
- Ordering reuses the cart store `addBlend` contract unchanged; backend orders API untouched.
```

Update `docs/todo.md`: mark the 3D blend lab done; note owner-editable benefit texts live in `src/lib/blend-lab/benefits.ts`.

- [ ] **Step 5: Final commits**

```bash
git add -A
git commit -m "test(blends): e2e smoke for 3D lab and fallback path"
git commit -m "docs: document blend lab architecture" -- docs/
```

(Split as appropriate; conventional messages.)

<!-- PLAN-PART-2 -->
