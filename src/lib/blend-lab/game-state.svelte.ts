import { getContext, setContext } from "svelte";
import {
  BLEND_GOALS,
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

  get canBack(): boolean {
    return PREV_STEP[this.step] !== null;
  }

  selectGoal(id: BlendGoalId): void {
    const goal = BLEND_GOALS.find((g) => g.id === id);
    if (!goal) throw new Error(`Unknown blend goal: ${id}`);
    this.goal = id;
    this.doses = presetDoses(goal, this.jarSize);
    this.step = "honey";
  }

  selectHoney(id: BaseHoneyOption["id"] | null): void {
    this.honeyId = id;
    this.step = "prep";
  }

  setJarSize(size: JarSize): void {
    this.jarSize = size;
    const goal = BLEND_GOALS.find((g) => g.id === this.goal);
    if (goal) this.doses = presetDoses(goal, size);
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
