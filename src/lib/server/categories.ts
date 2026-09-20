/**
 * Complete category tree for the Beeking Etman store.
 *
 * Parent categories (department-level) have no parentSlug.
 * Subcategories reference their parent via `parentSlug`.
 * The seed script resolves slugs → database IDs at runtime.
 */

export type Department = "honey" | "equipment";

export interface CategoryNode {
  /** URL-safe identifier */
  slug: string;
  /** Arabic display name */
  name: string;
  /** English display name */
  nameEn: string;
  /** Which storefront department */
  department: Department;
  /** Slug of parent category (undefined for department-level) */
  parentSlug?: string;
}

// ---------------------------------------------------------------------------
// Honey & Hive Products department (عسل ومنتجات الخلية)
// ---------------------------------------------------------------------------

const honeyClover: CategoryNode[] = [
  {
    slug: "clover",
    name: "عسل برسيم",
    nameEn: "Clover Honey",
    department: "honey",
  },
  {
    slug: "citrus",
    name: "عسل موالح",
    nameEn: "Citrus Honey",
    department: "honey",
  },
];

const honeyFlowers: CategoryNode[] = [
  {
    slug: "flowers",
    name: "عسل زهور حبة البركة والبردقوش",
    nameEn: "Flower Honey",
    department: "honey",
  },
  {
    slug: "black-seed",
    name: "عسل حبة البركة",
    nameEn: "Black Seed Honey",
    department: "honey",
    parentSlug: "flowers",
  },
  {
    slug: "marjoram",
    name: "عسل بردقوش",
    nameEn: "Marjoram Honey",
    department: "honey",
    parentSlug: "flowers",
  },
];

const honeySupplements: CategoryNode[] = [
  {
    slug: "honey-supplements",
    name: "مكملات العسل",
    nameEn: "Honey Supplements",
    department: "honey",
  },
  {
    slug: "royal-jelly",
    name: "غذاء ملكات",
    nameEn: "Royal Jelly",
    department: "honey",
    parentSlug: "honey-supplements",
  },
  {
    slug: "pollen",
    name: "حبوب لقاح",
    nameEn: "Bee Pollen",
    department: "honey",
    parentSlug: "honey-supplements",
  },
  {
    slug: "propolis",
    name: "بروبليس",
    nameEn: "Propolis",
    department: "honey",
    parentSlug: "honey-supplements",
  },
  {
    slug: "supplements",
    name: "مكملات",
    nameEn: "Supplements",
    department: "honey",
    parentSlug: "honey-supplements",
  },
];

const honeySidr: CategoryNode[] = [
  {
    slug: "sidr",
    name: "عسل سدر",
    nameEn: "Sidr Honey",
    department: "honey",
  },
];

const honeyVib: CategoryNode[] = [
  {
    slug: "vib",
    name: "عسل الـ Vib",
    nameEn: "Vib Honey",
    department: "honey",
  },
];

const honeyComb: CategoryNode[] = [
  {
    slug: "comb-honey",
    name: "شمع العسل",
    nameEn: "Comb Honey",
    department: "honey",
  },
];

const honeyNuts: CategoryNode[] = [
  {
    slug: "nuts-honey",
    name: "مكسرات بالعسل",
    nameEn: "Honey with Nuts",
    department: "honey",
  },
];

const honeyBlends: CategoryNode[] = [
  {
    slug: "blends",
    name: "خلطات جاهزة",
    nameEn: "Ready-made blends",
    department: "honey",
  },
];

const honeyNutsDept: CategoryNode[] = [
  {
    slug: "nuts",
    name: "مكسرات",
    nameEn: "Nuts",
    department: "honey",
  },
  {
    slug: "mixed-nuts",
    name: "مكسرات مشكله",
    nameEn: "Mixed Nuts",
    department: "honey",
    parentSlug: "nuts",
  },
  {
    slug: "single-nuts",
    name: "مكسرات مفردة",
    nameEn: "Single Nuts",
    department: "honey",
    parentSlug: "nuts",
  },
];

