import { describe, expect, it } from "vite-plus/test";
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
