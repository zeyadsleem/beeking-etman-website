import { describe, expect, it } from "vite-plus/test";
import { validateProductionEnv } from "./env";

const MIN_SECRET_LENGTH = 32;

/** Baseline that satisfies every required var; overrides replace per test. */
function productionVars(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    BETTER_AUTH_SECRET: "s".repeat(MIN_SECRET_LENGTH),
    ORDER_ACCESS_SECRET: "o".repeat(MIN_SECRET_LENGTH),
    ORIGIN: "https://beeking-etman-website.pages.dev",
    ...overrides,
  };
}

describe("validateProductionEnv required vars", () => {
  it("accepts a minimal valid production env", () => {
    expect(() => validateProductionEnv(productionVars())).not.toThrow();
  });

  it("throws when BETTER_AUTH_SECRET is missing", () => {
    expect(() => validateProductionEnv(productionVars({ BETTER_AUTH_SECRET: undefined }))).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("throws when BETTER_AUTH_SECRET is too short", () => {
    expect(() => validateProductionEnv(productionVars({ BETTER_AUTH_SECRET: "short" }))).toThrow(
      new RegExp(`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH}`),
    );
  });

  it("throws when ORDER_ACCESS_SECRET is missing", () => {
    expect(() => validateProductionEnv(productionVars({ ORDER_ACCESS_SECRET: undefined }))).toThrow(
      /ORDER_ACCESS_SECRET/,
    );
  });

  it("throws when ORIGIN is missing", () => {
    expect(() => validateProductionEnv(productionVars({ ORIGIN: undefined }))).toThrow(/ORIGIN/);
  });
});

describe("validateProductionEnv optional ADMIN_EMAIL", () => {
  it("accepts a plausible email address", () => {
    expect(() =>
      validateProductionEnv(productionVars({ ADMIN_EMAIL: "owner@beeking.com" })),
    ).not.toThrow();
  });

  it("rejects a malformed email address", () => {
    expect(() => validateProductionEnv(productionVars({ ADMIN_EMAIL: "not-an-email" }))).toThrow(
      /ADMIN_EMAIL/,
    );
  });

  it("rejects an empty value", () => {
    expect(() => validateProductionEnv(productionVars({ ADMIN_EMAIL: "" }))).toThrow(/ADMIN_EMAIL/);
  });

  it("rejects a whitespace-only value", () => {
    expect(() => validateProductionEnv(productionVars({ ADMIN_EMAIL: "   " }))).toThrow(
      /ADMIN_EMAIL/,
    );
  });
});
