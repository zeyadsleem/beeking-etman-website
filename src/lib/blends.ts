import { t, type Lang } from "$lib/i18n/messages";

export type JarSize = "half" | "full";

export const JAR_SIZES: readonly JarSize[] = ["half", "full"];

export type AdditiveKey = "royalJelly" | "propolis" | "ginseng" | "palmPollen" | "beePollen";

export type BlendGoalId = "vitality" | "immunity" | "children" | "digestive" | "energy";

export interface BlendGoal {
  id: BlendGoalId;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  recommended: AdditiveKey[];
}

export const BLEND_GOALS: readonly BlendGoal[] = [
  {
    id: "vitality",
    nameAr: "قوة وحيوية",
    nameEn: "Vitality",
    descAr: "للمتزوجين والمقبلين على الزواج — طاقة اليوم كله وحيوية لا تنتهي.",
    descEn: "For couples and newlyweds — all-day energy and endless vitality.",
    recommended: ["royalJelly", "ginseng", "palmPollen"],
  },
  {
    id: "immunity",
    nameAr: "مناعة",
    nameEn: "Immunity",
    descAr: "درعك الطبيعي ضد تغيّر الفصول وبرد الشتاء.",
    descEn: "Your natural shield against the changing seasons and winter cold.",
    recommended: ["royalJelly", "propolis", "beePollen"],
  },
  {
    id: "children",
    nameAr: "أطفال",
    nameEn: "Kids",
    descAr: "خلطة لطيفة محبوبة للصغار — قوة الطبيعة بدون إفراط.",
    descEn: "A gentle, kid-friendly blend — nature's power without overdoing it.",
    recommended: ["beePollen"],
  },
  {
    id: "digestive",
    nameAr: "معدة وأمعاء",
    nameEn: "Digestive",
    descAr: "دعم المعدة والأمعاء وراحة البال من جرثومة المعدة.",
    descEn: "Digestive support and comfort from stomach bacteria.",
    recommended: ["propolis", "royalJelly"],
  },
  {
    id: "energy",
    nameAr: "طاقة وتركيز",
    nameEn: "Energy & Focus",
    descAr: "لأيامك الطويلة وتركيز صافٍ من الصباح للمساء.",
    descEn: "For your long days and clear focus from morning to night.",
    recommended: ["ginseng", "palmPollen", "royalJelly"],
  },
] as const;

export const JAR_LABELS: Record<JarSize, { ar: string; en: string }> = {
  half: { ar: "نص كيلو", en: "Half kg" },
  full: { ar: "كيلو", en: "1 kg" },
};

export interface BaseHoneyOption {
  id: "clover" | "citrus" | "marjoram" | "sidr" | "blackseed";
  nameAr: string;
  nameEn: string;
  halfProductSlug: string;
  fullProductSlug: string;
}

export const BASE_HONEY_OPTIONS: readonly BaseHoneyOption[] = [
  {
    id: "clover",
    nameAr: "برسيم",
    nameEn: "Clover",
    halfProductSlug: "clover-honey-500g-glass",
    fullProductSlug: "clover-honey-1kg-glass",
  },
  {
    id: "citrus",
    nameAr: "موالح",
    nameEn: "Citrus",
    halfProductSlug: "citrus-honey-half-vib",
    fullProductSlug: "citrus-honey-1kg-vib",
  },
  {
    id: "marjoram",
    nameAr: "بردقوش",
    nameEn: "Marjoram",
    halfProductSlug: "marjoram-honey-500g",
    fullProductSlug: "marjoram-honey-1kg-glass",
  },
  {
    id: "sidr",
    nameAr: "سدر",
    nameEn: "Sidr",
    halfProductSlug: "sidr-honey-500g",
    fullProductSlug: "sidr-honey-1kg",
  },
  {
    id: "blackseed",
    nameAr: "حبة البركة",
    nameEn: "Black Seed",
    halfProductSlug: "blackseed-honey-half",
    fullProductSlug: "blackseed-honey-1kg",
  },
] as const;

export const ADDITIVE_LABELS: Record<AdditiveKey, { ar: string; en: string }> = {
  royalJelly: { ar: "غذاء ملكات", en: "Royal Jelly" },
  propolis: { ar: "بروبليس", en: "Propolis" },
  ginseng: { ar: "جينسنج", en: "Ginseng" },
  palmPollen: { ar: "طلع النخل", en: "Palm Pollen" },
  beePollen: { ar: "حبوب لقاح", en: "Bee Pollen" },
};

export const ADDITIVE_PRODUCT_SLUGS: Record<AdditiveKey, string> = {
  royalJelly: "royal-jelly-5g",
  propolis: "propolis-box",
  ginseng: "ginseng-box",
  palmPollen: "palm-pollen-box",
  beePollen: "bee-pollen-box",
};

export const ADDITIVE_KEYS: readonly AdditiveKey[] = [
  "royalJelly",
  "propolis",
  "ginseng",
  "palmPollen",
  "beePollen",
];

export const DOSE_FOR: Record<AdditiveKey, Record<JarSize, number>> = {
  royalJelly: { half: 1, full: 2 },
  propolis: { half: 1, full: 1 },
  ginseng: { half: 1, full: 2 },
  palmPollen: { half: 1, full: 2 },
  beePollen: { half: 1, full: 2 },
};

export const MAX_DOSE = 3;

export function zeroDoses(): Record<AdditiveKey, number> {
  return Object.fromEntries(ADDITIVE_KEYS.map((k) => [k, 0])) as Record<AdditiveKey, number>;
}

export function jarLabel(lang: Lang, jarSize: JarSize): string {
  return t(lang, jarSize === "full" ? "blends.jarFull" : "blends.jarHalf");
}

export function isAdditiveKey(value: unknown): value is AdditiveKey {
  return typeof value === "string" && value in ADDITIVE_LABELS;
}

export function blendLineDetail(
  variantName: string,
  additives: readonly { name: string; qty: number }[],
): string {
  if (additives.length === 0) return variantName;
  const parts = additives.map((a) => `${a.name} × ${a.qty}`);
  return [variantName, ...parts].join(" · ");
}

export function presetDoses(goal: BlendGoal, jarSize: JarSize): Record<AdditiveKey, number> {
  const doses = zeroDoses();
  for (const key of goal.recommended) {
    doses[key] = DOSE_FOR[key][jarSize];
  }
  return doses;
}
