import { V1_PAYMENT_METHODS, type V1PaymentMethod } from "$lib/settlement/types";

export const DEFAULT_HOLD_MINUTES = 1440;

export interface SettlementConfig {
  codEnabled: boolean;
  instapayAddress: string | null;
  walletNumber: string | null;
}

type Env = Record<string, string | undefined>;

function enabledFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Reads the v1 settlement configuration; a method is offered only when its inputs exist. */
export function settlementConfig(env: Env): SettlementConfig {
  return {
    codEnabled: enabledFlag(env.PAYMENTS_COD_ENABLED, true),
    instapayAddress: trimmedOrNull(env.PAYMENT_INSTAPAY_ADDRESS),
    walletNumber: trimmedOrNull(env.PAYMENT_WALLET_NUMBER),
  };
}

export function availablePaymentMethods(config: SettlementConfig): V1PaymentMethod[] {
  return V1_PAYMENT_METHODS.filter((method) => {
    if (method === "cod") return config.codEnabled;
    if (method === "instapay") return config.instapayAddress !== null;
    return config.walletNumber !== null;
  });
}

export function isPaymentMethodAvailable(
  config: SettlementConfig,
  method: V1PaymentMethod,
): boolean {
  return availablePaymentMethods(config).includes(method);
}

/** The account the customer transfers to for a transfer method. */
export function receivingAccountFor(
  config: SettlementConfig,
  method: V1PaymentMethod,
): string | null {
  if (method === "instapay") return config.instapayAddress;
  if (method === "wallet") return config.walletNumber;
  return null;
}

/** Hold window in minutes; COD may override with COD_HOLD_MINUTES. */
export function holdMinutesFor(method: V1PaymentMethod, env: Env): number {
  const raw =
    method === "cod" ? (env.COD_HOLD_MINUTES ?? env.ORDER_HOLD_MINUTES) : env.ORDER_HOLD_MINUTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_HOLD_MINUTES;
}

export function holdDeadline(method: V1PaymentMethod, env: Env, now: number = Date.now()): number {
  return now + holdMinutesFor(method, env) * 60_000;
}
