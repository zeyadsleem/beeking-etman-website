import { describe, expect, it } from "vite-plus/test";
import { hasMessage, messages, type MessageKey } from "./messages";

function flatten(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

describe("i18n parity", () => {
  it("ar and en expose identical key trees", () => {
    expect(flatten(messages.ar).sort()).toEqual(flatten(messages.en).sort());
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
