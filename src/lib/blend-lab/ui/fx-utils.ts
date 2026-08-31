// Accessibility + preference helpers shared by Blend Lab UI.
import { sfx } from "./sfx";

let reducedMotion: boolean | null = null;

export function prefersReducedMotion(): boolean {
  if (reducedMotion === null) {
    try {
      reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reducedMotion = false;
    }
  }
  return reducedMotion;
}

export { sfx };
