import { describe, expect, it } from "vite-plus/test";
import { ADDITIVE_KEYS, BLEND_GOALS, zeroDoses, DOSE_FOR } from "$lib/blends";
import { BlendsGame } from "./game-state.svelte";

function presetFor(goalId: (typeof BLEND_GOALS)[number]["id"], jarSize: "half" | "full") {
  const goal = BLEND_GOALS.find((g) => g.id === goalId)!;
  const doses = zeroDoses();
  for (const key of goal.recommended) doses[key] = DOSE_FOR[key][jarSize];
  return doses;
}

describe("BlendsGame configurator", () => {
  it("starts empty with a full jar and quantity 1", () => {
    const g = new BlendsGame();
    expect(g.goalId).toBeNull();
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

  it("selectGoal applies the goal's recommended preset doses and exposes them", () => {
    const g = new BlendsGame();
    expect(g.recommendedAdditives).toEqual([]);
    expect(g.isRecommended("royalJelly")).toBe(false);
    g.selectGoal("vitality");
    expect(g.goalId).toBe("vitality");
    expect(g.recommendedAdditives).toEqual(["royalJelly", "ginseng", "palmPollen"]);
    expect(g.isRecommended("royalJelly")).toBe(true);
    expect(g.isRecommended("propolis")).toBe(false);
    expect(g.doses).toEqual(presetFor("vitality", "full"));
  });

  it("clearing a goal resets doses to zero", () => {
    const g = new BlendsGame();
    g.selectGoal("vitality");
    g.selectGoal(null);
    expect(g.goalId).toBeNull();
    expect(g.doses).toEqual(zeroDoses());
  });

  it("setJarSize keeps doses when no goal is active", () => {
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

  it("setJarSize re-applies the goal's recommended doses", () => {
    const g = new BlendsGame();
    g.selectGoal("immunity");
    const fullDoses = { ...g.doses };
    g.setJarSize("half");
    expect(g.jarSize).toBe("half");
    expect(g.doses).toEqual(presetFor("immunity", "half"));
    g.setJarSize("full");
    expect(g.doses).toEqual(presetFor("immunity", "full"));
    expect(g.doses).toEqual(fullDoses);
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

  it("reset clears the goal, honey, doses, mix progress and quantity but keeps the jar size", () => {
    const g = new BlendsGame();
    g.selectGoal("energy");
    g.selectHoney("sidr");
    g.setJarSize("half");
    g.recordStir(0.5);
    g.setQuantity(4, 10);
    g.reset();
    expect(g.goalId).toBeNull();
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
    it("starts on goal and cannot back from it", () => {
      const g = new BlendsGame();
      expect(g.step).toBe("goal");
      expect(g.canBack).toBe(false);
      g.next();
      expect(g.step).toBe("goal");
      expect(g.canNext).toBe(false);
    });

    it("advances goal -> honey only after a goal is selected", () => {
      const g = new BlendsGame();
      g.selectGoal("immunity");
      expect(g.canNext).toBe(true);
      g.next();
      expect(g.step).toBe("honey");
      expect(g.canBack).toBe(true);
    });

    it("does not advance past honey until a honey is selected", () => {
      const g = new BlendsGame();
      g.selectGoal("immunity");
      g.next();
      g.next();
      expect(g.step).toBe("honey");
      g.selectHoney("clover");
      expect(g.canNext).toBe(true);
      g.next();
      expect(g.step).toBe("additives");
    });

    it("advances additives -> mix once there is at least one dose", () => {
      const g = new BlendsGame();
      g.selectGoal("immunity");
      g.next();
      g.selectHoney("clover");
      g.next();
      expect(g.canNext).toBe(true);
      g.next();
      expect(g.step).toBe("mix");
    });

    it("mix requires completing the stir (mixProgress reaches 1)", () => {
      const g = new BlendsGame();
      g.selectGoal("immunity");
      g.next();
      g.selectHoney("clover");
      g.next();
      g.next();
      expect(g.step).toBe("mix");
      expect(g.isMixDone).toBe(false);
      expect(g.canNext).toBe(false);
      g.recordStir(0.6);
      expect(g.isMixDone).toBe(false);
      g.recordStir(0.4);
      expect(g.isMixDone).toBe(true);
      expect(g.canNext).toBe(true);
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
      g.selectGoal("energy");
      g.next();
      g.selectHoney("clover");
      g.next();
      g.next();
      expect(g.step).toBe("mix");
      g.back();
      expect(g.step).toBe("additives");
      expect(g.doses.ginseng).toBeGreaterThan(0);
      g.back();
      expect(g.step).toBe("honey");
      expect(g.honeyId).toBe("clover");
      g.back();
      expect(g.step).toBe("goal");
      expect(g.goalId).toBe("energy");
      g.back();
      expect(g.step).toBe("goal");
    });
  });
});
