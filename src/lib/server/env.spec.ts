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

  it("throws when ORIGIN is not an absolute URL", () => {
    expect(() => validateProductionEnv(productionVars({ ORIGIN: "not-a-url" }))).toThrow(
      /ORIGIN must be an absolute https URL/,
    );
  });

  it("throws when ORIGIN is not https", () => {
    expect(() =>
      validateProductionEnv(productionVars({ ORIGIN: "http://beeking-etman-website.pages.dev" })),
    ).toThrow(/ORIGIN must be an absolute https URL/);
  });

  it("accepts an http loopback origin used by the local preview and e2e", () => {
    expect(() =>
      validateProductionEnv(productionVars({ ORIGIN: "http://localhost:4173" })),
    ).not.toThrow();
    expect(() =>
      validateProductionEnv(productionVars({ ORIGIN: "http://127.0.0.1:4173" })),
    ).not.toThrow();
  });
});

describe("validateProductionEnv optional CART_SIGNING_SECRET", () => {
  it("accepts a dedicated cart signing secret of sufficient length", () => {
    expect(() =>
      validateProductionEnv(productionVars({ CART_SIGNING_SECRET: "c".repeat(32) })),
    ).not.toThrow();
  });

  it("rejects a short dedicated cart signing secret", () => {
    expect(() => validateProductionEnv(productionVars({ CART_SIGNING_SECRET: "short" }))).toThrow(
      /CART_SIGNING_SECRET/,
    );
  });
});

describe("validateProductionEnv optional WHATSAPP_NUMBER", () => {
  it("accepts international and Egyptian local forms", () => {
    expect(() =>
      validateProductionEnv(productionVars({ WHATSAPP_NUMBER: "+20 100 000 0000" })),
    ).not.toThrow();
    expect(() =>
      validateProductionEnv(productionVars({ WHATSAPP_NUMBER: "01012345678" })),
    ).not.toThrow();
  });

  it("rejects a value that cannot be a number", () => {
    expect(() => validateProductionEnv(productionVars({ WHATSAPP_NUMBER: "123" }))).toThrow(
      /WHATSAPP_NUMBER/,
    );
    expect(() =>
      validateProductionEnv(productionVars({ WHATSAPP_NUMBER: "011234567890" })),
    ).toThrow(/WHATSAPP_NUMBER/);
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
