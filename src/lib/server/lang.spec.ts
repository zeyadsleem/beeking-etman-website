import { describe, expect, it } from "vite-plus/test";
import { getLang, parseAcceptLanguage } from "./lang";

describe("parseAcceptLanguage", () => {
  it("defaults to Arabic when the header is missing", () => {
    expect(parseAcceptLanguage(null)).toBe("ar");
    expect(parseAcceptLanguage("")).toBe("ar");
  });

  it("picks Arabic when it is the primary language", () => {
    expect(parseAcceptLanguage("ar,en;q=0.9")).toBe("ar");
    expect(parseAcceptLanguage("ar-EG,ar;q=0.9,en;q=0.8")).toBe("ar");
  });

  it("prefers Arabic whenever it is supported, even if English has a higher q-value", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9,ar;q=0.8")).toBe("ar");
  });

  it("uses English only when Arabic is not supported at all", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9,fr;q=0.8")).toBe("en");
  });

  it("respects q=0 exclusions", () => {
    expect(parseAcceptLanguage("en;q=0.9,ar;q=0")).toBe("en");
    expect(parseAcceptLanguage("ar;q=0,en;q=0.9")).toBe("en");
  });

  it("falls back to Arabic for unrelated languages", () => {
    expect(parseAcceptLanguage("fr-FR,fr;q=0.9")).toBe("ar");
  });
});

describe("getLang", () => {
  function makeEvent(header: string | null, cookie?: string) {
    return {
      cookies: {
        get: (name: string) => (name === "lang" ? (cookie ?? null) : null),
      },
      request: {
        headers: {
          get: () => header,
        },
      },
    };
  }

  it("prefers an explicit cookie over the browser header", () => {
    expect(getLang(makeEvent("en-US,en;q=0.9,ar;q=0.8", "ar") as never)).toBe("ar");
    expect(getLang(makeEvent("ar,en;q=0.9", "en") as never)).toBe("en");
  });

  it("uses the browser header when no cookie is set", () => {
    expect(getLang(makeEvent("en-US,en;q=0.9,ar;q=0.8") as never)).toBe("ar");
    expect(getLang(makeEvent("ar-EG,ar;q=0.9,en;q=0.8") as never)).toBe("ar");
  });

  it("defaults to Arabic when neither cookie nor header is available", () => {
    expect(getLang(makeEvent(null) as never)).toBe("ar");
  });
});