// ---------------------------------------------------------------------------
// Equipment department (أدوات النحالين)
// ---------------------------------------------------------------------------

const hiveEquipment: CategoryNode[] = [
  {
    slug: "hive-equipment",
    name: "خلايا وأجزاؤها",
    nameEn: "Hives & Parts",
    department: "equipment",
  },
  {
    slug: "swedish-parts",
    name: "قطاعات سويد",
    nameEn: "Swedish Parts",
    department: "equipment",
    parentSlug: "hive-equipment",
  },
  {
    slug: "travel-hive",
    name: "صناديق سفر",
    nameEn: "Travel Hives",
    department: "equipment",
    parentSlug: "hive-equipment",
  },
  {
    slug: "frames",
    name: "برواز",
    nameEn: "Frames",
    department: "equipment",
    parentSlug: "hive-equipment",
  },
  {
    slug: "metal-sheets",
    name: "شرائح صاج",
    nameEn: "Metal Sheets",
    department: "equipment",
    parentSlug: "hive-equipment",
  },
  {
    slug: "queen-cages",
    name: "قفاص ملكات",
    nameEn: "Queen Cages",
    department: "equipment",
    parentSlug: "hive-equipment",
  },
  {
    slug: "feeders",
    name: "غذايات",
    nameEn: "Feeders",
    department: "equipment",
    parentSlug: "hive-equipment",
  },
  {
    slug: "queen-excluders",
    name: "حواجز ملكات",
    nameEn: "Queen Excluders",
    department: "equipment",
    parentSlug: "hive-equipment",
  },
  {
    slug: "other-hive",
    name: "أخرى",
    nameEn: "Other Hive Parts",
    department: "equipment",
    parentSlug: "hive-equipment",
  },
];

const extraction: CategoryNode[] = [
  {
    slug: "extraction",
    name: "فراز واستخراج",
    nameEn: "Extraction",
    department: "equipment",
  },
  {
    slug: "extractors",
    name: "فرازات",
    nameEn: "Extractors",
    department: "equipment",
    parentSlug: "extraction",
  },
  {
    slug: "ripeners",
    name: "مناضج",
    nameEn: "Ripeners",
    department: "equipment",
    parentSlug: "extraction",
  },
  {
    slug: "other-extraction",
    name: "أخرى",
    nameEn: "Other Extraction",
    department: "equipment",
    parentSlug: "extraction",
  },
];

const protection: CategoryNode[] = [
  {
    slug: "protection",
    name: "ملابس وقاية",
    nameEn: "Protection",
    department: "equipment",
  },
  {
    slug: "veils",
    name: "أقنعة",
    nameEn: "Veils",
    department: "equipment",
    parentSlug: "protection",
  },
  {
    slug: "suits",
    name: "أفرولات",
    nameEn: "Suits",
    department: "equipment",
    parentSlug: "protection",
  },
  {
    slug: "gloves",
    name: "جوانتي",
    nameEn: "Gloves",
    department: "equipment",
    parentSlug: "protection",
  },
  {
    slug: "other-protection",
    name: "أخرى",
    nameEn: "Other Protection",
    department: "equipment",
    parentSlug: "protection",
  },
];

const tools: CategoryNode[] = [
  {
    slug: "tools",
    name: "أدوات تشغيل",
    nameEn: "Tools",
    department: "equipment",
  },
  {
    slug: "smokers",
    name: "مدخنات",
    nameEn: "Smokers",
    department: "equipment",
    parentSlug: "tools",
  },
  {
    slug: "bee-brushes",
    name: "فراش نحل",
    nameEn: "Bee Brushes",
    department: "equipment",
    parentSlug: "tools",
  },
  {
    slug: "traps",
    name: "مصايد",
    nameEn: "Traps",
    department: "equipment",
    parentSlug: "tools",
  },
  {
    slug: "grafting",
    name: "تطعيم",
    nameEn: "Grafting",
    department: "equipment",
    parentSlug: "tools",
  },
  {
    slug: "sprays",
    name: "بخاخات",
    nameEn: "Sprays",
    department: "equipment",
    parentSlug: "tools",
  },
  {
    slug: "other-tools",
    name: "أخرى",
    nameEn: "Other Tools",
    department: "equipment",
    parentSlug: "tools",
  },
];

