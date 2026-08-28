import { describe, expect, it } from "vite-plus/test";
import { hasMessage, messages, type MessageKey } from "./messages";

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
  "blends.game.step.select",
  "blends.game.step.ingredients",
  "blends.game.step.mix",
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
  "blends.game.bootError",
  "blends.game.action.goals",
  "blends.game.action.honeys",
  "blends.game.action.jarHalf",
  "blends.game.action.jarFull",
  "blends.game.action.doseAdd",
  "blends.game.action.doseRemove",
  "blends.game.action.startStir",
  "blends.game.action.finishStir",
  "blends.game.action.pour",
  "blends.game.action.restart",
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

const SEEDED_CATEGORY_SLUGS = [
  "flowers",
  "sidr",
  "vib",
  "nuts-honey",
  "nuts",
  "comb",
  "bee-supplements",
] as const;

describe("category stories", () => {
  it("has a real story for every seeded category slug in both languages", () => {
    for (const lang of ["ar", "en"] as const) {
      for (const slug of SEEDED_CATEGORY_SLUGS) {
        const key = `category.story.${slug}`;
        const value = messages[lang][key as MessageKey];
        expect(value, `${lang} missing ${key}`).toBeTruthy();
        expect(value, `${lang} renders the raw key for ${key}`).not.toBe(key);
      }
    }
  });
});

describe("hasMessage", () => {
  it("returns true only for defined message keys", () => {
    expect(hasMessage("category.story.vib")).toBe(true);
    expect(hasMessage("category.story.not-a-category")).toBe(false);
    expect(hasMessage("home.title")).toBe(true);
  });
});
