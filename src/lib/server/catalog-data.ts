/**
 * Cleaned product data from the 203-row pricing list (2026-08-25).
 *
 * Data issues resolved:
 * - Rows 1–2: skipped (missing product names)
 * - Row 45: skipped (negative price, likely cost/adjustment)
 * - Rows 83, 138, 154, 155, 166, 167, 168: skipped (wholesale "بالكمية" rows)
 * - Row 140: stripped "XXX" typo prefix
 * - Row 162: renamed "بوت" → "بوط نحال" (beekeeping boots)
 * - Rows 30 vs 140: kept both, renamed row 30 to "صندوق سفر ثقيل 5 برواز بدون قاعده"
 * - Rows 179 vs 187: kept both, renamed row 179 to distinguish (no SKU)
 * - Rows 90 vs 95: kept as same product name, different sizes
 * - SKU codes [1001], [300] promoted to product.sku
 */

import type { Department } from "./categories";

export interface CatalogProduct {
  /** URL-safe identifier (derived from name or explicit slug) */
  slug: string;
  /** Arabic display name */
  name: string;
  /** English display name */
  nameEn: string;
  /** Department key */
  department: Department;
  /** Category slug (maps to a subcategory in the tree) */
  categorySlug: string;
  /** Price in piastres (EGP × 100) */
  price: number;
  /** Available quantity in stock */
  stock: number;
  /** Optional SKU from the pricing list */
  sku?: string;
  /** Whether this product should appear in the storefront */
  published: boolean;
  /**
   * Optional seed image key (maps to the legacy IMG map in scripts/seed.ts).
   * Catalog products default to the generic clover jar placeholder.
   */
  image?: string;
  /**
   * Whether this product is featured in the storefront hero (defaults to false).
   */
  featured?: boolean;
}

// ---------------------------------------------------------------------------
// Category slug constants for readability
// ---------------------------------------------------------------------------

// Honey > Single-Origin
const CLOVER = "clover";
const CITRUS = "citrus";
const SIDR = "sidr";
const BLACK_SEED = "black-seed";
const MARJORAM = "marjoram";

// Honey > Blends
const NUTS_HONEY = "nuts-honey";
const COMB_HONEY = "comb-honey";

// Honey > Hive Products
const ROYAL_JELLY = "royal-jelly";
const POLLEN = "pollen";
const PROPOLIS = "propolis";
const SUPPLEMENTS = "supplements";

// Honey > Nuts
const MIXED_NUTS = "mixed-nuts";
const SINGLE_NUTS = "single-nuts";

// Equipment > Hives & Parts
const SWEDISH_PARTS = "swedish-parts";
const TRAVEL_HIVE = "travel-hive";
const FRAMES = "frames";
const METAL_SHEETS = "metal-sheets";
const QUEEN_CAGES = "queen-cages";
const FEEDERS = "feeders";
const QUEEN_EXCLUDERS = "queen-excluders";
const OTHER_HIVE = "other-hive";

// Equipment > Extraction
const EXTRACTORS = "extractors";
const RIPENERS = "ripeners";
const OTHER_EXTRACTION = "other-extraction";

// Equipment > Protection
const VEILS = "veils";
const SUITS = "suits";
const GLOVES = "gloves";
const OTHER_PROTECTION = "other-protection";

// Equipment > Tools
const SMOKERS = "smokers";
const BEE_BRUSHES = "bee-brushes";
const TRAPS = "traps";
const GRAFTING = "grafting";
const SPRAYS = "sprays";
const OTHER_TOOLS = "other-tools";

// Equipment > Packaging
const JARS = "jars";
const CARTONS = "cartons";
const LIDS = "lids";
const SHRINK_WRAP = "shrink-wrap";
const NUT_NETTING = "nut-netting";
const FRIDGE_CONTAINERS = "fridge-containers";
const EMPTY_COMB_CONTAINERS = "empty-comb-containers";
const HONEY_SPOONS_PKG = "honey-spoons";
const FERMENTATION_BAGS = "fermentation-bags";
const TAPE_ROLL = "tape-roll";
const DRUM_30KG = "drum-30kg";

// Equipment > Foundation Wax
const FOUNDATION_LOCAL = "foundation-local";
const FOUNDATION_EXPORT = "foundation-export";

// Equipment > Medicines & Treatments
const TREATMENTS = "treatments";
const BY_QUANTITY = "by-quantity";

