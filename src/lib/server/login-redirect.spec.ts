import { describe, expect, it } from "vite-plus/test";
import { loginRedirectPath, safeRedirectTarget } from "./login-redirect";

describe("loginRedirectPath", () => {
  it("preserves the current path as the redirectTo target", () => {
    expect(loginRedirectPath(new URL("https://example.test/account"))).toBe(
      "/login?redirectTo=%2Faccount",
    );
  });

  it("preserves path and query string", () => {
    expect(loginRedirectPath(new URL("https://example.test/account/orders/x?lang=en"))).toBe(
      "/login?redirectTo=%2Faccount%2Forders%2Fx%3Flang%3Den",
    );
  });
});

describe("safeRedirectTarget", () => {
  it("accepts absolute-path targets", () => {
    expect(safeRedirectTarget("/account")).toBe("/account");
    expect(safeRedirectTarget("/account/orders/abc?x=1")).toBe("/account/orders/abc?x=1");
  });

  it("rejects protocol-relative and scheme-based open redirects", () => {
    expect(safeRedirectTarget("//evil.example")).toBe("/account");
    expect(safeRedirectTarget("https://evil.example")).toBe("/account");
    expect(safeRedirectTarget("javascript:alert(1)")).toBe("/account");
  });

  it("rejects backslash tricks that WHATWG parsing sends off-origin", () => {
    // Browsers parse "\" as "/" in special schemes, so "/\evil.example"
    // resolves like "//evil.example".
    expect(safeRedirectTarget("/\\evil.example")).toBe("/account");
    expect(safeRedirectTarget("/\\//evil.example")).toBe("/account");
  });

  it("rejects the percent-encoded (%2F%5C) form of the same bypass", () => {
    // In production the value arrives via searchParams.get, which decodes
    // "?redirectTo=%2F%5Cevil.example" to "/\evil.example" before validation.
    const decoded = new URL(
      "https://example.test/login?redirectTo=%2F%5Cevil.example",
    ).searchParams.get("redirectTo");
    expect(decoded).toBe("/\\evil.example");
    expect(safeRedirectTarget(decoded)).toBe("/account");
  });

  it("falls back to /account for missing or empty values", () => {
    expect(safeRedirectTarget(null)).toBe("/account");
    expect(safeRedirectTarget(undefined)).toBe("/account");
    expect(safeRedirectTarget("")).toBe("/account");
  });
});
