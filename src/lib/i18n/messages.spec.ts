import { describe, expect, it } from "vite-plus/test";
import { messages } from "./messages";

const GAME_KEYS = [
  "blends.game.title",
  "blends.game.subtitle",
  "blends.game.back",
  "blends.game.restart",
  "blends.game.skip",
  "blends.game.step.goal",
  "blends.game.step.honey",
  "blends.game.step.prep",
  "blends.game.step.stir",
  "blends.game.step.pour",
  "blends.game.step.order",
  "blends.game.goal.title",
  "blends.game.goal.subtitle",
  "blends.game.honey.title",
  "blends.game.honey.subtitle",
  "blends.game.honey.sizeHalf",
  "blends.game.honey.sizeFull",
  "blends.game.honey.viewBenefits",
  "blends.game.prep.title",
  "blends.game.prep.subtitle",
  "blends.game.prep.toStir",
  "blends.game.benefits.title",
  "blends.game.stir.title",
  "blends.game.stir.hint",
  "blends.game.stir.done",
  "blends.game.pour.title",
  "blends.game.order.title",
  "blends.game.order.quantity",
  "blends.game.order.unitPrice",
  "blends.game.order.total",
  "blends.game.order.addToCart",
  "blends.game.order.outOfStock",
  "blends.game.fallback.webgl",
  "blends.game.fallback.force2d",
] as const;

function flatten(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

describe("i18n parity", () => {
  it("ar and en expose identical key trees", () => {
    expect(flatten(messages.ar).sort()).toEqual(flatten(messages.en).sort());
  });

  it("has all blends.game keys in both languages", () => {
    for (const lang of ["ar", "en"] as const) {
      const catalog = messages[lang];
      for (const key of GAME_KEYS) {
        expect(catalog[key], `${lang} missing ${key}`).toBeTruthy();
      }
      expect(
        Object.keys(catalog).filter((k) => k.startsWith("blends.game.")).length,
        `${lang} has unexpected blends.game.* keys`,
      ).toBe(GAME_KEYS.length);
    }
  });
});