// ---------------------------------------------------------------------------
// Products (EGP → piastres via × 100)
// ---------------------------------------------------------------------------

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  // ════════════════════════════════════════════════════════════════════════
  // HONEY > SINGLE-ORIGIN
  // ════════════════════════════════════════════════════════════════════════

  // ── Clover Honey ──────────────────────────────────────────────────────

  {
    slug: "honey-clover-jerrycan-30kg",
    name: "عسل برسيم جركن 30 ك",
    nameEn: "Clover Honey Jerrycan 30kg",
    department: "honey",
    categorySlug: CLOVER,
    price: 3450_00,
    stock: 40,
    published: true,
  },
  {
    slug: "honey-clover-1kg-squeeze",
    name: "عسل برسيم 1 ك بلاستيك اسكويز",
    nameEn: "Clover Honey 1kg Plastic Squeeze",
    department: "honey",
    categorySlug: CLOVER,
    price: 130_00,
    stock: 59,
    published: true,
  },
  {
    slug: "honey-clover-500g-plastic",
    name: "عسل برسيم 500 جرام بلاستيك",
    nameEn: "Clover Honey 500g Plastic",
    department: "honey",
    categorySlug: CLOVER,
    price: 65_00,
    stock: 41,
    published: true,
  },
  {
    slug: "honey-clover-500g",
    name: "عسل برسيم 500 جرام",
    nameEn: "Clover Honey 500g",
    department: "honey",
    categorySlug: CLOVER,
    price: 70_00,
    stock: 59,
    published: true,
  },
  {
    slug: "honey-clover-5kg-plastic",
    name: "عسل برسيم 5 كيلو بلاستيك",
    nameEn: "Clover Honey 5kg Plastic",
    department: "honey",
    categorySlug: CLOVER,
    price: 565_00,
    stock: 48,
    published: true,
  },
  {
    slug: "honey-clover-2kg-plastic",
    name: "عسل برسيم 2ك بلاستيك",
    nameEn: "Clover Honey 2kg Plastic",
    department: "honey",
    categorySlug: CLOVER,
    price: 235_00,
    stock: 44,
    published: true,
  },
  {
    slug: "honey-clover-1kg-plastic-sku1001",
    name: "عسل برسيم 1ك بلاستي",
    nameEn: "Clover Honey 1kg Plastic (SKU 1001)",
    department: "honey",
    categorySlug: CLOVER,
    price: 120_00,
    sku: "1001",
    stock: 53,
    published: true,
  },
  {
    slug: "honey-clover-1kg",
    name: "عسل برسيم 1ك",
    nameEn: "Clover Honey 1kg",
    department: "honey",
    categorySlug: CLOVER,
    price: 135_00,
    stock: 54,
    published: true,
  },

  // ── Citrus Honey ─────────────────────────────────────────────────────

  {
    slug: "honey-citrus-1kg-squeeze",
    name: "عسل موالح 1 ك اسكويز",
    nameEn: "Citrus Honey 1kg Squeeze",
    department: "honey",
    categorySlug: CITRUS,
    price: 145_00,
    stock: 49,
    published: true,
  },
  {
    slug: "honey-citrus-500g",
    name: "عسل موالح 500 جرام",
    nameEn: "Citrus Honey 500g",
    department: "honey",
    categorySlug: CITRUS,
    price: 75_00,
    stock: 48,
    published: true,
  },
  {
    slug: "honey-citrus-1kg-plastic",
    name: "عسل موالح 1ك بلاستيك",
    nameEn: "Citrus Honey 1kg Plastic",
    department: "honey",
    categorySlug: CITRUS,
    price: 135_00,
    stock: 41,
    published: true,
  },
  {
    slug: "honey-citrus-1kg",
    name: "عسل موالح 1ك",
    nameEn: "Citrus Honey 1kg",
    department: "honey",
    categorySlug: CITRUS,
    price: 145_00,
    stock: 54,
    published: true,
  },
  {
    slug: "honey-citrus-150g",
    name: "عسل موالح 150 جرام",
    nameEn: "Citrus Honey 150g",
    department: "honey",
    categorySlug: CITRUS,
    price: 35_00,
    stock: 55,
    published: true,
  },
  {
    slug: "honey-citrus-500g-plastic",
    name: "عسل موالح 500 جرام بلاستيك",
    nameEn: "Citrus Honey 500g Plastic",
    department: "honey",
    categorySlug: CITRUS,
    price: 75_00,
    stock: 53,
    published: true,
  },

  // ── Sidr Honey ───────────────────────────────────────────────────────

  {
    slug: "honey-sidr-500g",
    name: "عسل سدر مصري 500 جرام",
    nameEn: "Egyptian Sidr Honey 500g",
    department: "honey",
    categorySlug: SIDR,
    price: 500_00,
    stock: 49,
    published: true,
  },
  {
    slug: "honey-sidr-1kg",
    name: "عسل سدر مصري 1 ك",
    nameEn: "Egyptian Sidr Honey 1kg",
    department: "honey",
    categorySlug: SIDR,
    price: 1000_00,
    stock: 50,
    published: true,
    image: "glassDark",
    featured: true,
  },

  // ── Black Seed Honey ─────────────────────────────────────────────────

  {
    slug: "honey-blackseed-500g-plastic",
    name: "عسل حبه البركة 500 جرام بلاستيك",
    nameEn: "Black Seed Honey 500g Plastic",
    department: "honey",
    categorySlug: BLACK_SEED,
    price: 70_00,
    stock: 56,
    published: true,
  },
  {
    slug: "honey-blackseed-500g",
    name: "عسل حبه البركة 500 جرام",
    nameEn: "Black Seed Honey 500g",
    department: "honey",
    categorySlug: BLACK_SEED,
    price: 90_00,
    stock: 60,
    published: true,
  },
  {
    slug: "honey-blackseed-1kg-plastic",
    name: "عسل حبه البركة 1 ك بلاستيك",
    nameEn: "Black Seed Honey 1kg Plastic",
    department: "honey",
    categorySlug: BLACK_SEED,
    price: 130_00,
    stock: 60,
    published: true,
  },
  {
    slug: "honey-blackseed-1kg",
    name: "عسل حبه البركة 1 ك",
    nameEn: "Black Seed Honey 1kg",
    department: "honey",
    categorySlug: BLACK_SEED,
    price: 180_00,
    stock: 59,
    published: true,
  },

  // ── Marjoram Honey ───────────────────────────────────────────────────

  {
    slug: "honey-marjoram-500g-plastic",
    name: "عسل بردقوش 500 جرام بلاستيك",
    nameEn: "Marjoram Honey 500g Plastic",
    department: "honey",
    categorySlug: MARJORAM,
    price: 70_00,
    stock: 46,
    published: true,
  },
  {
    slug: "honey-marjoram-500g",
    name: "عسل بردقوش 500 جرام",
    nameEn: "Marjoram Honey 500g",
    department: "honey",
    categorySlug: MARJORAM,
    price: 90_00,
    stock: 54,
    published: true,
  },
  {
    slug: "honey-marjoram-1kg-plastic",
    name: "عسل بردقوش 1 ك بلاستيك",
    nameEn: "Marjoram Honey 1kg Plastic",
    department: "honey",
    categorySlug: MARJORAM,
    price: 130_00,
    stock: 49,
    published: true,
  },
  {
    slug: "honey-marjoram-1kg",
    name: "عسل بردقوش 1 ك",
    nameEn: "Marjoram Honey 1kg",
    department: "honey",
    categorySlug: MARJORAM,
    price: 180_00,
    stock: 43,
    published: true,
  },

  // ════════════════════════════════════════════════════════════════════════
  // HONEY > BLENDS & COMB
  // ════════════════════════════════════════════════════════════════════════

  // ── Honey with Nuts ──────────────────────────────────────────────────

  {
    slug: "nuts-honey-can-400g-extra",
    name: "مكسرات بالعسل كان 400 جم اكسترا",
    nameEn: "Nuts in Honey Can 400g Extra",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 125_00,
    stock: 37,
    published: true,
  },
  {
    slug: "nuts-honey-500g-can",
    name: "مكسرات بالعسل كان 500 جرام",
    nameEn: "Nuts in Honey Can 500g",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 135_00,
    stock: 42,
    published: true,
  },
  {
    slug: "nuts-honey-400g-can",
    name: "مكسرات بالعسل كان 400 جرام",
    nameEn: "Nuts in Honey Can 400g",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 125_00,
    stock: 39,
    published: true,
  },
  {
    slug: "nuts-honey-500g-oval",
    name: "مكسرات بالعسل 500 جم بيضاوي",
    nameEn: "Nuts in Honey 500g Oval",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 125_00,
    stock: 44,
    published: true,
  },
  {
    slug: "nuts-honey-500g-oval-incomplete",
    name: "مكسرات بالعسل 500 جرام بيضاوي غير كامل",
    nameEn: "Nuts in Honey 500g Oval (Incomplete)",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 110_00,
    stock: 54,
    published: true,
  },
  {
    slug: "nuts-honey-370ml-round-glass",
    name: "مكسرات بالعسل 370 ملي زجاج دائري",
    nameEn: "Nuts in Honey 370ml Round Glass",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 100_00,
    stock: 42,
    published: true,
  },
  {
    slug: "nuts-honey-370ml-plastic",
    name: "مكسرات بالعسل 370 ملي بلاستيك",
    nameEn: "Nuts in Honey 370ml Plastic",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 90_00,
    stock: 44,
    published: true,
  },
  {
    slug: "nuts-honey-1kg",
    name: "مكسرات بالعسل 1 كيلو",
    nameEn: "Nuts in Honey 1kg",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 225_00,
    stock: 37,
    published: true,
  },
  {
    slug: "nuts-honey-1kg-extra",
    name: "مكسرات بالعسل 1 ك اكسترا",
    nameEn: "Nuts in Honey 1kg Extra",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 250_00,
    stock: 36,
    published: true,
  },
  {
    slug: "nuts-honey-800g",
    name: "مكسرات بالعسل 800 جرام",
    nameEn: "Honey with Nuts 800g",
    department: "honey",
    categorySlug: NUTS_HONEY,
    price: 210_00,
    stock: 49,
    published: true,
    featured: true,
  },

  // ── Comb Honey ───────────────────────────────────────────────────────

  {
    slug: "comb-honey-clover-500g",
    name: "شمع بالعسل برسيم 500 جرام",
    nameEn: "Comb Honey Clover 500g",
    department: "honey",
    categorySlug: COMB_HONEY,
    price: 90_00,
    stock: 45,
    published: true,
  },
  {
    slug: "comb-honey-clover-250g",
    name: "شمع بالعسل برسيم 250 جرام",
    nameEn: "Comb Honey Clover 250g",
    department: "honey",
    categorySlug: COMB_HONEY,
    price: 50_00,
    stock: 44,
    published: true,
  },
  {
    slug: "comb-honey-citrus-500g",
    name: "شمع بالعسل 500 جم موالح",
    nameEn: "Comb Honey Citrus 500g",
    department: "honey",
    categorySlug: COMB_HONEY,
    price: 100_00,
    stock: 38,
    published: true,
  },
  {
    slug: "comb-honey-citrus-250g",
    name: "شمع بالعسل 250 جم موالح",
    nameEn: "Comb Honey Citrus 250g",
    department: "honey",
    categorySlug: COMB_HONEY,
    price: 60_00,
    stock: 37,
    published: true,
  },

  // ── Blends ───────────────────────────────────────────────────────────

  {
    slug: "blend-hexagonal-1kg-plastic",
    name: "عسل خلطه برطمان سدادسي بلاستيك",
    nameEn: "Six-Blend Honey Hexagonal 1kg Plastic",
    department: "honey",
    categorySlug: SUPPLEMENTS,
    price: 100_00,
    stock: 41,
    published: true,
  },

  // ════════════════════════════════════════════════════════════════════════
  // HONEY > HIVE PRODUCTS
  // ════════════════════════════════════════════════════════════════════════

  // ── Royal Jelly ──────────────────────────────────────────────────────

  {
    slug: "royal-jelly-5g-local",
    name: "غذاء ملكات 5 جرام بلدي",
    nameEn: "Royal Jelly 5g Local",
    department: "honey",
    categorySlug: ROYAL_JELLY,
    price: 80_00,
    stock: 30,
    published: true,
  },
  {
    slug: "royal-jelly-5g-container",
    name: "عبوة غذاء ملكات 5 جرام فارغه",
    nameEn: "Royal Jelly 5g Container (Empty)",
    department: "honey",
    categorySlug: ROYAL_JELLY,
    price: 70,
    stock: 40,
    published: true,
  },

  // ── Bee Pollen ───────────────────────────────────────────────────────

  {
    slug: "pollen-corn-125g-glass",
    name: "علبه حبوب لقاح ذره زجاج 125 جم",
    nameEn: "Bee Pollen Corn 125g Glass",
    department: "honey",
    categorySlug: POLLEN,
    price: 100_00,
    stock: 38,
    published: true,
  },
  {
    slug: "pollen-clover-125g-glass",
    name: "علبه حبوب لقاح برسيم زجاج 125 جم",
    nameEn: "Bee Pollen Clover 125g Glass",
    department: "honey",
    categorySlug: POLLEN,
    price: 100_00,
    stock: 33,
    published: true,
  },
  {
    slug: "pollen-20g",
    name: "علبه حبوب لقاح 20 جرام",
    nameEn: "Bee Pollen 20g",
    department: "honey",
    categorySlug: POLLEN,
    price: 30_00,
    stock: 47,
    published: true,
  },
  {
    slug: "pollen-clover-20g",
    name: "علبة حبوب لقاح برسيم 20 جم",
    nameEn: "Bee Pollen Clover 20g",
    department: "honey",
    categorySlug: POLLEN,
    price: 30_00,
    stock: 50,
    published: true,
  },

  // ── Propolis ─────────────────────────────────────────────────────────

  {
    slug: "propolis-10g",
    name: "علبه بروبليس 10 جرام",
    nameEn: "Propolis 10g",
    department: "honey",
    categorySlug: PROPOLIS,
    price: 70_00,
    stock: 47,
    published: true,
  },

  // ── Supplements ──────────────────────────────────────────────────────

  {
    slug: "ginseng-10g",
    name: "علبه جينيسنج 10 جرام",
    nameEn: "Ginseng 10g",
    department: "honey",
    categorySlug: SUPPLEMENTS,
    price: 80_00,
    stock: 33,
    published: true,
  },
  {
    slug: "super-vitamin-500mg",
    name: "سوبر فيتامين 500 ملي جرام",
    nameEn: "Super Vitamin 500mg",
    department: "equipment",
    categorySlug: TREATMENTS,
    price: 120_00,
    stock: 48,
    published: true,
  },

  // ════════════════════════════════════════════════════════════════════════
  // HONEY > NUTS
  // ════════════════════════════════════════════════════════════════════════

  // ── Mixed Nuts ───────────────────────────────────────────────────────

  {
    slug: "mixed-nuts-100g",
    name: "مكسرات مشكله 100 جم",
    nameEn: "Mixed Nuts 100g",
    department: "honey",
    categorySlug: MIXED_NUTS,
    price: 110_00,
    stock: 46,
    published: true,
  },
  {
    slug: "mixed-nuts-500g-extra-can",
    name: "مكسرات كان 500 جم اكسترا",
    nameEn: "Mixed Nuts Can 500g Extra",
    department: "honey",
    categorySlug: MIXED_NUTS,
    price: 150_00,
    stock: 64,
    published: true,
  },

  // ── Single Nuts ──────────────────────────────────────────────────────

  {
    slug: "almond-100g",
    name: "لوز 100 جم",
    nameEn: "Almonds 100g",
    department: "honey",
    categorySlug: SINGLE_NUTS,
    price: 100_00,
    stock: 57,
    published: true,
  },
  {
    slug: "cashew-100g",
    name: "كاجو 100 جم",
    nameEn: "Cashews 100g",
    department: "honey",
    categorySlug: SINGLE_NUTS,
    price: 100_00,
    stock: 55,
    published: true,
  },
  {
    slug: "pistachio-100g",
    name: "فستق 100 جم",
    nameEn: "Pistachios 100g",
    department: "honey",
    categorySlug: SINGLE_NUTS,
    price: 120_00,
    stock: 63,
    published: true,
  },
  {
    slug: "hazelnut-100g",
    name: "بندق 100 جم",
    nameEn: "Hazelnuts 100g",
    department: "honey",
    categorySlug: SINGLE_NUTS,
    price: 130_00,
    stock: 58,
    published: true,
  },

  // ════════════════════════════════════════════════════════════════════════
  // EQUIPMENT > HIVES & PARTS
  // ════════════════════════════════════════════════════════════════════════

  // ── Swedish Parts ────────────────────────────────────────────────────

  {
    slug: "swedish-base-6f",
    name: "قاعده سويد 6 برواز",
    nameEn: "Swedish Base 6-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 60_00,
    stock: 45,
    published: true,
  },
  {
    slug: "swedish-base-7f",
    name: "قاعده سويد 7 برواز",
    nameEn: "Swedish Base 7-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 75_00,
    stock: 55,
    published: true,
  },
  {
    slug: "swedish-base-8f",
    name: "قاعده سويد 8 برواز",
    nameEn: "Swedish Base 8-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 100_00,
    stock: 44,
    published: true,
  },
  {
    slug: "swedish-cover-6f",
    name: "غطاء سويد 6 برواز",
    nameEn: "Swedish Cover 6-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 115_00,
    stock: 48,
    published: true,
  },
  {
    slug: "swedish-cover-7f",
    name: "غطاء سويد 7 برواز",
    nameEn: "Swedish Cover 7-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 125_00,
    stock: 58,
    published: true,
  },
  {
    slug: "swedish-cover-8f",
    name: "غطاء سويد 8 برواز",
    nameEn: "Swedish Cover 8-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 150_00,
    stock: 47,
    published: true,
  },
  {
    slug: "swedish-box-6f",
    name: "صندوق سويد 6 برواز",
    nameEn: "Swedish Box 6-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 225_00,
    stock: 44,
    published: true,
    image: "hiveBox",
  },
  {
    slug: "swedish-box-7f",
    name: "صندوق سويد 7 برواز",
    nameEn: "Swedish Box 7-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 250_00,
    stock: 54,
    published: true,
    image: "hiveBox",
  },
  {
    slug: "swedish-box-8f",
    name: "صندوق سويد 8 برواز",
    nameEn: "Swedish Box 8-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 300_00,
    stock: 43,
    published: true,
    image: "hiveBox",
  },
  {
    slug: "swedish-box-5f",
    name: "صندوق سويد 5 برواز",
    nameEn: "Swedish Box 5-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 200_00,
    stock: 55,
    published: true,
    image: "hiveBox",
  },
  {
    slug: "swedish-base-10f",
    name: "قاعده سويد 10 برواز",
    nameEn: "Swedish Base 10-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 120_00,
    stock: 55,
    published: true,
  },
  {
    slug: "swedish-cover-10f",
    name: "غطاء سويد 10 برواز",
    nameEn: "Swedish Cover 10-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 170_00,
    stock: 51,
    published: true,
  },
  {
    slug: "swedish-box-10f",
    name: "صندوق سويد 10 برواز",
    nameEn: "Swedish Box 10-Frame",
    department: "equipment",
    categorySlug: SWEDISH_PARTS,
    price: 350_00,
    stock: 48,
    published: true,
    image: "hiveBox",
  },

  // ── Travel Hives ─────────────────────────────────────────────────────

  {
    slug: "travel-hive-heavy-5f-without-base",
    name: "صندوق سفر ثقيل 5 برواز بدون قاعده",
    nameEn: "Travel Hive Heavy 5-Frame (Without Base)",
    department: "equipment",
    categorySlug: TRAVEL_HIVE,
    price: 350_00,
    stock: 55,
    published: true,
    image: "hiveBox",
  },
  {
    slug: "travel-hive-heavy-5f",
    name: "صندوق سفر ثقيل 5 برواز مع قاعده وغطاء",
    nameEn: "Travel Hive Heavy 5-Frame with Base & Cover",
    department: "equipment",
    categorySlug: TRAVEL_HIVE,
    price: 350_00,
    stock: 51,
    published: true,
    image: "hiveBox",
  },
  {
    slug: "travel-hive-8f",
    name: "صندوق سفر 8 برواز مع قاعده وغطاء",
    nameEn: "Travel Hive 8-Frame with Base & Cover",
    department: "equipment",
    categorySlug: TRAVEL_HIVE,
    price: 550_00,
    stock: 41,
    published: true,
    image: "hiveBox",
  },
  {
    slug: "travel-hive-7f",
    name: "صندوق سفر 7 برواز مع قاعده وغطاء",
    nameEn: "Travel Hive 7-Frame with Base & Cover",
    department: "equipment",
    categorySlug: TRAVEL_HIVE,
    price: 450_00,
    stock: 52,
    published: true,
    image: "hiveBox",
  },

  // ── Frames ───────────────────────────────────────────────────────────

  {
    slug: "frame-wood-assembled-wire-wax",
    name: "برواز خشب مجمع مع سلك وشمع",
    nameEn: "Wood Frame Assembled with Wire & Wax",
    department: "equipment",
    categorySlug: FRAMES,
    price: 40_00,
    stock: 55,
    published: true,
  },
  {
    slug: "frame-swedish-disassembled",
    name: "برواز خشب سويد مفكك",
    nameEn: "Swedish Wood Frame Disassembled",
    department: "equipment",
    categorySlug: FRAMES,
    price: 14_00,
    stock: 41,
    published: true,
  },
  {
    slug: "frame-swedish-assembled-wire",
    name: "برواز خشب سويد مجمع بالسلك",
    nameEn: "Swedish Wood Frame Assembled with Wire",
    department: "equipment",
    categorySlug: FRAMES,
    price: 17_00,
    stock: 47,
    published: true,
  },
  {
    slug: "frame-swedish-assembled",
    name: "برواز خشب سويد مجمع",
    nameEn: "Swedish Wood Frame Assembled",
    department: "equipment",
    categorySlug: FRAMES,
    price: 15_50,
    stock: 47,
    published: true,
  },
  {
    slug: "frame-local-plastic-1ring",
    name: "برواز بلدي بلاستيك 1 دائره",
    nameEn: "Local Plastic Frame 1-Ring",
    department: "equipment",
    categorySlug: FRAMES,
    price: 35_00,
    stock: 52,
    published: true,
  },

  // ── Metal Sheets ─────────────────────────────────────────────────────

  {
    slug: "metal-sheet-10f",
    name: "شريحة صاج خلية 10 برواز",
    nameEn: "Metal Sheet 10-Frame Hive",
    department: "equipment",
    categorySlug: METAL_SHEETS,
    price: 40_00,
    stock: 53,
    published: true,
  },

  // ── Queen Cages ──────────────────────────────────────────────────────

  {
    slug: "queen-cage-half-ball-tin",
    name: "قفص نص كوره صاج",
    nameEn: "Queen Cage Half-Ball Tin",
    department: "equipment",
    categorySlug: QUEEN_CAGES,
    price: 2_00,
    stock: 41,
    published: true,
  },
  {
    slug: "queen-cage-half-ball-plastic",
    name: "قفص نص كوره بلاستيك",
    nameEn: "Queen Cage Half-Ball Plastic",
    department: "equipment",
    categorySlug: QUEEN_CAGES,
    price: 75,
    stock: 55,
    published: true,
  },
  {
    slug: "queen-cage-wood-benteum",
    name: "قفص ملكات خشب (بنتيوم)",
    nameEn: "Queen Cage Wood (Benteum)",
    department: "equipment",
    categorySlug: QUEEN_CAGES,
    price: 1_00,
    stock: 45,
    published: true,
  },
  {
    slug: "queen-cage-plastic-with-lid",
    name: "قفص ملكات بلاستيك بالغطاء",
    nameEn: "Queen Cage Plastic with Cover",
    department: "equipment",
    categorySlug: QUEEN_CAGES,
    price: 3_20,
    stock: 56,
    published: true,
  },

  // ── Feeders ──────────────────────────────────────────────────────────

  {
    slug: "feeder-plastic-2l",
    name: "غذايه بلاستيك 2 لتر",
    nameEn: "Plastic Feeder 2L",
    department: "equipment",
    categorySlug: FEEDERS,
    price: 23_00,
    stock: 43,
    published: true,
    image: "feeder",
  },
  {
    slug: "feeder-plastic-1.5l",
    name: "غذايه بلاستيك 1.5 لتر",
    nameEn: "Plastic Feeder 1.5L",
    department: "equipment",
    categorySlug: FEEDERS,
    price: 19_00,
    stock: 50,
    published: true,
    image: "feeder",
  },

  // ── Queen Excluders ──────────────────────────────────────────────────

  {
    slug: "queen-excluder-plastic-large",
    name: "حاجز ملكات بلاستيك كبير ثقيل",
    nameEn: "Queen Excluder Plastic Large Heavy",
    department: "equipment",
    categorySlug: QUEEN_EXCLUDERS,
    price: 35_00,
    stock: 56,
    published: true,
    image: "queenExcluder",
  },
  {
    slug: "queen-excluder-plastic-small",
    name: "حاجز ملكات بلاستيك صغير ثقيل",
    nameEn: "Queen Excluder Plastic Small Heavy",
    department: "equipment",
    categorySlug: QUEEN_EXCLUDERS,
    price: 25_00,
    stock: 46,
    published: true,
    image: "queenExcluder",
  },
  {
    slug: "queen-excluder-plastic-2f",
    name: "حاجز ملكات بلاستيك 2 برواز",
    nameEn: "Queen Excluder Plastic 2-Frame",
    department: "equipment",
    categorySlug: QUEEN_EXCLUDERS,
    price: 70_00,
    stock: 50,
    published: true,
    image: "queenExcluder",
  },

  // ── Other Hive Parts ─────────────────────────────────────────────────

  {
    slug: "fixing-wheel",
    name: "عجله تثبيت",
    nameEn: "Fixing Wheel",
    department: "equipment",
    categorySlug: OTHER_HIVE,
    price: 60_00,
    stock: 52,
    published: true,
    image: "fixingWheel",
  },
  {
    slug: "hive-tool-large",
    name: "عتله كبيره",
    nameEn: "Hive Tool Large",
    department: "equipment",
    categorySlug: OTHER_HIVE,
    price: 30_00,
    stock: 43,
    published: true,
    image: "hiveTool",
  },
  {
    slug: "hive-tool-small",
    name: "عتله صغيره",
    nameEn: "Hive Tool Small",
    department: "equipment",
    categorySlug: OTHER_HIVE,
    price: 25_00,
    stock: 54,
    published: true,
    image: "hiveTool",
  },
  {
    slug: "queen-rearing-cups",
    name: "كئوس تربيه ملكات",
    nameEn: "Queen Rearing Cups",
    department: "equipment",
    categorySlug: OTHER_HIVE,
    price: 50,
    stock: 58,
    published: true,
  },
  {
    slug: "metal-queen-excluder",
    name: "أفيز حديد للخليه",
    nameEn: "Metal Queen Excluder for Hive",
    department: "equipment",
    categorySlug: OTHER_HIVE,
    price: 65_00,
    stock: 57,
    published: true,
    image: "queenExcluder",
  },

  // ════════════════════════════════════════════════════════════════════════
  // EQUIPMENT > EXTRACTION
  // ════════════════════════════════════════════════════════════════════════

  // ── Extractors ───────────────────────────────────────────────────────

  {
    slug: "extractor-stainless-4f-manual",
    name: "فراز استانليس 4 برواز قلب حديد وارجل حديد يدوي",
    nameEn: "Stainless Extractor 4-Frame Manual (Iron Body & Legs)",
    department: "equipment",
    categorySlug: EXTRACTORS,
    price: 6000_00,
    stock: 24,
    published: true,
    image: "extractor4Manual",
  },
  {
    slug: "extractor-stainless-3f-manual",
    name: "فراز استانليس 3 برواز قلب حديد ارجل حديد يدوي",
    nameEn: "Stainless Extractor 3-Frame Manual (Iron Body & Legs)",
    department: "equipment",
    categorySlug: EXTRACTORS,
    price: 5000_00,
    stock: 27,
    published: true,
  },
  {
    slug: "extractor-6f-stainless-crank",
    name: "فراز 6 برواز استانليس من الخارج قلاب",
    nameEn: "Extractor 6-Frame Stainless External Crank",
    department: "equipment",
    categorySlug: EXTRACTORS,
    price: 11000_00,
    stock: 24,
    published: true,
    image: "extractor6Electric",
  },
  {
    slug: "extractor-6f-galvanized-crank",
    name: "فراز 6 برواز صاج مجلفن قلاب",
    nameEn: "Extractor 6-Frame Galvanized Crank",
    department: "equipment",
    categorySlug: EXTRACTORS,
    price: 10000_00,
    stock: 32,
    published: true,
  },
  {
    slug: "extractor-4f-stainless-crank",
    name: "فراز 4 برواز استانليس من الخارج قلاب",
    nameEn: "Extractor 4-Frame Stainless External Crank",
    department: "equipment",
    categorySlug: EXTRACTORS,
    price: 10000_00,
    stock: 18,
    published: true,
    image: "extractor4Electric",
  },
  {
    slug: "extractor-4f-galvanized-crank",
    name: "فراز 4 برواز صاج مجلفن قلاب",
    nameEn: "Extractor 4-Frame Galvanized Crank",
    department: "equipment",
    categorySlug: EXTRACTORS,
    price: 9000_00,
    stock: 21,
    published: true,
  },

  // ── Ripeners ─────────────────────────────────────────────────────────

  {
    slug: "ripener-stainless-150kg",
    name: "منضج استانليس 150 ك مع مصفاه",
    nameEn: "Stainless Ripener 150kg with Strainer",
    department: "equipment",
    categorySlug: RIPENERS,
    price: 4000_00,
    stock: 31,
    published: true,
  },

  // ── Other Extraction ─────────────────────────────────────────────────

  {
    slug: "honey-tin-25kg",
    name: "صفيحه عسل سعه 25 ك فارغه",
    nameEn: "Honey Tin 25kg (Empty)",
    department: "equipment",
    categorySlug: OTHER_EXTRACTION,
    price: 115_00,
    stock: 29,
    published: true,
  },
  {
    slug: "extractor-cage-tin",
    name: "قفص فراز صاج عادي",
    nameEn: "Extractor Cage Tin (Standard)",
    department: "equipment",
    categorySlug: OTHER_EXTRACTION,
    price: 300_00,
    stock: 32,
    published: true,
  },

  // ════════════════════════════════════════════════════════════════════════
  // EQUIPMENT > PROTECTION
  // ════════════════════════════════════════════════════════════════════════

  // ── Veils ────────────────────────────────────────────────────────────

  {
    slug: "veil-face-shoulder-wire",
    name: "قناع وجه كتف سلك",
    nameEn: "Face & Shoulder Veil Wire",
    department: "equipment",
    categorySlug: VEILS,
    price: 90_00,
    stock: 45,
    published: true,
    image: "veilRound",
  },
  {
    slug: "veil-face-syrian-wire",
    name: "قناع وجه سوري سلك صلب",
    nameEn: "Face Veil Syrian Wire (Sturdy)",
    department: "equipment",
    categorySlug: VEILS,
    price: 85_00,
    stock: 31,
    published: true,
    image: "veilRound",
  },
  {
    slug: "veil-face-round-tulle-small",
    name: "قناع وجه دائري تول صغير",
    nameEn: "Face Veil Round Tulle Small",
    department: "equipment",
    categorySlug: VEILS,
    price: 70_00,
    stock: 47,
    published: true,
    image: "veilRound",
  },
  {
    slug: "veil-face-round-tulle-large",
    name: "قناع وجه دائري تول كبير",
    nameEn: "Face Veil Round Tulle Large",
    department: "equipment",
    categorySlug: VEILS,
    price: 80_00,
    stock: 36,
    published: true,
    image: "veilRound",
  },
  {
    slug: "veil-face-white-heavy",
    name: "قناع وجه أبيض ثقيل",
    nameEn: "Face Veil White Heavy",
    department: "equipment",
    categorySlug: VEILS,
    price: 60_00,
    stock: 46,
    published: true,
    image: "veilRound",
  },
  {
    slug: "veil-shirt-syrian",
    name: "قناع بالقميص سوري",
    nameEn: "Veil with Shirt Syrian",
    department: "equipment",
    categorySlug: VEILS,
    price: 190_00,
    stock: 38,
    published: true,
    image: "jacket",
  },
  {
    slug: "veil-shirt-super",
    name: "قناع بالقميص سوبر",
    nameEn: "Veil with Shirt Super",
    department: "equipment",
    categorySlug: VEILS,
    price: 270_00,
    stock: 41,
    published: true,
    image: "jacket",
  },
  {
    slug: "veil-shirt-heavy-round-tulle",
    name: "قناع بالقميص ثقيل دائري تول",
    nameEn: "Veil with Shirt Heavy Round Tulle",
    department: "equipment",
    categorySlug: VEILS,
    price: 180_00,
    stock: 43,
    published: true,
    image: "jacket",
  },
  {
    slug: "veil-shirt-white",
    name: "قناع بالقميص أبيض",
    nameEn: "Veil with Shirt White",
    department: "equipment",
    categorySlug: VEILS,
    price: 140_00,
    stock: 39,
    published: true,
    image: "jacket",
  },

  // ── Suits ────────────────────────────────────────────────────────────

  {
    slug: "suit-child-round-veil",
    name: "افرول اطفال قناع دائري",
    nameEn: "Child Suit with Round Veil",
    department: "equipment",
    categorySlug: SUITS,
    price: 600_00,
    stock: 42,
    published: true,
    image: "suit",
  },
  {
    slug: "suit-no-veil-colors",
    name: "افرول بدون قناع الوان",
    nameEn: "Suit Without Veil (Colors)",
    department: "equipment",
    categorySlug: SUITS,
    price: 650_00,
    stock: 42,
    published: true,
    image: "suit",
  },
  {
    slug: "suit-no-veil-syrian-fabric",
    name: "أفرول بدون قناع قماش سوري",
    nameEn: "Suit Without Veil Syrian Fabric",
    department: "equipment",
    categorySlug: SUITS,
    price: 550_00,
    stock: 47,
    published: true,
    image: "suit",
  },
  {
    slug: "suit-no-veil-white",
    name: "أفرول بدون قناع أبيض",
    nameEn: "Suit Without Veil White",
    department: "equipment",
    categorySlug: SUITS,
    price: 650_00,
    stock: 47,
    published: true,
    image: "suit",
  },
  {
    slug: "suit-with-veil-wire",
    name: "أفرول بالقناع سلك",
    nameEn: "Suit with Wire Veil",
    department: "equipment",
    categorySlug: SUITS,
    price: 650_00,
    stock: 36,
    published: true,
    image: "suitEmbroidered",
  },
  {
    slug: "suit-with-veil-round-tulle-fabric",
    name: "أفرول بالقناع دائري تول مع قماش",
    nameEn: "Suit with Round Tulle Veil & Fabric",
    department: "equipment",
    categorySlug: SUITS,
    price: 650_00,
    stock: 45,
    published: true,
    image: "suitEmbroidered",
  },
  {
    slug: "suit-with-veil-round-tulle",
    name: "أفرول بالقناع دائري تل",
    nameEn: "Suit with Round Tulle Veil",
    department: "equipment",
    categorySlug: SUITS,
    price: 650_00,
    stock: 35,
    published: true,
    image: "suitEmbroidered",
  },

  // ── Gloves ───────────────────────────────────────────────────────────

  {
    slug: "gloves-natural-leather",
    name: "جوانتي جلد طبيعي",
    nameEn: "Gloves Natural Leather",
    department: "equipment",
    categorySlug: GLOVES,
    price: 100_00,
    stock: 37,
    published: true,
    image: "gloves",
  },
  {
    slug: "gloves-suede-leather",
    name: "جوانتي جلد اسكاي",
    nameEn: "Gloves Suede Leather",
    department: "equipment",
    categorySlug: GLOVES,
    price: 55_00,
    stock: 36,
    published: true,
    image: "gloves",
  },

  // ── Other Protection ─────────────────────────────────────────────────

  {
    slug: "beekeeper-suit-2piece",
    name: "بدله نحال قطعتين",
    nameEn: "Beekeeper Suit 2-Piece",
    department: "equipment",
    categorySlug: OTHER_PROTECTION,
    price: 550_00,
    stock: 43,
    published: true,
    image: "suitEmbroidered",
  },

  // ════════════════════════════════════════════════════════════════════════
  // EQUIPMENT > TOOLS
  // ════════════════════════════════════════════════════════════════════════

  // ── Smokers ──────────────────────────────────────────────────────────

  {
    slug: "smoker-stainless",
    name: "مدخن استانليس",
    nameEn: "Stainless Steel Smoker",
    department: "equipment",
    categorySlug: SMOKERS,
    price: 200_00,
    stock: 55,
    published: true,
    image: "smoker",
  },

  // ── Bee Brushes ──────────────────────────────────────────────────────

  {
    slug: "bee-brush",
    name: "فرشاه نحل",
    nameEn: "Bee Brush",
    department: "equipment",
    categorySlug: BEE_BRUSHES,
    price: 35_00,
    stock: 50,
    published: true,
    image: "beeBrush",
  },

  // ── Traps ────────────────────────────────────────────────────────────

  {
    slug: "wasp-trap-large-4",
    name: "مصيده دبور كبيره (4)",
    nameEn: "Wasp Trap Large (4-Entrance)",
    department: "equipment",
    categorySlug: TRAPS,
    price: 140_00,
    stock: 44,
    published: true,
  },
  {
    slug: "wasp-trap-medium-3",
    name: "مصيده دبور وسط (3)",
    nameEn: "Wasp Trap Medium (3-Entrance)",
    department: "equipment",
    categorySlug: TRAPS,
    price: 100_00,
    stock: 54,
    published: true,
  },
  {
    slug: "wasp-trap-small",
    name: "مصيده دبور صغيره",
    nameEn: "Wasp Trap Small",
    department: "equipment",
    categorySlug: TRAPS,
    price: 80_00,
    stock: 41,
    published: true,
  },
  {
    slug: "pollen-trap-large",
    name: "مصيده حبوب لقاح كبيره",
    nameEn: "Pollen Trap Large",
    department: "equipment",
    categorySlug: TRAPS,
    price: 70_00,
    stock: 46,
    published: true,
  },
  {
    slug: "pollen-trap-small",
    name: "مصيده حبوب لقاح صغيره",
    nameEn: "Pollen Trap Small",
    department: "equipment",
    categorySlug: TRAPS,
    price: 50_00,
    stock: 57,
    published: true,
  },

  // ── Grafting ─────────────────────────────────────────────────────────

  {
    slug: "grafting-needle",
    name: "إبرة تطعيم",
    nameEn: "Grafting Needle",
    department: "equipment",
    categorySlug: GRAFTING,
    price: 50_00,
    stock: 42,
    published: true,
    image: "graftingNeedle",
  },

  // ── Sprays ───────────────────────────────────────────────────────────

  {
    slug: "spray-varroa-100ml",
    name: "بخاخ فاروا 100 سم",
    nameEn: "Varroa Spray 100ml",
    department: "equipment",
    categorySlug: SPRAYS,
    price: 110_00,
    stock: 48,
    published: true,
  },
  {
    slug: "spray-akarin",
    name: "بخاخ أكارين",
    nameEn: "Akarin Spray",
    department: "equipment",
    categorySlug: SPRAYS,
    price: 110_00,
    stock: 47,
    published: true,
  },

  // ── Other Tools ──────────────────────────────────────────────────────

  {
    slug: "wire-roll-500g",
    name: "لفه سلك 500 جرام",
    nameEn: "Wire Roll 500g",
    department: "equipment",
    categorySlug: OTHER_TOOLS,
    price: 50_00,
    stock: 55,
    published: true,
    image: "wireSpool",
  },
  {
    slug: "super-fork",
    name: "شوكه سوبر",
    nameEn: "Super Fork",
    department: "equipment",
    categorySlug: OTHER_TOOLS,
    price: 50_00,
    stock: 49,
    published: true,
    image: "superFork",
  },
  {
    slug: "plastic-roll-large-300",
    name: "بكره لصق كبير 300",
    nameEn: "Tape Roll Large 300",
    department: "equipment",
    categorySlug: OTHER_TOOLS,
    price: 30_00,
    stock: 60,
    published: true,
  },
  {
    slug: "honey-boots",
    name: "بوط نحال",
    nameEn: "Beekeeping Boots",
    department: "equipment",
    categorySlug: OTHER_TOOLS,
    price: 175_00,
    stock: 45,
    published: true,
  },
  {
    slug: "plastic-scraper-2-disc",
    name: "برولز بلدي بلاستيك 2 دائره",
    nameEn: "Plastic Scraper 2-Disc",
    department: "equipment",
    categorySlug: OTHER_TOOLS,
    price: 60_00,
    stock: 45,
    published: true,
  },

  // ════════════════════════════════════════════════════════════════════════
  // EQUIPMENT > PACKAGING & CONTAINERS
  // ════════════════════════════════════════════════════════════════════════

  // ── Jars ─────────────────────────────────────────────────────────────

  {
    slug: "jar-plastic-1kg-ribbed-imported",
    name: "برطمان بلاستيك 1 ك مضلع بالغطاء المستورد",
    nameEn: "Plastic Jar 1kg Ribbed with Imported Lid",
    department: "equipment",
    categorySlug: JARS,
    price: 8_00,
    stock: 130,
    published: true,
  },
  {
    slug: "jar-plastic-5kg",
    name: "برطمان 5 ك بلاستيك فارغ",
    nameEn: "Plastic Jar 5kg (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 20_00,
    stock: 120,
    published: true,
  },
  {
    slug: "jar-plastic-2kg",
    name: "برطمان 2 ك بلاستيك فارغ",
    nameEn: "Plastic Jar 2kg (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 12_50,
    stock: 135,
    published: true,
  },
  {
    slug: "jar-glass-30g",
    name: "برطمان زجاج 30 جم بالغطاء",
    nameEn: "Glass Jar 30g with Lid",
    department: "equipment",
    categorySlug: JARS,
    price: 4_50,
    stock: 138,
    published: true,
  },
  {
    slug: "jar-nuts-can-400g-aluminum",
    name: "علبه مكسرات كان 400 جرام المونيوم وغطاء بلاستيك",
    nameEn: "Nuts Can 400g Aluminum with Plastic Lid",
    department: "equipment",
    categorySlug: JARS,
    price: 11_00,
    stock: 133,
    published: true,
  },
  {
    slug: "jar-palm-pollen",
    name: "علبه طلع نخل",
    nameEn: "Palm Pollen Container",
    department: "equipment",
    categorySlug: JARS,
    price: 25_00,
    stock: 135,
    published: true,
  },
  {
    slug: "jar-30g-empty",
    name: "علبه 30 جرام فارغه",
    nameEn: "Jar 30g (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 1_00,
    stock: 126,
    published: true,
  },
  {
    slug: "jar-hexagonal-500g-plastic-empty",
    name: "برطمان سداسي 500 جم بلاستيك فارغ",
    nameEn: "Hexagonal Jar 500g Plastic (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 3_90,
    stock: 127,
    published: true,
  },
  {
    slug: "jar-hexagonal-400g-plastic-nuts",
    name: "برطمان سداسي 400 جرام (مكسرات) فارغ",
    nameEn: "Hexagonal Jar 400g Plastic for Nuts (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 4_10,
    stock: 128,
    published: true,
  },
  {
    slug: "jar-hexagonal-1kg-plastic",
    name: "برطمان سداسي 1ك بلاستيك",
    nameEn: "Hexagonal Jar 1kg Plastic",
    department: "equipment",
    categorySlug: JARS,
    price: 4_00,
    stock: 122,
    published: true,
  },
  {
    slug: "jar-glass-500g-with-lid-packed",
    name: "برطمان زجاج 500 جم بالغطاء فارغ - باك",
    nameEn: "Glass Jar 500g with Lid (Empty, Packed)",
    department: "equipment",
    categorySlug: JARS,
    price: 9_00,
    stock: 136,
    published: true,
  },
  {
    slug: "jar-glass-1kg-with-lid-packed",
    name: "برطمان زجاج 1ك بالغطاء فارغ - باك",
    nameEn: "Glass Jar 1kg with Lid (Empty, Packed)",
    department: "equipment",
    categorySlug: JARS,
    price: 15_00,
    stock: 123,
    published: true,
  },
  {
    slug: "jar-glass-1kg-empty",
    name: "برطمان زجاج 1 ك فارغ",
    nameEn: "Glass Jar 1kg (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 12_00,
    stock: 139,
    published: true,
  },
  {
    slug: "jar-plastic-500g-ribbed-imported",
    name: "برطمان بلاستيك 500 جرام مضلع بالغطاء المستورد",
    nameEn: "Plastic Jar 500g Ribbed with Imported Lid",
    department: "equipment",
    categorySlug: JARS,
    price: 8_00,
    stock: 120,
    published: true,
  },
  {
    slug: "jar-plastic-1kg-squeeze-imported",
    name: "برطمان بلاستيك 1 ك فارغ اسكويز بالغطاء المستورد",
    nameEn: "Plastic Jar 1kg Squeeze with Imported Lid",
    department: "equipment",
    categorySlug: JARS,
    price: 8_00,
    stock: 138,
    published: true,
  },
  {
    slug: "jar-plastic-1kg-squeeze-standard",
    name: "برطمان بلاستيك 1 ك فارغ اسكويز بالغطاء العادي",
    nameEn: "Plastic Jar 1kg Squeeze with Standard Lid",
    department: "equipment",
    categorySlug: JARS,
    price: 4_60,
    stock: 138,
    published: true,
  },
  {
    slug: "jar-squeeze-500g-standard",
    name: "برطمان اسكويز 500 جرام بالغطاء العادي",
    nameEn: "Squeeze Jar 500g with Standard Lid",
    department: "equipment",
    categorySlug: JARS,
    price: 4_50,
    stock: 140,
    published: true,
  },
  {
    slug: "jar-500g-honeycomb-plastic",
    name: "برطمان 500 جرام بلاستيك عش نحل",
    nameEn: "Jar 500g Plastic Honeycomb Pattern",
    department: "equipment",
    categorySlug: JARS,
    price: 3_90,
    stock: 125,
    published: true,
  },
  {
    slug: "jar-500g-perforated-plastic",
    name: "برطمان 500 جرام مشرشر بلاستيك",
    nameEn: "Jar 500g Plastic Perforated",
    department: "equipment",
    categorySlug: JARS,
    price: 3_90,
    stock: 127,
    published: true,
  },
  {
    slug: "jar-glass-500g-empty",
    name: "برطمان 500 جرام زجاج فارغ",
    nameEn: "Glass Jar 500g (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 7_00,
    stock: 131,
    published: true,
  },
  {
    slug: "jar-500g-oval-plastic",
    name: "برطمان 500 جرام بيضاوي بلاستيك فارغ",
    nameEn: "Jar 500g Oval Plastic (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 4_20,
    stock: 134,
    published: true,
  },
  {
    slug: "jar-plastic-500g-squeeze-imported-sku300",
    name: "برطمان 500 جرام بلاستيك اسكويز بالغطاء المستورد",
    nameEn: "Plastic Jar 500g Squeeze with Imported Lid (SKU 300)",
    department: "equipment",
    categorySlug: JARS,
    price: 8_00,
    sku: "300",
    stock: 139,
    published: true,
  },
  {
    slug: "jar-500g-crocodile",
    name: "برطمان 500 جرام التمساح",
    nameEn: "Jar 500g Crocodile Pattern",
    department: "equipment",
    categorySlug: JARS,
    price: 4_30,
    stock: 124,
    published: true,
  },
  {
    slug: "jar-250g-plastic-ribbed",
    name: "برطمان 250 جرام بلاستيك ممسوح فارغ",
    nameEn: "Jar 250g Plastic Ribbed (Empty)",
    department: "equipment",
    categorySlug: JARS,
    price: 4_00,
    stock: 122,
    published: true,
  },
  {
    slug: "jar-1kg-honeycomb-plastic",
    name: "برطمان 1ك بلاستيك عش نحل",
    nameEn: "Jar 1kg Plastic Honeycomb Pattern",
    department: "equipment",
    categorySlug: JARS,
    price: 4_00,
    stock: 120,
    published: true,
  },
  {
    slug: "jar-1kg-perforated-plastic",
    name: "برطمان 1 ك مشرشر بلاستيك",
    nameEn: "Jar 1kg Plastic Perforated",
    department: "equipment",
    categorySlug: JARS,
    price: 4_00,
    stock: 134,
    published: true,
  },
  {
    slug: "jar-1kg-plastic-square-window",
    name: "برطمان 1 ك بلاستيك مربع (شباك)",
    nameEn: "Jar 1kg Plastic Square (Window)",
    department: "equipment",
    categorySlug: JARS,
    price: 4_00,
    stock: 135,
    published: true,
  },
  {
    slug: "jar-1kg-crocodile",
    name: "برطمان 1 ك التمساح",
    nameEn: "Jar 1kg Crocodile Pattern",
    department: "equipment",
    categorySlug: JARS,
    price: 4_50,
    stock: 125,
    published: true,
  },

  // ── Cartons ──────────────────────────────────────────────────────────

  {
    slug: "carton-honey-12-halfkg-plastic",
    name: "كرتونه عسل سعه 12 نص ك فارغه مقاس بلاستيك",
    nameEn: "Honey Carton 12 x 500g Plastic Size (Empty)",
    department: "equipment",
    categorySlug: CARTONS,
    price: 11_00,
    stock: 130,
    published: true,
  },
  {
    slug: "carton-honey-12-1kg-plastic",
    name: "كرتونه عسل سعه 12 ك فارغه مقاس بلاستيك",
    nameEn: "Honey Carton 12 x 1kg Plastic Size (Empty)",
    department: "equipment",
    categorySlug: CARTONS,
    price: 13_00,
    stock: 133,
    published: true,
  },
  {
    slug: "carton-honey-12-halfkg-glass",
    name: "كرتونه عبوه عسل نصف كيلو ساده فارغه مقاس زجاج",
    nameEn: "Honey Carton 12 x 500g Glass Size (Empty)",
    department: "equipment",
    categorySlug: CARTONS,
    price: 11_00,
    stock: 134,
    published: true,
  },
  {
    slug: "carton-honey-12-1kg-glass",
    name: "كرتونه عبوه عسل كيلو ساده فارغه مقاس زجاج",
    nameEn: "Honey Carton 12 x 1kg Glass Size (Empty)",
    department: "equipment",
    categorySlug: CARTONS,
    price: 13_00,
    stock: 125,
    published: true,
  },

  // ── Lids ─────────────────────────────────────────────────────────────

  {
    slug: "lid-tin-500g-glass",
    name: "غطاء صاج برطمان زجاج 500 جرام",
    nameEn: "Tin Lid for Glass Jar 500g",
    department: "equipment",
    categorySlug: LIDS,
    price: 2_50,
    stock: 123,
    published: true,
  },
  {
    slug: "lid-tin-1kg-glass",
    name: "غطاء صاج برطمان زجاج 1 كيلو",
    nameEn: "Tin Lid for Glass Jar 1kg",
    department: "equipment",
    categorySlug: LIDS,
    price: 3_50,
    stock: 122,
    published: true,
  },

  // ── Shrink Wrap ──────────────────────────────────────────────────────

  {
    slug: "shrink-wrap-yellow-halfkg",
    name: "شرنك تغليف أصفر للغطاء النصف كيلو",
    nameEn: "Yellow Shrink Wrap for 500g Lid",
    department: "equipment",
    categorySlug: SHRINK_WRAP,
    price: 350_00,
    stock: 123,
    published: true,
  },
  {
    slug: "shrink-wrap-yellow-1kg",
    name: "شرنك تغليف أصفر للغطاء الكيلو",
    nameEn: "Yellow Shrink Wrap for 1kg Lid",
    department: "equipment",
    categorySlug: SHRINK_WRAP,
    price: 350_00,
    stock: 132,
    published: true,
  },

  // ── Nut Netting ──────────────────────────────────────────────────────

  {
    slug: "nut-netting-small",
    name: "شبكه بلاستيك صغيره للمكسرات",
    nameEn: "Plastic Netting Small (Nuts)",
    department: "equipment",
    categorySlug: NUT_NETTING,
    price: 70,
    stock: 132,
    published: true,
  },
  {
    slug: "nut-netting-large",
    name: "شبكة بلاستيك كبيره للمكسرات",
    nameEn: "Plastic Netting Large (Nuts)",
    department: "equipment",
    categorySlug: NUT_NETTING,
    price: 95,
    stock: 121,
    published: true,
  },

  // ── Fridge Containers ────────────────────────────────────────────────

  {
    slug: "fridge-container-1000g",
    name: "علبه ثلاجه بلاستيك 1000 جم فارغه",
    nameEn: "Fridge Container 1000g Plastic (Empty)",
    department: "equipment",
    categorySlug: FRIDGE_CONTAINERS,
    price: 8_50,
    stock: 120,
    published: true,
  },
  {
    slug: "fridge-container-750g",
    name: "علبه ثلاجه بلاستيك 750 جم فارغه",
    nameEn: "Fridge Container 750g Plastic (Empty)",
    department: "equipment",
    categorySlug: FRIDGE_CONTAINERS,
    price: 7_00,
    stock: 132,
    published: true,
  },
  {
    slug: "fridge-container-500g",
    name: "علبه ثلاجه بلاستيك 500 جم فارغه",
    nameEn: "Fridge Container 500g Plastic (Empty)",
    department: "equipment",
    categorySlug: FRIDGE_CONTAINERS,
    price: 6_50,
    stock: 131,
    published: true,
  },

  // ── Empty Comb Containers ────────────────────────────────────────────

  {
    slug: "comb-container-plastic-1kg",
    name: "علبه بلاستيك شمع بالعسل كيلو فارغه",
    nameEn: "Comb Honey Container 1kg Plastic (Empty)",
    department: "equipment",
    categorySlug: EMPTY_COMB_CONTAINERS,
    price: 6_00,
    stock: 121,
    published: true,
  },
  {
    slug: "comb-container-plastic-halfkg",
    name: "علب بلاستيك شمع بالعسل نصف كيلو فارغه",
    nameEn: "Comb Honey Container 500g Plastic (Empty)",
    department: "equipment",
    categorySlug: EMPTY_COMB_CONTAINERS,
    price: 5_00,
    stock: 134,
    published: true,
  },
  {
    slug: "comb-container-plastic-quarterkg",
    name: "علب بلاستيك شمع بالعسل ربع كيلو فارغه",
    nameEn: "Comb Honey Container 250g Plastic (Empty)",
    department: "equipment",
    categorySlug: EMPTY_COMB_CONTAINERS,
    price: 3_50,
    stock: 122,
    published: true,
  },

  // ── Honey Tin ────────────────────────────────────────────────────────

  // (Moved to other-extraction: row 31 is the 25kg tin)

  // ── Honey Spoons ─────────────────────────────────────────────────────

  {
    slug: "honey-spoons-10pcs",
    name: "علبة ملاعق عسل نحل (10 ملاعق)",
    nameEn: "Honey Spoons Box (10 Pieces)",
    department: "equipment",
    categorySlug: HONEY_SPOONS_PKG,
    price: 40_00,
    stock: 135,
    published: true,
  },

  // ── Fermentation Bags ────────────────────────────────────────────────

  {
    slug: "fermentation-bag-honeycomb",
    name: "كيس تعفن حضنه",
    nameEn: "Fermentation Bag Honeycomb",
    department: "equipment",
    categorySlug: FERMENTATION_BAGS,
    price: 110_00,
    stock: 128,
    published: true,
  },
  {
    slug: "fermentation-bag-newsima",
    name: "كيس نيوزيما",
    nameEn: "Fermentation Bag Newsima",
    department: "equipment",
    categorySlug: FERMENTATION_BAGS,
    price: 110_00,
    stock: 126,
    published: true,
  },

  // ── Tape Roll ────────────────────────────────────────────────────────

  {
    slug: "tape-roll-medium",
    name: "بكره لصق وسط 150",
    nameEn: "Tape Roll Medium 150",
    department: "equipment",
    categorySlug: TAPE_ROLL,
    price: 35_00,
    stock: 130,
    published: true,
  },

  // ── 30kg Drum ────────────────────────────────────────────────────────

  {
    slug: "drum-30kg-empty",
    name: "جركن سعه 30 ك فارغ",
    nameEn: "Drum 30kg (Empty)",
    department: "equipment",
    categorySlug: DRUM_30KG,
    price: 110_00,
    stock: 60,
    published: true,
  },

  // ════════════════════════════════════════════════════════════════════════
  // EQUIPMENT > FOUNDATION WAX
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "foundation-export-2kg",
    name: "علبه شمع أساس عتمان الاصلي 2 ك",
    nameEn: "Foundation Wax Export 2kg (Etman Original)",
    department: "equipment",
    categorySlug: FOUNDATION_EXPORT,
    price: 425_00,
    stock: 63,
    published: true,
    image: "foundationWax",
  },
  {
    slug: "foundation-local-2kg",
    name: "علبه شمع أساس بلدي عتمان الأصلي تصدير 2ك",
    nameEn: "Foundation Wax Local 2kg (Etman Original Export)",
    department: "equipment",
    categorySlug: FOUNDATION_LOCAL,
    price: 500_00,
    stock: 60,
    published: true,
    image: "foundationWax",
  },

  // ════════════════════════════════════════════════════════════════════════
  // HONEY > COMB HONEY (شمع بالعسل) — sold by quantity per kilo
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "comb-honey-per-kg-clover",
    name: "برواز شمع بالعسل برسيم (سعر الكيلو)",
    nameEn: "Comb Honey Clover (per kg)",
    department: "honey",
    categorySlug: COMB_HONEY,
    price: 170_00,
    stock: 999,
    published: true,
    image: "combFrame",
  },
  {
    slug: "comb-honey-per-kg-citrus",
    name: "برواز شمع بالعسل موالح (سعر الكيلو)",
    nameEn: "Comb Honey Citrus (per kg)",
    department: "honey",
    categorySlug: COMB_HONEY,
    price: 180_00,
    stock: 999,
    published: true,
    image: "combFrameCitrus",
  },

  // ════════════════════════════════════════════════════════════════════════
  // EQUIPMENT > PRODUCTS BY QUANTITY (منتجات بالكمية)
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "royal-jelly-by-quantity",
    name: "غذاء ملكات مستورد بالكمية",
    nameEn: "Royal Jelly (by Quantity)",
    department: "equipment",
    categorySlug: BY_QUANTITY,
    price: 300,
    stock: 999,
    published: true,
  },
  {
    slug: "palm-pollen-by-quantity",
    name: "طلع نخل بالكمية",
    nameEn: "Palm Pollen (by Quantity)",
    department: "equipment",
    categorySlug: BY_QUANTITY,
    price: 45,
    stock: 999,
    published: true,
  },
  {
    slug: "bee-pollen-corn-by-quantity",
    name: "حبوب لقاح ذرة بالكمية",
    nameEn: "Corn Bee Pollen (by Quantity)",
    department: "equipment",
    categorySlug: BY_QUANTITY,
    price: 55,
    stock: 999,
    published: true,
  },
  {
    slug: "bee-pollen-clover-by-quantity",
    name: "حبوب لقاح برسيم بالكمية",
    nameEn: "Clover Bee Pollen (by Quantity)",
    department: "equipment",
    categorySlug: BY_QUANTITY,
    price: 65,
    stock: 999,
    published: true,
  },
  {
    slug: "propolis-by-quantity",
    name: "بروبليس بالكمية",
    nameEn: "Propolis (by Quantity)",
    department: "equipment",
    categorySlug: BY_QUANTITY,
    price: 400,
    stock: 999,
    published: true,
  },
];
