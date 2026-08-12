import { describe, expect, it } from "vite-plus/test";
import { formatEGP } from "./currency";

describe("formatEGP", () => {
  it("formats whole pounds in Arabic digits with EGP symbol", () => {
    expect(formatEGP(26000)).toMatch(/٢٦٠/);
    expect(formatEGP(26000)).toContain("ج.م.");
  });
  it("includes qirsh decimals", () => {
    const out = formatEGP(26450);
    expect(out).toMatch(/٢٦٤/);
    expect(out).toContain("٥٠");
  });
  it("handles zero", () => {
    expect(formatEGP(0)).toContain("٠");
  });
  it("guards invalid input", () => {
    expect(formatEGP(-1)).toBe("—");
  });
});
