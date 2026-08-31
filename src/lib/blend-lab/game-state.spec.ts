import { describe, expect, it } from "vite-plus/test";
import { ADDITIVE_KEYS, zeroDoses } from "$lib/blends";
import { BlendsGame } from "./game-state.svelte";

describe("BlendsGame configurator", () => {
  it("starts empty with a full jar and quantity 1", () => {
    const g = new BlendsGame();
    expect(g.honeyId).toBeNull();
    expect(g.jarSize).toBe("full");
    expect(g.doses).toEqual(zeroDoses());
    expect(g.quantity).toBe(1);
    expect(g.hasHoney).toBe(false);
    expect(g.hasAdditives).toBe(false);
    expect(g.totalDoses).toBe(0);
    expect(g.isCompositionValid).toBe(false);
  });

  it("selectHoney sets the base and makes the composition valid", () => {
    const g = new BlendsGame();
    g.selectHoney("clover");
    expect(g.honeyId).toBe("clover");
    expect(g.hasHoney).toBe(true);
    expect(g.isCompositionValid).toBe(true);
  });

  it("setJarSize switches between half and full without touching doses", () => {
    const g = new BlendsGame();
    g.selectHoney("sidr");
    g.addDose("royalJelly", 2);
    const before = { ...g.doses };
    g.setJarSize("half");
    expect(g.jarSize).toBe("half");
    g.setJarSize("full");
    expect(g.jarSize).toBe("full");
    expect(g.doses).toEqual(before);
  });

  it("addDose accumulates without a cap and removeDose clamps at zero", () => {
    const g = new BlendsGame();
    for (let i = 0; i < 10; i++) g.addDose("propolis");
    expect(g.doses.propolis).toBe(10);
    expect(g.totalDoses).toBe(10);
    for (let i = 0; i < 12; i++) g.removeDose("propolis");
    expect(g.doses.propolis).toBe(0);
    expect(g.totalDoses).toBe(0);
    g.removeDose("propolis");
    expect(g.doses.propolis).toBe(0);
  });

  it("addDose supports a custom amount and hasAdditives flips on/off", () => {
    const g = new BlendsGame();
    expect(g.hasAdditives).toBe(false);
    g.addDose("ginseng", 2);
    expect(g.doses.ginseng).toBe(2);
    expect(g.hasAdditives).toBe(true);
    g.removeDose("ginseng");
    expect(g.hasAdditives).toBe(true);
    g.removeDose("ginseng");
    expect(g.hasAdditives).toBe(false);
  });

  it("setQuantity clamps between 1 and max", () => {
    const g = new BlendsGame();
    g.setQuantity(99, 10);
    expect(g.quantity).toBe(10);
    g.setQuantity(0, 10);
    expect(g.quantity).toBe(1);
    g.setQuantity(3, 10);
    expect(g.quantity).toBe(3);
  });

  it("reset clears the honey, doses, mix progress and quantity but keeps the jar size", () => {
    const g = new BlendsGame();
    g.selectHoney("sidr");
    g.setJarSize("half");
    g.addDose("royalJelly", 2);
    g.recordStir(0.5);
    g.next();
    g.setQuantity(4, 10);
    g.reset();
    expect(g.step).toBe("honey");
    expect(g.honeyId).toBeNull();
    expect(g.jarSize).toBe("half");
    expect(g.doses).toEqual(zeroDoses());
    expect(g.mixProgress).toBe(0);
    expect(g.quantity).toBe(1);
  });

  it("exposes every additive key in doses", () => {
    const g = new BlendsGame();
    for (const k of ADDITIVE_KEYS) expect(g.doses[k]).toBe(0);
  });

  describe("gated step flow", () => {
    it("starts on honey and cannot back from it", () => {
      const g = new BlendsGame();
      expect(g.step).toBe("honey");
      expect(g.canBack).toBe(false);
      // next is blocked until a honey is chosen
      g.next();
      expect(g.step).toBe("honey");
    });

    it("advances honey -> additives only after a honey is selected", () => {
      const g = new BlendsGame();
      g.selectHoney("clover");
      expect(g.canNext).toBe(true);
      g.next();
      expect(g.step).toBe("additives");
      expect(g.canBack).toBe(true);
    });

    it("advances additives -> mix only after at least one dose", () => {
      const g = new BlendsGame();
      g.selectHoney("clover");
      g.next();
      // no doses yet -> blocked
      g.next();
      expect(g.step).toBe("additives");
      g.addDose("royalJelly");
      g.next();
      expect(g.step).toBe("mix");
    });

    it("mix requires completing the stir (mixProgress reaches 1)", () => {
      const g = new BlendsGame();
      g.selectHoney("clover");
      g.next();
      g.addDose("royalJelly");
      g.next();
      expect(g.step).toBe("mix");
      // not done yet -> cannot advance (and mix is the last step anyway)
      expect(g.isMixDone).toBe(false);
      expect(g.canNext).toBe(false);
      g.recordStir(0.6);
      expect(g.isMixDone).toBe(false);
      g.recordStir(0.4);
      expect(g.isMixDone).toBe(true);
      expect(g.canNext).toBe(true);
      // mix is the final step; next() stays put
      g.next();
      expect(g.step).toBe("mix");
    });

    it("recordStir clamps progress to [0,1] and ignores non-finite input", () => {
      const g = new BlendsGame();
      g.recordStir(-3);
      expect(g.mixProgress).toBe(0);
      g.recordStir(Number.NaN);
      expect(g.mixProgress).toBe(0);
      g.recordStir(0.2);
      g.recordStir(5);
      expect(g.mixProgress).toBe(1);
    });

    it("back() returns to the previous step without resetting choices", () => {
      const g = new BlendsGame();
      g.selectHoney("clover");
      g.next();
      g.addDose("royalJelly");
      g.next();
      expect(g.step).toBe("mix");
      g.back();
      expect(g.step).toBe("additives");
      expect(g.doses.royalJelly).toBe(1);
      g.back();
      expect(g.step).toBe("honey");
      expect(g.honeyId).toBe("clover");
      g.back();
      expect(g.step).toBe("honey");
    });
  });
});
