export type GovernorateCode =
  | "cairo"
  | "giza"
  | "alexandria"
  | "delta"
  | "upper"
  | "canal"
  | "remote";

export interface GovernorateZone {
  code: GovernorateCode;
  /** Billing price in piasters for delivery to this zone. */
  price: number;
}

/**
 * Egyptian shipping zones. Prices are the default planner values (minor-unit
 * piasters, ×100). The owner can adjust the per-zone price list without a
 * migration — it's plain data.
 */
export const GOVERNORATES: readonly GovernorateZone[] = [
  { code: "cairo", price: 45_00 },
  { code: "giza", price: 45_00 },
  { code: "alexandria", price: 55_00 },
  { code: "delta", price: 55_00 },
  { code: "canal", price: 65_00 },
  { code: "upper", price: 85_00 },
  { code: "remote", price: 100_00 },
] as const;

export const GOVERNORATE_ORDER: readonly GovernorateCode[] = [
  "cairo",
  "giza",
  "alexandria",
  "delta",
  "canal",
  "upper",
  "remote",
];

export const DEFAULT_GOVERNORATE: GovernorateCode = "cairo";

export const FREE_SHIPPING_THRESHOLD = 600_00;

export function isGovernorateCode(value: unknown): value is GovernorateCode {
  return typeof value === "string" && GOVERNORATES.some((z) => z.code === value);
}

export function governoratePrice(code: unknown): number {
  if (isGovernorateCode(code)) {
    const zone = GOVERNORATES.find((z) => z.code === code);
    if (zone) return zone.price;
  }
  return 0;
}

/**
 * Shipping fee in piasters for a subtotal to a zone. Delivery is free once the
 * subtotal clears the free-shipping threshold (matches the historic flat rule).
 */
export function computeShipping(subtotal: number, governorate: unknown): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : governoratePrice(governorate);
}
