import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { hasWebGL } from "./webgl";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCanvas(contexts: Record<string, unknown>): void {
  const fake = {
    getContext: (type: string): unknown => contexts[type] ?? null,
  };
  vi.stubGlobal("document", {
    createElement: (tag: string): unknown => (tag === "canvas" ? fake : null),
  });
}

describe("hasWebGL", () => {
  it("returns true when webgl2 context is available", () => {
    stubCanvas({ webgl2: {} });
    expect(hasWebGL()).toBe(true);
  });

  it("returns true when only webgl1 is available", () => {
    stubCanvas({ webgl: {} });
    expect(hasWebGL()).toBe(true);
  });

  it("returns false when no context is available", () => {
    stubCanvas({});
    expect(hasWebGL()).toBe(false);
  });

  it("returns false when canvas creation throws", () => {
    vi.stubGlobal("document", {
      createElement: (): never => {
        throw new Error("boom");
      },
    });
    expect(hasWebGL()).toBe(false);
  });
});
