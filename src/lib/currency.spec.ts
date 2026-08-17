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
  it("formats in Western digits with EGP for English", () => {
    const out = formatEGP(26450, "en");
    expect(out).toMatch(/264\.50/);
    expect(out).toContain("EGP");
    expect(out).not.toMatch(/[٠-٩]/);
  });
  it("defaults to Arabic when lang is omitted", () => {
    expect(formatEGP(26000)).toContain("ج.م.");
  });
});
