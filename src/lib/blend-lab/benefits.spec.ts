import { describe, expect, it } from "vite-plus/test";
import { ADDITIVE_KEYS, BASE_HONEY_OPTIONS } from "$lib/blends";
import { ADDITIVE_BENEFITS, HONEY_BENEFITS, HONEY_COLORS, INGREDIENT_COLORS } from "./benefits";

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
