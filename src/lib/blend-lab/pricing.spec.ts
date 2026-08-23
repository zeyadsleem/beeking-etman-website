import { describe, expect, it } from "vite-plus/test";
import { blendUnitPrice, type AdditiveCatalog, type BaseHoneyCatalog } from "./pricing";

const base: BaseHoneyCatalog = [["clover", { half: { price: 170 }, full: { price: 300 } }]];
const adds: AdditiveCatalog = [["propolis", { price: 60 }]];

describe("blendUnitPrice", () => {
  it("sums base plus dose-weighted additives", () => {
    expect(
      blendUnitPrice(base, adds, "clover", "full", {
        royalJelly: 0,
        propolis: 2,
        ginseng: 0,
        palmPollen: 0,
        beePollen: 0,
      }),
    ).toBe(420);
  });

  it("returns additive-only total when no honey is selected", () => {
    expect(
      blendUnitPrice(base, adds, null, "half", {
        royalJelly: 0,
        propolis: 1,
        ginseng: 0,
        palmPollen: 0,
        beePollen: 0,
      }),
    ).toBe(60);
  });

  it("returns zero for empty doses and unknown honey", () => {
    expect(
      blendUnitPrice(base, adds, "sidr", "full", {
        royalJelly: 0,
        propolis: 0,
        ginseng: 0,
        palmPollen: 0,
        beePollen: 0,
      }),
    ).toBe(0);
  });
});
