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