const packaging: CategoryNode[] = [
  {
    slug: "packaging",
    name: "تعبئة وتغليف",
    nameEn: "Packaging & Containers",
    department: "equipment",
  },
  {
    slug: "jars",
    name: "برطمانات",
    nameEn: "Jars",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "cartons",
    name: "كراتين",
    nameEn: "Cartons",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "lids",
    name: "أغطية",
    nameEn: "Lids",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "shrink-wrap",
    name: "شرنك",
    nameEn: "Shrink Wrap",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "nut-netting",
    name: "شبك مكسرات",
    nameEn: "Nut Netting",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "fridge-containers",
    name: "علب ثلاجة",
    nameEn: "Fridge Containers",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "empty-comb-containers",
    name: "علب شمع بالعسل فارغة",
    nameEn: "Empty Comb Containers",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "honey-tin",
    name: "صفيح عسل",
    nameEn: "Honey Tin",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "honey-spoons",
    name: "ملاعق عسل",
    nameEn: "Honey Spoons",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "fermentation-bags",
    name: "أكياس تعفن",
    nameEn: "Fermentation Bags",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "tape-roll",
    name: "بكره لصق",
    nameEn: "Tape Roll",
    department: "equipment",
    parentSlug: "packaging",
  },
  {
    slug: "drum-30kg",
    name: "جركن 30 كجم",
    nameEn: "30kg Drum",
    department: "equipment",
    parentSlug: "packaging",
  },
];

const foundationWax: CategoryNode[] = [
  {
    slug: "foundation-wax",
    name: "شمع أساس",
    nameEn: "Foundation Wax",
    department: "equipment",
  },
  {
    slug: "foundation-local",
    name: "شمع أساس بلدي",
    nameEn: "Local Foundation",
    department: "equipment",
    parentSlug: "foundation-wax",
  },
  {
    slug: "foundation-export",
    name: "شمع أساس",
    nameEn: "Foundation Wax",
    department: "equipment",
    parentSlug: "foundation-wax",
  },
];

const treatments: CategoryNode[] = [
  {
    slug: "treatments",
    name: "أدوية وعلاجات",
    nameEn: "Medicines & Treatments",
    department: "equipment",
  },
];

const byQuantity: CategoryNode[] = [
  {
    slug: "by-quantity",
    name: "منتجات بالكمية",
    nameEn: "Products by Quantity",
    department: "equipment",
  },
];

// ---------------------------------------------------------------------------
// Export complete tree (parents first, then subcategories)
// ---------------------------------------------------------------------------

export const CATEGORY_TREE: CategoryNode[] = [
  ...honeyClover,
  ...honeyFlowers,
  ...honeySupplements,
  ...honeySidr,
  ...honeyVib,
  ...honeyComb,
  ...honeyNuts,
  ...honeyBlends,
  ...honeyNutsDept,
  ...hiveEquipment,
  ...extraction,
  ...protection,
  ...tools,
  ...packaging,
  ...foundationWax,
  ...treatments,
  ...byQuantity,
];

/**
 * Look up a category node by slug.
 * Returns undefined if the slug is not in the tree.
 */
export function getCategoryBySlug(slug: string): CategoryNode | undefined {
  return CATEGORY_TREE.find((c) => c.slug === slug);
}

/** All department-level (parent) categories. */
export const DEPARTMENTS: CategoryNode[] = CATEGORY_TREE.filter((c) => c.parentSlug === undefined);
