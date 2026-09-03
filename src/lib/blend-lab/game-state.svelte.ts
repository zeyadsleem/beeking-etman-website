import { getContext, setContext } from "svelte";
import {
  ADDITIVE_KEYS,
  BLEND_GOALS,
  presetDoses,
  zeroDoses,
  type AdditiveKey,
  type BaseHoneyOption,
  type BlendGoal,
  type BlendGoalId,
  type JarSize,
} from "$lib/blends";

const CONTEXT_KEY = "blendsGame";

export type BlendStep = "goal" | "honey" | "additives" | "mix";

/** Steps in order; used for the gated wizard progress indicator. */
export const BLEND_STEPS: readonly BlendStep[] = ["goal", "honey", "additives", "mix"];

/**
 * Gated wizard state for the blend experience. The customer moves through
 * discrete steps — pick a base honey, add additive doses (by drag & drop or
 * steppers), then mix by stirring a circular gesture — before ordering. Each
 * step must satisfy its own condition before `next()` is allowed.
 */
export class BlendsGame {
  step = $state<BlendStep>("goal");
  goalId = $state<BlendGoalId | null>(null);
  honeyId = $state<BaseHoneyOption["id"] | null>(null);
  jarSize = $state<JarSize>("full");
  doses = $state<Record<AdditiveKey, number>>(zeroDoses());
  mixProgress = $state(0);
  quantity = $state(1);

  get goal(): BlendGoal | undefined {
    return this.goalId ? BLEND_GOALS.find((g) => g.id === this.goalId) : undefined;
  }

  /** The additives recommended for the active goal (empty when none chosen). */
  get recommendedAdditives(): AdditiveKey[] {
    return this.goal?.recommended ?? [];
  }

  isRecommended(key: AdditiveKey): boolean {
    return this.recommendedAdditives.includes(key);
  }

  get hasHoney(): boolean {
    return this.honeyId !== null;
  }

  get hasAdditives(): boolean {
    return ADDITIVE_KEYS.some((k) => this.doses[k] > 0);
  }

  get totalDoses(): number {
    return ADDITIVE_KEYS.reduce((sum, k) => sum + this.doses[k], 0);
  }

  get isCompositionValid(): boolean {
    return this.honeyId !== null;
  }

  /** Each step is gated: goal requires a selection, honey requires a selection,
   * additives require at least one dose, mix requires the mix gesture to
   * complete. */
  get canNext(): boolean {
    switch (this.step) {
      case "goal":
        return this.goalId !== null;
      case "honey":
        return this.honeyId !== null;
      case "additives":
        return this.hasAdditives;
      case "mix":
        return this.mixProgress >= 1;
    }
  }

  get canBack(): boolean {
    return this.step !== "goal";
  }

  get isMixDone(): boolean {
    return this.mixProgress >= 1;
  }

  selectGoal(id: BlendGoalId | null): void {
    this.goalId = id;
    const goal = id ? BLEND_GOALS.find((g) => g.id === id) : undefined;
    this.doses = goal ? presetDoses(goal, this.jarSize) : zeroDoses();
  }

  selectHoney(id: BaseHoneyOption["id"] | null): void {
    this.honeyId = id;
  }

  setJarSize(size: JarSize): void {
    this.jarSize = size;
    // Re-apply the goal's recommended doses so the composition matches the jar.
    if (this.goalId) {
      const goal = BLEND_GOALS.find((g) => g.id === this.goalId);
      if (goal) this.doses = presetDoses(goal, size);
    }
  }

  addDose(key: AdditiveKey, n: number = 1): void {
    this.doses[key] = this.doses[key] + n;
  }

  removeDose(key: AdditiveKey): void {
    this.doses[key] = Math.max(0, this.doses[key] - 1);
  }

  /**
   * Advances the stir gesture: `amount` is in [0, 1] and represents how much
   * of the full stir this call contributes. Clamped so it can never exceed 1.
   */
  recordStir(amount: number): void {
    if (!Number.isFinite(amount)) return;
    this.mixProgress = Math.min(1, Math.max(0, this.mixProgress + amount));
  }

  setQuantity(q: number, maxQty: number): void {
    const cap = Math.max(1, maxQty);
    this.quantity = Math.min(cap, Math.max(1, q));
  }

  /** Move to the next step; refuses to advance when the current step isn't complete. */
  next(): void {
    if (!this.canNext) return;
    const idx = BLEND_STEPS.indexOf(this.step);
    if (idx < BLEND_STEPS.length - 1) this.step = BLEND_STEPS[idx + 1];
  }

  back(): void {
    const idx = BLEND_STEPS.indexOf(this.step);
    if (idx > 0) this.step = BLEND_STEPS[idx - 1];
  }

  reset(): void {
    this.step = "goal";
    this.goalId = null;
    this.honeyId = null;
    this.doses = zeroDoses();
    this.mixProgress = 0;
    this.quantity = 1;
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
