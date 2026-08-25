import { describe, expect, it } from "vite-plus/test";
import { ADDITIVE_KEYS, BLEND_GOALS, MAX_DOSE, presetDoses } from "$lib/blends";
import { BlendsGame } from "./game-state.svelte";

describe("BlendsGame flow", () => {
  it("starts at goal with empty state", () => {
    const g = new BlendsGame();
    expect(g.step).toBe("goal");
    expect(g.goal).toBeNull();
    expect(g.honeyId).toBeNull();
    expect(g.jarFill).toBe(0);
    expect(g.quantity).toBe(1);
  });

  it("selectGoal presets doses and advances to honey", () => {
    const g = new BlendsGame();
    g.selectGoal("immunity");
    expect(g.step).toBe("honey");
    expect(g.goal).toBe("immunity");
    expect(Object.values(g.doses).some((v) => v > 0)).toBe(true);
  });

  it("setJarSize re-presets doses when a goal exists", () => {
    const g = new BlendsGame();
    g.selectGoal("immunity");
    const before = { ...g.doses };
    g.setJarSize("half");
    expect(g.jarSize).toBe("half");
    expect(g.doses).toEqual(presetDoses(BLEND_GOALS[1], "half"));
    expect(g.doses).not.toEqual(before);
  });

  it("setJarSize keeps doses zeroed when no goal selected", () => {
    const g = new BlendsGame();
    g.setJarSize("half");
    expect(g.jarSize).toBe("half");
    expect(Object.values(g.doses).every((v) => v === 0)).toBe(true);
  });

  it("selectHoney advances to prep; addDose clamps at MAX_DOSE", () => {
    const g = new BlendsGame();
    g.selectGoal("energy");
    g.selectHoney("clover");
    expect(g.step).toBe("prep");
    for (let i = 0; i < 10; i++) g.addDose("propolis");
    expect(g.doses.propolis).toBe(MAX_DOSE);
    g.removeDose("propolis");
    expect(g.doses.propolis).toBe(MAX_DOSE - 1);
  });

  it("finishStir requires completion but forceFinishStir always pours", () => {
    const g = new BlendsGame();
    g.selectGoal("vitality");
    g.selectHoney("sidr");
    g.startStir();
    expect(g.step).toBe("stir");
    g.finishStir();
    expect(g.step).toBe("stir");
    g.forceFinishStir();
    expect(g.step).toBe("pour");
  });

  it("recordStir accumulates progress toward 1", () => {
    const g = new BlendsGame();
    g.selectGoal("vitality");
    g.selectHoney("sidr");
    g.startStir();
    for (let i = 0; i < 20; i++) g.recordStir(0.5);
    expect(g.mixProgress).toBeGreaterThan(0);
  });

  it("completePour moves to order and quantity clamps", () => {
    const g = new BlendsGame();
    g.selectGoal("children");
    g.selectHoney("citrus");
    g.startStir();
    g.forceFinishStir();
    g.setJarFill(1);
    g.completePour();
    expect(g.step).toBe("order");
    g.setQuantity(99, 10);
    expect(g.quantity).toBe(10);
    g.setQuantity(0, 10);
    expect(g.quantity).toBe(1);
  });

  it("goBack walks backwards but never from pour/order/goal", () => {
    const g = new BlendsGame();
    expect(g.goBack()).toBe(false);
    g.selectGoal("digestive");
    g.selectHoney("marjoram");
    expect(g.goBack()).toBe(true);
    expect(g.step).toBe("honey");
    expect(g.goBack()).toBe(true);
    expect(g.step).toBe("goal");
    expect(g.goBack()).toBe(false);

    g.selectGoal("digestive");
    g.selectHoney("marjoram");
    g.startStir();
    g.forceFinishStir();
    expect(g.step).toBe("pour");
    expect(g.goBack()).toBe(false);
    g.completePour();
    expect(g.step).toBe("order");
    expect(g.goBack()).toBe(false);
  });

  it("canBack tracks reversibility across the flow", () => {
    const g = new BlendsGame();
    expect(g.canBack).toBe(false);
    g.selectGoal("digestive");
    expect(g.canBack).toBe(true);
    g.selectHoney("marjoram");
    expect(g.canBack).toBe(true);
    g.startStir();
    expect(g.canBack).toBe(true);
    g.forceFinishStir();
    expect(g.canBack).toBe(false);
    g.completePour();
    expect(g.canBack).toBe(false);

    g.reset();
    g.selectGoal("digestive");
    g.selectHoney("marjoram");
    expect(g.goBack()).toBe(true);
    expect(g.step).toBe("honey");
    expect(g.canBack).toBe(true);
    expect(g.goBack()).toBe(true);
    expect(g.step).toBe("goal");
    expect(g.canBack).toBe(false);
  });

  it("reset returns everything to initial values", () => {
    const g = new BlendsGame();
    g.selectGoal("immunity");
    g.selectHoney("sidr");
    g.reset();
    expect(g.step).toBe("goal");
    expect(g.goal).toBeNull();
    expect(g.honeyId).toBeNull();
    expect(Object.values(g.doses).every((v) => v === 0)).toBe(true);
  });

  it("exposes every additive key in doses", () => {
    const g = new BlendsGame();
    for (const k of ADDITIVE_KEYS) expect(g.doses[k]).toBe(0);
  });
});
