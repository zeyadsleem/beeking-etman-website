import { describe, expect, it } from "vite-plus/test";
import { ADDITIVE_KEYS, MAX_DOSE } from "$lib/blends";
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
