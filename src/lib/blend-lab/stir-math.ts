export const FULL_STIR_RADIANS: number = 3 * Math.PI * 2;

export function normalizeAngleDelta(rad: number): number {
  let r = rad % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

export function accumulateStir(totalRadians: number, delta: number): number {
  return totalRadians + normalizeAngleDelta(delta);
}

export function stirProgress(totalRadians: number): number {
  if (!Number.isFinite(totalRadians) || totalRadians <= 0) return 0;
  return Math.min(1, totalRadians / FULL_STIR_RADIANS);
}
