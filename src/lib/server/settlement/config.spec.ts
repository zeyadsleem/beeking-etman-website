import { describe, expect, it } from "vite-plus/test";
import {
  availablePaymentMethods,
  DEFAULT_HOLD_MINUTES,
  holdDeadline,
  holdMinutesFor,
  isPaymentMethodAvailable,
  receivingAccountFor,
  settlementConfig,
} from "./config";

describe("settlementConfig", () => {
  it("offers COD only when no transfer accounts are configured", () => {
    const config = settlementConfig({});
    expect(config).toEqual({
      codEnabled: true,
      instapayAddress: null,
      walletNumber: null,
      whatsappNumber: null,
    });
    expect(availablePaymentMethods(config)).toEqual(["cod"]);
  });

  it("offers transfer methods only when their account exists", () => {
    const config = settlementConfig({
      PAYMENT_INSTAPAY_ADDRESS: " shop@instapay ",
      PAYMENT_WALLET_NUMBER: "01000000000",
    });
    expect(availablePaymentMethods(config)).toEqual(["cod", "instapay", "wallet"]);
    expect(receivingAccountFor(config, "instapay")).toBe("shop@instapay");
    expect(receivingAccountFor(config, "wallet")).toBe("01000000000");
    expect(receivingAccountFor(config, "cod")).toBeNull();
  });

  it("honors explicit disables", () => {
    const config = settlementConfig({
      PAYMENTS_COD_ENABLED: "false",
      PAYMENT_WALLET_NUMBER: "0100",
    });
    expect(availablePaymentMethods(config)).toEqual(["wallet"]);
    expect(isPaymentMethodAvailable(config, "cod")).toBe(false);
  });
});

describe("hold window", () => {
  it("defaults to 24 hours", () => {
    expect(holdMinutesFor("cod", {})).toBe(DEFAULT_HOLD_MINUTES);
    expect(holdMinutesFor("instapay", {})).toBe(DEFAULT_HOLD_MINUTES);
  });

  it("lets COD override and rejects nonsense values", () => {
    expect(holdMinutesFor("cod", { ORDER_HOLD_MINUTES: "60", COD_HOLD_MINUTES: "180" })).toBe(180);
    expect(holdMinutesFor("instapay", { ORDER_HOLD_MINUTES: "60" })).toBe(60);
    expect(holdMinutesFor("instapay", { ORDER_HOLD_MINUTES: "abc" })).toBe(DEFAULT_HOLD_MINUTES);
    expect(holdMinutesFor("instapay", { ORDER_HOLD_MINUTES: "-5" })).toBe(DEFAULT_HOLD_MINUTES);
    // A broken COD override falls back to the global window, not the default.
    expect(holdMinutesFor("cod", { ORDER_HOLD_MINUTES: "60", COD_HOLD_MINUTES: "abc" })).toBe(60);
    expect(holdMinutesFor("cod", { ORDER_HOLD_MINUTES: "60", COD_HOLD_MINUTES: "" })).toBe(60);
  });

  it("caps absurd windows at 30 days", () => {
    expect(holdMinutesFor("instapay", { ORDER_HOLD_MINUTES: "1e15" })).toBe(43_200);
  });

  it("computes the deadline from the injected clock", () => {
    expect(holdDeadline("cod", { ORDER_HOLD_MINUTES: "30" }, 1_000)).toBe(1_000 + 30 * 60_000);
  });
});
