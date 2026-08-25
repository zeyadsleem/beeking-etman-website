import { describe, expect, it } from "vite-plus/test";
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
