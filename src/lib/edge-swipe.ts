export type SwipeEdge = "left" | "right";

export interface TouchSample {
  x: number;
  y: number;
}

export interface EdgeSwipeConfig {
  edge: SwipeEdge;
  viewportWidth: number;
  /** Max distance from the edge where a swipe may start. */
  edgeZone?: number;
  /** Minimum horizontal travel toward the centre to count as a swipe. */
  minDistance?: number;
}

/** The drawer opens from the inline-end edge, matching the menu button side. */
export function edgeForDir(dir: "ltr" | "rtl"): SwipeEdge {
  return dir === "rtl" ? "left" : "right";
}

/**
 * True when a touch that started at `start` and ended at `end` is a swipe
 * away from `edge` (toward the centre) long enough to open the menu.
 */
export function isEdgeSwipe(
  start: TouchSample,
  end: TouchSample,
  config: EdgeSwipeConfig,
): boolean {
  const { edge, viewportWidth, edgeZone = 24, minDistance = 56 } = config;
  const startsAtEdge = edge === "left" ? start.x <= edgeZone : start.x >= viewportWidth - edgeZone;
  if (!startsAtEdge) return false;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const towardCentre = edge === "left" ? dx >= minDistance : dx <= -minDistance;
  if (!towardCentre) return false;

  return Math.abs(dx) > Math.abs(dy) * 1.5;
}
