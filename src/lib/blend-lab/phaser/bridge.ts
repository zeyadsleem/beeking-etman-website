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
  recordStir(deltaRadians: number): void;
  setJarFill(value: number): void;
  completePour(): void;
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
