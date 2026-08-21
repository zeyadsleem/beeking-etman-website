/// <reference types="node" />
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/server/db/schema";

const db = drizzle(createClient({ url: process.env.DATABASE_URL ?? "file:local.db" }), { schema });

const IMG = {
  glassLight: "/images/Beeking Etman/برطمان عسل البرسيم رقم 1.png",
  glassPale: "/images/Beeking Etman/برطمان عسل فاتح.jpg",
  glassDark: "/images/Beeking Etman/برطمان السدر المصرى.jpg",
  blackseed: "/images/Beeking Etman/عسل حبة البركة.jpg",
  plasticJar: "/images/Beeking Etman/عسل 1 كيلو برسيم بلاستيك.png",
  plasticJar500: "/images/Beeking Etman/عسل برسيم 500 جرام بلاستيك.png",
  squeezeBottle: "/images/Beeking Etman/زجاجة عسل مضغوطة.jpg",
  combFrame: "/images/Beeking Etman/برواز البرسيم.png",
  combFrameCitrus: "/images/Beeking Etman/برواز الموالح.png",
  combChunks: "/images/Beeking Etman/قطع شمع العسل.jpg",
  nutsInHoney: "/images/Beeking Etman/مكسرات في العسل.jpg",
  nutsCan: "/images/Beeking Etman/علبة مكسرات بالعسل.jpg",
  hazelnut: "/images/Beeking Etman/كيس بندق 100 جرام.png",
  pistachio: "/images/Beeking Etman/كيس فستق 100 جرام.png",
  almond: "/images/Beeking Etman/كيس لوز 100 جرام.jpg",
  cashew: "/images/Beeking Etman/كيس كاجو 100 جرام.png",
  mixedNuts: "/images/Beeking Etman/كيس مكسرات مشكل 100 جرام.png",
  beePollen: "/images/Beeking Etman/علبة حبوب اللقاح البرسيم 20 جرام.png",
  beePollen125: "/images/Beeking Etman/علبة حبوب اللقاح البرسيم 125 جرام.png",
  royalJelly: "/images/Beeking Etman/غذاء ملكات النحل.jpg",
  propolis: "/images/Beeking Etman/علبة البروبليس.jpg",
  ginseng: "/images/Beeking Etman/علبة الجينسينج.png",
  palmPollen: "/images/Beeking Etman/علبة طلع النخل.png",
  honeySpoons: "/images/Beeking Etman/ملاعق العسل.jpg",
  dipper: "/images/Beeking Etman/مغرفة العسل.jpg",
};

// Secondary gallery shots per category — each product's gallery is its primary
// image plus a few category-appropriate shots, deduped and capped at 4.
const GALLERY: Record<string, (keyof typeof IMG)[]> = {
  flowers: ["glassLight", "glassPale", "dipper"],
  sidr: ["glassDark", "glassLight", "dipper"],
  vib: ["glassPale", "glassLight", "dipper"],
  "nuts-honey": ["nutsInHoney", "nutsCan", "blackseed"],
  comb: ["combFrame", "combFrameCitrus", "combChunks"],
  "bee-supplements": ["royalJelly", "propolis", "beePollen", "honeySpoons"],
  nuts: ["nutsCan", "hazelnut", "pistachio", "mixedNuts"],
};

const CATEGORIES = [
  {
    slug: "flowers",
    name: "عسل الزهور والبردقوش وحبة البركة",
    nameEn: "Flowers, Marjoram & Black Seed",
  },
  { slug: "sidr", name: "عسل السدر", nameEn: "Sidr Honey" },
  { slug: "vib", name: "عسل Vib", nameEn: "Vib Honey" },
  { slug: "nuts-honey", name: "مكسرات بالعسل", nameEn: "Nuts in Honey" },
  { slug: "nuts", name: "مكسرات", nameEn: "Nuts" },
  { slug: "comb", name: "شمع العسل", nameEn: "Comb Honey" },
  { slug: "bee-supplements", name: "مكملات النحل", nameEn: "Bee Supplements" },
];

interface SeedVariant {
  name: string;
  nameEn: string;
  price: number;
  stock: number;
  image: keyof typeof IMG;
}

interface SeedProduct {
  slug: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  image: keyof typeof IMG;
  featured: boolean;
  variants: SeedVariant[];
}

