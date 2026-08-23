import { ADDITIVE_KEYS, type AdditiveKey, type BaseHoneyOption, type JarSize } from "$lib/blends";

export interface PricedBaseVariant {
  price: number;
}

export interface PricedAdditive {
  price: number;
}

export type BaseHoneyCatalog = readonly (readonly [
  BaseHoneyOption["id"],
  Record<JarSize, PricedBaseVariant>,
])[];

export type AdditiveCatalog = readonly (readonly [AdditiveKey, PricedAdditive])[];

export function blendUnitPrice(
  baseHoneys: BaseHoneyCatalog,
  additives: AdditiveCatalog,
  honeyId: BaseHoneyOption["id"] | null,
  jarSize: JarSize,
  doses: Record<AdditiveKey, number>,
): number {
  let total = 0;
  if (honeyId) {
    const variant = baseHoneys.find(([id]) => id === honeyId)?.[1][jarSize];
    if (variant) total += variant.price;
  }
  const priceByKey = new Map(additives);
  for (const key of ADDITIVE_KEYS) {
    const dose = doses[key];
    if (dose <= 0) continue;
    total += (priceByKey.get(key)?.price ?? 0) * dose;
  }
  return total;
}