const PRODUCTS: SeedProduct[] = [
  // ── Flowers, Marjoram & Black Seed ──────────────────────────────────
  {
    slug: "clover-honey-1kg-glass",
    name: "عسل برسيم 1 ك زجاج",
    nameEn: "Clover Honey 1kg Glass",
    description:
      "عسل البرسيم الفاتح من مناحل الدلتا في عبوة زجاجية أنيقة — الأخف والأكثر استخدامًا في مصر، مثالي للإفطار والتحلية اليومية.",
    descriptionEn:
      "Light clover honey from Delta apiaries in an elegant glass jar — the lightest and most used honey in Egypt, perfect for breakfast and daily sweetening.",
    category: "flowers",
    image: "glassLight",
    featured: true,
    variants: [
      { name: "1 ك زجاج", nameEn: "1kg Glass", price: 135_00, stock: 30, image: "glassLight" },
    ],
  },
  {
    slug: "clover-honey-1kg-plastic",
    name: "عسل برسيم 1 ك بلاستيك",
    nameEn: "Clover Honey 1kg Plastic",
    description:
      "نفس عسل البرسيم النقي بعبوة بلاستيكية عملية بسعر اقتصادي — خيار البيت الكبير والاستخدام اليومي.",
    descriptionEn:
      "The same pure clover honey in a practical, budget-friendly plastic jar — the choice of big households and daily use.",
    category: "flowers",
    image: "plasticJar",
    featured: false,
    variants: [
      { name: "1 ك بلاستيك", nameEn: "1kg Plastic", price: 120_00, stock: 30, image: "plasticJar" },
    ],
  },
  {
    slug: "clover-honey-1kg-squeeze",
    name: "عسل برسيم 1 ك اسكويز",
    nameEn: "Clover Honey 1kg Squeeze",
    description:
      "عسل برسيم فاتح بزجاجة اسكويز عملية تسهّل السكب والتحلية بلا فوضى — مثالي للأطفال والمطبخ.",
    descriptionEn:
      "Light clover honey in a practical squeeze bottle that makes pouring and sweetening mess-free — perfect for kids and the kitchen.",
    category: "flowers",
    image: "squeezeBottle",
    featured: false,
    variants: [
      {
        name: "1 ك اسكويز",
        nameEn: "1kg Squeeze",
        price: 130_00,
        stock: 25,
        image: "squeezeBottle",
      },
    ],
  },
  {
    slug: "clover-honey-500g-glass",
    name: "عسل برسيم 500 زجاج",
    nameEn: "Clover Honey 500g Glass",
    description: "نصف كيلو عسل برسيم فاتح بعبوة زجاج — الحجم المثالي للهدايا والمكاتب والسفر.",
    descriptionEn:
      "Half a kilo of light clover honey in a glass jar — the perfect size for gifts, offices and travel.",
    category: "flowers",
    image: "glassLight",
    featured: false,
    variants: [
      {
        name: "500 جرام زجاج",
        nameEn: "500g Glass",
        price: 70_00,
        stock: 40,
        image: "glassLight",
      },
    ],
  },
  {
    slug: "clover-honey-500g-plastic",
    name: "عسل برسيم 500 بلاستيك",
    nameEn: "Clover Honey 500g Plastic",
    description: "عسل برسيم نصف كيلو بعبوة بلاستيك اقتصادية — خفيف وعملي للاستخدام اليومي.",
    descriptionEn:
      "Half a kilo of clover honey in an economical plastic jar — light and practical for daily use.",
    category: "flowers",
    image: "plasticJar500",
    featured: false,
    variants: [
      {
        name: "500 جرام بلاستيك",
        nameEn: "500g Plastic",
        price: 65_00,
        stock: 50,
        image: "plasticJar500",
      },
    ],
  },
  {
    slug: "citrus-honey-150g",
    name: "عسل موالح 150 جرام",
    nameEn: "Citrus Honey 150g",
    description:
      "عسل الموالح الذهبي في عبوة صغيرة لتجربة النكهة أو لاصطحابه في السفر — من أزهار البرتقال والليمون.",
    descriptionEn:
      "Golden citrus honey in a small jar to try the flavor or take on the go — from orange and lemon blossoms.",
    category: "flowers",
    image: "glassLight",
    featured: false,
    variants: [{ name: "150 جرام", nameEn: "150g", price: 35_00, stock: 45, image: "glassLight" }],
  },
  {
    slug: "citrus-honey-1kg",
    name: "عسل موالح 1 ك عادي",
    nameEn: "Citrus Honey 1kg",
    description:
      "كيلو عسل موالح ذهبي منعش من أزهار البرتقال والليمون واليوسفي — غني بفيتامين سي بنكهة حمضية مميزة.",
    descriptionEn:
      "A kilo of fresh golden citrus honey from orange, lemon and tangerine blossoms — rich in vitamin C with a distinctive citrusy taste.",
    category: "flowers",
    image: "glassLight",
    featured: true,
    variants: [{ name: "1 ك عادي", nameEn: "1kg", price: 145_00, stock: 25, image: "glassLight" }],
  },
  {
    slug: "marjoram-honey-500g",
    name: "عسل بردقوش 500 جرام",
    nameEn: "Marjoram Honey 500g",
    description:
      "عسل البردقوش الطبي الرفيع من زهر البردقوش — خفيف ولطيف، مفضل لتهدئة الأعصاب وصحة الجهاز التنفسي.",
    descriptionEn:
      "Refined medicinal marjoram honey from marjoram blossoms — light and gentle, favored for calming nerves and respiratory health.",
    category: "flowers",
    image: "dipper",
    featured: false,
    variants: [{ name: "500 جرام", nameEn: "500g", price: 90_00, stock: 22, image: "dipper" }],
  },
  {
    slug: "marjoram-honey-1kg-glass",
    name: "عسل بردقوش 1ك زجاج",
    nameEn: "Marjoram Honey 1kg Glass",
    description: "كيلو عسل بردقوش بعبوة زجاج فاخرة — هدية صحية راقية لمن تحب.",
    descriptionEn:
      "A kilo of marjoram honey in a luxurious glass jar — a premium health gift for someone you love.",
    category: "flowers",
    image: "glassPale",
    featured: false,
    variants: [
      { name: "1 ك زجاج", nameEn: "1kg Glass", price: 180_00, stock: 16, image: "glassPale" },
    ],
  },
  {
    slug: "blackseed-honey-half",
    name: "عسل حبة البركة نص",
    nameEn: "Black Seed Honey Half",
    description: "عسل برسيم مدعّم بحبة البركة المطحونة — منشط مناعة شتوي في حجم نص كيلو.",
    descriptionEn:
      "Clover honey boosted with ground black seed — a winter immunity booster in a half-kilo size.",
    category: "flowers",
    image: "blackseed",
    featured: false,
    variants: [{ name: "نص", nameEn: "Half", price: 90_00, stock: 24, image: "blackseed" }],
  },
  {
    slug: "blackseed-honey-1kg",
    name: "عسل حبة البركة 1 ك",
    nameEn: "Black Seed Honey 1kg",
    description:
      "عسل مدعّم بحبة البركة المطحونة — منشط طبيعي للمناعة والأكثر طلبًا في الشتاء، بحجم كيلو.",
    descriptionEn:
      "Honey boosted with ground black seed — a natural immunity booster and the most requested in winter, in a kilo size.",
    category: "flowers",
    image: "blackseed",
    featured: true,
    variants: [{ name: "1 ك", nameEn: "1kg", price: 180_00, stock: 18, image: "blackseed" }],
  },

  // ── Sidr Honey ──────────────────────────────────────────────────────
  {
    slug: "sidr-honey-1kg",
    name: "عسل سدر مصري 1 ك",
    nameEn: "Egyptian Sidr Honey 1kg",
    description:
      "عسل السدر المصري الفاخر من جنوب الصعيد وسيناء، داكن القوام غني بالمعادن، ينافس السدر اليمني — درة العسل المصري.",
    descriptionEn:
      "The finest Egyptian sidr honey from Upper Egypt and Sinai — dark and mineral-rich, rivaling Yemeni sidr — the jewel of Egyptian honey.",
    category: "sidr",
    image: "glassDark",
    featured: true,
    variants: [{ name: "1 ك", nameEn: "1kg", price: 1000_00, stock: 12, image: "glassDark" }],
  },
  {
    slug: "sidr-honey-500g",
    name: "عسل سدر 500 جرام",
    nameEn: "Sidr Honey 500g",
    description: "نصف كيلو من درة العسل المصري — سدر داكن غني بالمعادن، تجربة ملكية بحجم مناسب.",
    descriptionEn:
      "Half a kilo of the jewel of Egyptian honey — dark sidr rich in minerals, a royal experience in a fitting size.",
    category: "sidr",
    image: "glassDark",
    featured: false,
    variants: [{ name: "500 جرام", nameEn: "500g", price: 500_00, stock: 18, image: "glassDark" }],
  },

  // ── Vib Honey ───────────────────────────────────────────────────────
  {
    slug: "clover-honey-1kg-vib",
    name: "عسل برسيم 1ك Vib",
    nameEn: "Clover Honey 1kg Vib",
    description: "كيلو عسل برسيم كامل بعبوة Vib الزجاجية الشهيرة — خيار عائلي موثوق بسعر مميز.",
    descriptionEn:
      "A full kilo of clover honey in the famous Vib glass jar — a trusted family choice at a great price.",
    category: "vib",
    image: "glassPale",
    featured: false,
    variants: [
      { name: "1 ك Vib", nameEn: "1kg Vib", price: 180_00, stock: 25, image: "glassPale" },
    ],
  },
  {
    slug: "clover-honey-half-vib",
    name: "عسل برسيم نص Vib",
    nameEn: "Clover Honey Half Vib",
    description: "نصف كيلو عسل برسيم بعبوة Vib — توازن مثالي بين الجودة والسعر للاستخدام الفردي.",
    descriptionEn:
      "Half a kilo of clover honey in a Vib jar — a perfect balance of quality and price for individual use.",
    category: "vib",
    image: "glassPale",
    featured: false,
    variants: [{ name: "نص Vib", nameEn: "Half Vib", price: 90_00, stock: 35, image: "glassPale" }],
  },
  {
    slug: "citrus-honey-1kg-vib",
    name: "عسل موالح 1ك Vib",
    nameEn: "Citrus Honey 1kg Vib",
    description: "كيلو عسل موالح منعش بعبوة Vib الزجاجية — نكهة الحمضيات المشرقة للعائلة.",
    descriptionEn:
      "A kilo of refreshing citrus honey in a Vib glass jar — bright citrus flavor for the whole family.",
    category: "vib",
    image: "glassPale",
    featured: false,
    variants: [
      { name: "1 ك Vib", nameEn: "1kg Vib", price: 200_00, stock: 20, image: "glassPale" },
    ],
  },
  {
    slug: "citrus-honey-half-vib",
    name: "عسل موالح نص Vib",
    nameEn: "Citrus Honey Half Vib",
    description: "نصف كيلو عسل الموالح بعبوة Vib — نكهة الحمضيات في حجم ذهبي مناسب.",
    descriptionEn:
      "Half a kilo of citrus honey in a Vib jar — citrus flavor in a perfectly sized golden portion.",
    category: "vib",
    image: "glassPale",
    featured: false,
    variants: [
      { name: "نص Vib", nameEn: "Half Vib", price: 100_00, stock: 30, image: "glassPale" },
    ],
  },

  // ── Nuts in Honey ───────────────────────────────────────────────────
  {
    slug: "six-blend-1kg-plastic",
    name: "عسل خلطة سداسي بلاستيك",
    nameEn: "Six-Herb Blend Honey 1kg Plastic",
    description:
      "الخلطة السداسية المتكاملة من أعشاب وعسل مختار لتقوية المناعة والطاقة اليومية — بعبوة بلاستيك اقتصادية.",
    descriptionEn:
      "The complete six-herb blend of selected herbs and honey to strengthen immunity and daily energy — in an economical plastic jar.",
    category: "nuts-honey",
    image: "plasticJar",
    featured: false,
    variants: [
      { name: "1 ك بلاستيك", nameEn: "1kg Plastic", price: 100_00, stock: 20, image: "plasticJar" },
    ],
  },
  {
    slug: "nuts-in-honey-370",
    name: "مكسرات بالعسل 370",
    nameEn: "Nuts in Honey 370",
    description: "لوز وفستق وكاجو وبندق مغموسة في عسل برسيم صافٍ — سناك صحي وملكي بعبوة 370 جرام.",
    descriptionEn:
      "Almonds, pistachios, cashews and hazelnuts dipped in pure clover honey — a healthy, royal snack in a 370g jar.",
    category: "nuts-honey",
    image: "nutsInHoney",
    featured: false,
    variants: [{ name: "370 جرام", nameEn: "370g", price: 90_00, stock: 20, image: "nutsInHoney" }],
  },
  {
    slug: "nuts-in-honey-370-round",
    name: "مكسرات بالعسل 370 دائري",
    nameEn: "Nuts in Honey 370 Round",
    description: "مكسرات فاخرة بالعسل في عبوة دائرية أنيقة — مظهر جميل ومذاق ملكي.",
    descriptionEn:
      "Premium nuts in honey in an elegant round jar — a beautiful look and a royal taste.",
    category: "nuts-honey",
    image: "nutsInHoney",
    featured: false,
    variants: [
      {
        name: "370 جرام دائري",
        nameEn: "370g Round",
        price: 100_00,
        stock: 18,
        image: "nutsInHoney",
      },
    ],
  },
  {
    slug: "nuts-in-honey-oval",
    name: "مكسرات بالعسل بيضاوي",
    nameEn: "Nuts in Honey Oval",
    description: "تشكيلة مكسرات بالعسل بعبوة بيضاوية فاخرة — مظهر راقٍ ومذاق أرقى.",
    descriptionEn:
      "A selection of nuts in honey in a luxurious oval jar — a refined look and an even finer taste.",
    category: "nuts-honey",
    image: "nutsInHoney",
    featured: false,
    variants: [{ name: "بيضاوي", nameEn: "Oval", price: 125_00, stock: 16, image: "nutsInHoney" }],
  },
  {
    slug: "nuts-in-honey-can-400g",
    name: "مكسرات بالعسل كان 400 جرام",
    nameEn: "Nuts in Honey Can 400g",
    description: "مكسرات فاخرة بالعسل في علبة كان معدنية تحفظ الجودة والنكهة — للعزائم والهدايا.",
    descriptionEn:
      "Premium nuts in honey in a metal can that preserves quality and flavor — for gatherings and gifts.",
    category: "nuts-honey",
    image: "nutsCan",
    featured: false,
    variants: [
      { name: "كان 400 جرام", nameEn: "Can 400g", price: 125_00, stock: 14, image: "nutsCan" },
    ],
  },
  {
    slug: "nuts-in-honey-800g",
    name: "مكسرات بالعسل 800 جرام",
    nameEn: "Nuts in Honey 800g",
    description: "حجم العائلة — مكسرات مشكّلة فاخرة مغموسة في عسل برسيم بوزن 800 جرام.",
    descriptionEn: "Family size — a fine selection of nuts dipped in clover honey, weighing 800g.",
    category: "nuts-honey",
    image: "nutsInHoney",
    featured: true,
    variants: [
      { name: "800 جرام", nameEn: "800g", price: 210_00, stock: 10, image: "nutsInHoney" },
    ],
  },
  {
    slug: "nuts-in-honey-extra-1kg",
    name: "مكسرات بالعسل اكستر 1 ك",
    nameEn: "Nuts in Honey Extra 1kg",
    description: "أفخم تشكيلة مكسرات بالعسل بوزن كيلو كامل — باقة الهدايا الملكية بامتياز.",
    descriptionEn:
      "The most luxurious selection of nuts in honey at a full kilo — the royal gift bundle par excellence.",
    category: "nuts-honey",
    image: "nutsInHoney",
    featured: false,
    variants: [
      { name: "اكستر 1 ك", nameEn: "Extra 1kg", price: 250_00, stock: 8, image: "nutsInHoney" },
    ],
  },

  // ── Comb Honey ──────────────────────────────────────────────────────
  {
    slug: "comb-frame-clover",
    name: "برواز شمع بالعسل برسيم",
    nameEn: "Comb Frame Clover",
    description: "برواز الشمع الكامل من بيت النحل — قطعة حقيقية من الخلية تؤكل كما هي.",
    descriptionEn: "A full comb frame from the beehive — a real piece of the hive, eaten as is.",
    category: "comb",
    image: "combFrame",
    featured: true,
    variants: [{ name: "برسيم", nameEn: "Clover", price: 170_00, stock: 15, image: "combFrame" }],
  },
  {
    slug: "comb-frame-citrus",
    name: "برواز شمع بالعسل موالح",
    nameEn: "Comb Frame Citrus",
    description: "برواز شمع كامل بعسل الموالح الطازج — طبيعي 100% من قلب الخلية.",
    descriptionEn:
      "A full comb frame with fresh citrus honey — 100% natural from the heart of the hive.",
    category: "comb",
    image: "combFrameCitrus",
    featured: false,
    variants: [
      { name: "موالح", nameEn: "Citrus", price: 180_00, stock: 15, image: "combFrameCitrus" },
    ],
  },
  {
    slug: "comb-honey-250g-clover",
    name: "شمع بالعسل 250 برسيم",
    nameEn: "Comb Honey 250g Clover",
    description: "قطع شمع طبيعية بعسل البرسيم الطازج من الفرازات — تُقطع وتُؤكل كما هي.",
    descriptionEn:
      "Natural comb pieces with fresh clover honey straight from the extractor — cut and eaten as is.",
    category: "comb",
    image: "combChunks",
    featured: false,
    variants: [
      {
        name: "250 جرام برسيم",
        nameEn: "250g Clover",
        price: 50_00,
        stock: 25,
        image: "combChunks",
      },
    ],
  },
  {
    slug: "comb-honey-250g-citrus",
    name: "شمع بالعسل 250 جرام موالح",
    nameEn: "Comb Honey 250g Citrus",
    description: "قطع شمع بعسل الموالح الطازج — وجبة الخلية الطبيعية بحجم 250 جرام.",
    descriptionEn: "Comb pieces with fresh citrus honey — nature's hive meal in a 250g size.",
    category: "comb",
    image: "combChunks",
    featured: false,
    variants: [
      {
        name: "250 جرام موالح",
        nameEn: "250g Citrus",
        price: 60_00,
        stock: 25,
        image: "combChunks",
      },
    ],
  },
  {
    slug: "comb-honey-500g-clover",
    name: "شمع بالعسل 500 برسيم",
    nameEn: "Comb Honey 500g Clover",
    description: "نصف كيلو شمع طبيعي بالعسل البرسيم — من الفرازات مباشرة إلى بيتك.",
    descriptionEn:
      "Half a kilo of natural comb with clover honey — from the extractor straight to your home.",
    category: "comb",
    image: "combChunks",
    featured: false,
    variants: [
      {
        name: "500 جرام برسيم",
        nameEn: "500g Clover",
        price: 90_00,
        stock: 18,
        image: "combChunks",
      },
    ],
  },
  {
    slug: "comb-honey-500g-citrus",
    name: "شمع بالعسل 500 جرام موالح",
    nameEn: "Comb Honey 500g Citrus",
    description: "نصف كيلو شمع بالعسل الموالح — يُقطع ويُؤكل كما هو طازجًا من الخلية.",
    descriptionEn: "Half a kilo of comb with citrus honey — cut and eaten fresh from the hive.",
    category: "comb",
    image: "combChunks",
    featured: false,
    variants: [
      {
        name: "500 جرام موالح",
        nameEn: "500g Citrus",
        price: 100_00,
        stock: 18,
        image: "combChunks",
      },
    ],
  },

  // ── Bee Supplements ─────────────────────────────────────────────────
  {
    slug: "royal-jelly-5g",
    name: "غذاء ملكات 5 جم بلدي",
    nameEn: "Royal Jelly 5g Local",
    description: "غذاء ملكات نقي طازج من الخلية — أقوى منشطات الطاقة والمناعة الطبيعية في مصر.",
    descriptionEn:
      "Pure fresh royal jelly from the hive — one of Egypt's strongest natural energy and immunity boosters.",
    category: "bee-supplements",
    image: "royalJelly",
    featured: true,
    variants: [{ name: "5 جم", nameEn: "5g", price: 80_00, stock: 30, image: "royalJelly" }],
  },
  {
    slug: "propolis-box",
    name: "علبة بروبليس",
    nameEn: "Propolis Box",
    description: "خلاصة البروبليس (العكبر) الطبيعي المعزّز للمناعة ومضاد الالتهابات.",
    descriptionEn: "Natural propolis extract, boosting immunity and fighting inflammation.",
    category: "bee-supplements",
    image: "propolis",
    featured: true,
    variants: [{ name: "علبة", nameEn: "Box", price: 70_00, stock: 20, image: "propolis" }],
  },
  {
    slug: "ginseng-box",
    name: "علبة جينسنج",
    nameEn: "Ginseng Box",
    description: "خلطة الجينسنج بالعسل لنشاط الجسم وزيادة التركيز — قوة الطبيعة في علبة.",
    descriptionEn: "A ginseng-honey blend for body energy and focus — nature's power in a box.",
    category: "bee-supplements",
    image: "ginseng",
    featured: false,
    variants: [{ name: "علبة", nameEn: "Box", price: 80_00, stock: 20, image: "ginseng" }],
  },
  {
    slug: "palm-pollen-box",
    name: "علبة طلع نخل",
    nameEn: "Palm Pollen Box",
    description: "طلع النخل الطبيعي بالعسل — مكمل الطاقة المصري التقليدي الخالد.",
    descriptionEn: "Natural palm pollen with honey — the timeless Egyptian energy supplement.",
    category: "bee-supplements",
    image: "palmPollen",
    featured: false,
    variants: [{ name: "علبة", nameEn: "Box", price: 25_00, stock: 20, image: "palmPollen" }],
  },
  {
    slug: "bee-pollen-box",
    name: "علبة حبوب لقاح",
    nameEn: "Bee Pollen Box",
    description: "حبوب لقاح النحل الخام — بروتين طبيعي غني بالفيتامينات والمعادن.",
    descriptionEn: "Raw bee pollen — a natural protein rich in vitamins and minerals.",
    category: "bee-supplements",
    image: "beePollen",
    featured: false,
    variants: [{ name: "علبة", nameEn: "Box", price: 30_00, stock: 20, image: "beePollen" }],
  },
  {
    slug: "bee-pollen-125g",
    name: "علبة حبوب لقاح 125",
    nameEn: "Bee Pollen 125g Box",
    description: "عبوة 125 جرام من حبوب اللقاح الخام — دعم مناعة منتظم بمقدار كافٍ.",
    descriptionEn: "A 125g jar of raw pollen — regular immunity support in a sufficient amount.",
    category: "bee-supplements",
    image: "beePollen125",
    featured: false,
    variants: [
      { name: "125 جرام", nameEn: "125g", price: 100_00, stock: 15, image: "beePollen125" },
    ],
  },
  {
    slug: "honey-spoons-box",
    name: "علبة ملاعق عسل",
    nameEn: "Honey Spoons Box",
    description: "ملاعق عسل سفر جاهزة لأي مكان — عملية وأنيقة لأوقاتك خارج البيت.",
    descriptionEn:
      "Ready-to-use travel honey spoons for anywhere — practical and elegant for your time out of the house.",
    category: "bee-supplements",
    image: "honeySpoons",
    featured: false,
    variants: [{ name: "علبة", nameEn: "Box", price: 40_00, stock: 25, image: "honeySpoons" }],
  },

  // ── Nuts ────────────────────────────────────────────────────────────
  {
    slug: "hazelnut-100g",
    name: "بندق 100 جرام",
    nameEn: "Hazelnuts 100g",
    description: "بندق فاخر محمّص — سناك صحي بمذاق غني وقوام مقرمش.",
    descriptionEn:
      "Premium roasted hazelnuts — a healthy snack with a rich taste and crunchy texture.",
    category: "nuts",
    image: "hazelnut",
    featured: false,
    variants: [{ name: "100 جرام", nameEn: "100g", price: 110_00, stock: 25, image: "hazelnut" }],
  },
  {
    slug: "pistachio-100g",
    name: "فستق 100 جرام",
    nameEn: "Pistachios 100g",
    description: "فستق حلبي مقشّر فاخر — خيار الرقّي الأول في السناكات الصحية.",
    descriptionEn: "Premium shelled Aleppo pistachios — the first choice in healthy snacks.",
    category: "nuts",
    image: "pistachio",
    featured: false,
    variants: [{ name: "100 جرام", nameEn: "100g", price: 145_00, stock: 25, image: "pistachio" }],
  },
  {
    slug: "almond-100g",
    name: "لوز 100 جرام",
    nameEn: "Almonds 100g",
    description: "لوز طبيعي محمّص غني بالدهون الصحية — سناك يمنحك الطاقة والتركيز.",
    descriptionEn:
      "Natural roasted almonds rich in healthy fats — a snack that gives you energy and focus.",
    category: "nuts",
    image: "almond",
    featured: false,
    variants: [{ name: "100 جرام", nameEn: "100g", price: 125_00, stock: 25, image: "almond" }],
  },
  {
    slug: "cashew-100g",
    name: "كاجو 100 جرام",
    nameEn: "Cashews 100g",
    description: "كاجو فاخر محمّص بقوام كريمي ناعم — سناك راقٍ بلا مقارنة.",
    descriptionEn:
      "Premium roasted cashews with a soft creamy texture — an unmatched refined snack.",
    category: "nuts",
    image: "cashew",
    featured: false,
    variants: [{ name: "100 جرام", nameEn: "100g", price: 135_00, stock: 25, image: "cashew" }],
  },
  {
    slug: "mixed-nuts-100g",
    name: "مكسرات مشكّلة 100 جرام",
    nameEn: "Mixed Nuts 100g",
    description: "تشكيلة مكسرات فاخرة للقهوة والمناسبات — نكهات متنوعة في عبوة واحدة.",
    descriptionEn: "A premium nut mix for coffee and occasions — varied flavors in one jar.",
    category: "nuts",
    image: "mixedNuts",
    featured: false,
    variants: [{ name: "100 جرام", nameEn: "100g", price: 85_00, stock: 30, image: "mixedNuts" }],
  },
  {
    slug: "nuts-extra-can-500g",
    name: "مكسرات اكسترا 500 كان",
    nameEn: "Extra Nuts Can 500g",
    description: "باقة المكسرات الفاخرة بتشكيلة الموسم في علبة كان — للهدايا والعزائم.",
    descriptionEn:
      "The premium nut bundle with the season's selection in a can — for gifts and gatherings.",
    category: "nuts",
    image: "nutsCan",
    featured: false,
    variants: [{ name: "500 كان", nameEn: "Can 500g", price: 320_00, stock: 12, image: "nutsCan" }],
  },
];

// Rows per multi-value INSERT — keeps bound parameters well under SQLite's
// variable limit for the widest table (variants: 7 columns → 700 params).
const INSERT_CHUNK_SIZE = 100;

function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

function requireId(map: Map<string, string>, key: string): string {
  const id = map.get(key);
  if (id === undefined) throw new Error(`Seed reference missing id for "${key}"`);
  return id;
}

async function seed(): Promise<void> {
  // Truncate first, children before parents, so no FK is violated mid-reset.
  await db.delete(schema.orderItem);
  await db.delete(schema.order);
  await db.delete(schema.productVariant);
  await db.delete(schema.productImage);

  // Upsert on slug keeps category/product ids stable across reseeds, which the
  // d1-seed export relies on to merge rows without orphaning D1 orders.
  const categoryRows = await db
    .insert(schema.category)
    .values(CATEGORIES.map((c) => ({ name: c.name, nameEn: c.nameEn, slug: c.slug })))
    .onConflictDoUpdate({
      target: schema.category.slug,
      set: { name: sql`excluded.name`, nameEn: sql`excluded.name_en` },
    })
    .returning({ id: schema.category.id, slug: schema.category.slug });
  const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]));

  const productRows = await db
    .insert(schema.product)
    .values(
      PRODUCTS.map((p) => ({
        name: p.name,
        nameEn: p.nameEn,
        slug: p.slug,
        description: p.description,
        descriptionEn: p.descriptionEn,
        price: p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0,
        stock: 0,
        image: IMG[p.image],
        categoryId: requireId(categoryIds, p.category),
        featured: p.featured ? 1 : 0,
      })),
    )
    .onConflictDoUpdate({
      target: schema.product.slug,
      set: {
        name: sql`excluded.name`,
        nameEn: sql`excluded.name_en`,
        description: sql`excluded.description`,
        descriptionEn: sql`excluded.description_en`,
        price: sql`excluded.price`,
        stock: sql`excluded.stock`,
        image: sql`excluded.image`,
        categoryId: sql`excluded.category_id`,
        featured: sql`excluded.featured`,
      },
    })
    .returning({ id: schema.product.id, slug: schema.product.slug });
  const productIds = new Map(productRows.map((row) => [row.slug, row.id]));

  // Variants/images were truncated above, so plain inserts cannot conflict.
  // Their ids churn per run like image ids always have; the d1-seed export's
  // stale-row deletes reconcile that on the D1 side.
  const variantValues = PRODUCTS.flatMap((p) =>
    p.variants.map((v, sortOrder) => ({
      productId: requireId(productIds, p.slug),
      name: v.name,
      nameEn: v.nameEn,
      price: v.price,
      stock: v.stock,
      image: IMG[v.image],
      sortOrder,
    })),
  );
  const imageValues = PRODUCTS.flatMap((p) => {
    const productId = requireId(productIds, p.slug);
    const shots = (GALLERY[p.category] ?? []).map((k) => IMG[k]);
    return [...new Set([IMG[p.image], ...shots])].slice(0, 4).map((url, sortOrder) => ({
      productId,
      url,
      sortOrder,
    }));
  });
  for (const chunkRows of chunk(variantValues, INSERT_CHUNK_SIZE))
    await db.insert(schema.productVariant).values(chunkRows);
  for (const chunkRows of chunk(imageValues, INSERT_CHUNK_SIZE))
    await db.insert(schema.productImage).values(chunkRows);

  const productSlugs = PRODUCTS.map((p) => p.slug);
  await db.delete(schema.product).where(
    sql`${schema.product.slug} not in (${sql.join(
      productSlugs.map((s) => sql`${s}`),
      sql`, `,
    )})`,
  );
  const catSlugs = CATEGORIES.map((c) => c.slug);
  await db.delete(schema.category).where(
    sql`${schema.category.slug} not in (${sql.join(
      catSlugs.map((s) => sql`${s}`),
      sql`, `,
    )})`,
  );

  const catCount = await db.select({ n: sql<number>`count(*)` }).from(schema.category);
  const prodCount = await db.select({ n: sql<number>`count(*)` }).from(schema.product);
  const varCount = await db.select({ n: sql<number>`count(*)` }).from(schema.productVariant);
  console.log(
    `Seeded ${catCount[0].n} categories, ${prodCount[0].n} products, ${varCount[0].n} variants`,
  );
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
