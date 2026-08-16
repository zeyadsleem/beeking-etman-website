/// <reference types="node" />
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/server/db/schema";

const db = drizzle(createClient({ url: process.env.DATABASE_URL ?? "file:local.db" }), { schema });

const IMG = {
  glassLight:
    "https://images.unsplash.com/photo-1605880980331-20a711b27338?q=80&w=1200&auto=format&fit=crop",
  glassPale:
    "https://images.unsplash.com/photo-1471943311424-646960669fbc?q=80&w=1200&auto=format&fit=crop",
  glassDark:
    "https://images.unsplash.com/photo-1694457331480-b709d8496b1a?q=80&w=1200&auto=format&fit=crop",
  blackseed:
    "https://images.unsplash.com/photo-1735011725740-72da19fb2baf?q=80&w=1200&auto=format&fit=crop",
  plasticJar:
    "https://images.unsplash.com/photo-1706111584150-4cd65fe071fb?q=80&w=1200&auto=format&fit=crop",
  squeezeBottle:
    "https://images.pexels.com/photos/8049836/pexels-photo-8049836.jpeg?w=1200&h=1200&fit=crop",
  combFrame:
    "https://images.unsplash.com/photo-1641822888635-97d60ecd9acd?q=80&w=1200&auto=format&fit=crop",
  combChunks:
    "https://images.unsplash.com/photo-1773957949199-bc3aa74850ea?q=80&w=1200&auto=format&fit=crop",
  nutsInHoney:
    "https://images.unsplash.com/photo-1780494092679-5978bd163184?q=80&w=1200&auto=format&fit=crop",
  nutsCan:
    "https://images.unsplash.com/photo-1701591363380-8c2f86d2b41c?q=80&w=1200&auto=format&fit=crop",
  hazelnut:
    "https://images.unsplash.com/photo-1626697556426-8a55a8af4999?q=80&w=1200&auto=format&fit=crop",
  pistachio:
    "https://images.unsplash.com/photo-1704079662049-d00890d21a69?q=80&w=1200&auto=format&fit=crop",
  almond:
    "https://images.unsplash.com/photo-1608797178974-15b35a64ede9?q=80&w=1200&auto=format&fit=crop",
  cashew:
    "https://images.unsplash.com/photo-1509912760195-4f6cfd8cce2c?q=80&w=1200&auto=format&fit=crop",
  mixedNuts:
    "https://images.unsplash.com/photo-1693812879904-b8161644ce5a?q=80&w=1200&auto=format&fit=crop",
  beePollen:
    "https://images.unsplash.com/photo-1750582467180-41558fbfea17?q=80&w=1200&auto=format&fit=crop",
  royalJelly:
    "https://images.unsplash.com/photo-1641964946680-0002fac59a11?q=80&w=1200&auto=format&fit=crop",
  propolis:
    "https://images.unsplash.com/photo-1570723989345-3a537f60a9c5?q=80&w=1200&auto=format&fit=crop",
  ginseng:
    "https://images.unsplash.com/photo-1773304189617-0e89faa81c6e?q=80&w=1200&auto=format&fit=crop",
  palmPollen:
    "https://images.unsplash.com/photo-1712913929442-820c65e17dc4?q=80&w=1200&auto=format&fit=crop",
  honeySpoons:
    "https://images.unsplash.com/photo-1641878067318-1d1f79a77785?q=80&w=1200&auto=format&fit=crop",
  dipper:
    "https://images.unsplash.com/photo-1573697610008-4c72b4e9508f?q=80&w=1200&auto=format&fit=crop",
};

const CATEGORIES = [
  { slug: "flowers", name: "عسل الزهور" },
  { slug: "sidr", name: "عسل السدر" },
  { slug: "blends", name: "خلطات وعسل مدعم" },
  { slug: "comb", name: "شمع العسل" },
  { slug: "bee-supplements", name: "مكملات النحل" },
  { slug: "nuts", name: "مكسرات" },
];

interface SeedVariant {
  name: string;
  price: number;
  stock: number;
  image: keyof typeof IMG;
}

interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  category: string;
  image: keyof typeof IMG;
  featured: boolean;
  variants: SeedVariant[];
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: "clover-honey-1kg-glass",
    name: "عسل برسيم 1 ك زجاج",
    description:
      "عسل البرسيم الفاتح من مناحل الدلتا في عبوة زجاجية أنيقة — الأخف والأكثر استخدامًا في مصر، مثالي للإفطار والتحلية اليومية.",
    category: "flowers",
    image: "glassLight",
    featured: true,
    variants: [{ name: "1 ك زجاج", price: 250_00, stock: 30, image: "glassLight" }],
  },
  {
    slug: "clover-honey-1kg-plastic",
    name: "عسل برسيم 1 ك بلاستيك",
    description:
      "نفس عسل البرسيم النقي بعبوة بلاستيكية عملية بسعر اقتصادي — خيار البيت الكبير والاستخدام اليومي.",
    category: "flowers",
    image: "plasticJar",
    featured: false,
    variants: [{ name: "1 ك بلاستيك", price: 220_00, stock: 30, image: "plasticJar" }],
  },
  {
    slug: "clover-honey-1kg-squeeze",
    name: "عسل برسيم 1 ك اسكويز",
    description:
      "عسل برسيم فاتح بزجاجة اسكويز عملية تسهّل السكب والتحلية بلا فوضى — مثالي للأطفال والمطبخ.",
    category: "flowers",
    image: "squeezeBottle",
    featured: false,
    variants: [{ name: "1 ك اسكويز", price: 230_00, stock: 25, image: "squeezeBottle" }],
  },
  {
    slug: "clover-honey-500g-glass",
    name: "عسل برسيم 500 زجاج",
    description: "نصف كيلو عسل برسيم فاتح بعبوة زجاج — الحجم المثالي للهدايا والمكاتب والسفر.",
    category: "flowers",
    image: "glassLight",
    featured: false,
    variants: [{ name: "500 جرام زجاج", price: 140_00, stock: 40, image: "glassLight" }],
  },
  {
    slug: "clover-honey-500g-plastic",
    name: "عسل برسيم 500 بلاستيك",
    description: "عسل برسيم نصف كيلو بعبوة بلاستيك اقتصادية — خفيف وعملي للاستخدام اليومي.",
    category: "flowers",
    image: "plasticJar",
    featured: false,
    variants: [{ name: "500 جرام بلاستيك", price: 120_00, stock: 50, image: "plasticJar" }],
  },
  {
    slug: "clover-honey-1kg-vib",
    name: "عسل برسيم 1ك Vib",
    description: "كيلو عسل برسيم كامل بعبوة Vib الزجاجية الشهيرة — خيار عائلي موثوق بسعر مميز.",
    category: "flowers",
    image: "glassPale",
    featured: false,
    variants: [{ name: "1 ك Vib", price: 225_00, stock: 25, image: "glassPale" }],
  },
  {
    slug: "clover-honey-half-vib",
    name: "عسل برسيم نص Vib",
    description: "نصف كيلو عسل برسيم بعبوة Vib — توازن مثالي بين الجودة والسعر للاستخدام الفردي.",
    category: "flowers",
    image: "glassPale",
    featured: false,
    variants: [{ name: "نص Vib", price: 125_00, stock: 35, image: "glassPale" }],
  },
  {
    slug: "citrus-honey-150g",
    name: "عسل موالح 150 جرام",
    description:
      "عسل الموالح الذهبي في عبوة صغيرة لتجربة النكهة أو لاصطحابه في السفر — من أزهار البرتقال والليمون.",
    category: "flowers",
    image: "glassLight",
    featured: false,
    variants: [{ name: "150 جرام", price: 60_00, stock: 45, image: "glassLight" }],
  },
  {
    slug: "citrus-honey-1kg",
    name: "عسل موالح 1 ك عادي",
    description:
      "كيلو عسل موالح ذهبي منعش من أزهار البرتقال والليمون واليوسفي — غني بفيتامين سي بنكهة حمضية مميزة.",
    category: "flowers",
    image: "glassLight",
    featured: true,
    variants: [{ name: "1 ك عادي", price: 240_00, stock: 25, image: "glassLight" }],
  },
  {
    slug: "citrus-honey-1kg-vib",
    name: "عسل موالح 1ك Vib",
    description: "كيلو عسل موالح منعش بعبوة Vib الزجاجية — نكهة الحمضيات المشرقة للعائلة.",
    category: "flowers",
    image: "glassPale",
    featured: false,
    variants: [{ name: "1 ك Vib", price: 230_00, stock: 20, image: "glassPale" }],
  },
  {
    slug: "citrus-honey-half-vib",
    name: "عسل موالح نص Vib",
    description: "نصف كيلو عسل الموالح بعبوة Vib — نكهة الحمضيات في حجم ذهبي مناسب.",
    category: "flowers",
    image: "glassPale",
    featured: false,
    variants: [{ name: "نص Vib", price: 130_00, stock: 30, image: "glassPale" }],
  },
  {
    slug: "marjoram-honey-500g",
    name: "عسل بردقوش 500 جرام",
    description:
      "عسل البردقوش الطبي الرفيع من زهر البردقوش — خفيف ولطيف، مفضل لتهدئة الأعصاب وصحة الجهاز التنفسي.",
    category: "flowers",
    image: "dipper",
    featured: false,
    variants: [{ name: "500 جرام", price: 180_00, stock: 22, image: "dipper" }],
  },
  {
    slug: "marjoram-honey-1kg-glass",
    name: "عسل بردقوش 1ك زجاج",
    description: "كيلو عسل بردقوش بعبوة زجاج فاخرة — هدية صحية راقية لمن تحب.",
    category: "flowers",
    image: "glassPale",
    featured: false,
    variants: [{ name: "1 ك زجاج", price: 330_00, stock: 16, image: "glassPale" }],
  },
  {
    slug: "sidr-honey-1kg",
    name: "عسل سدر مصري 1 ك",
    description:
      "عسل السدر المصري الفاخر من جنوب الصعيد وسيناء، داكن القوام غني بالمعادن، ينافس السدر اليمني — درة العسل المصري.",
    category: "sidr",
    image: "glassDark",
    featured: true,
    variants: [{ name: "1 ك", price: 700_00, stock: 12, image: "glassDark" }],
  },
  {
    slug: "sidr-honey-500g",
    name: "عسل سدر 500 جرام",
    description: "نصف كيلو من درة العسل المصري — سدر داكن غني بالمعادن، تجربة ملكية بحجم مناسب.",
    category: "sidr",
    image: "glassDark",
    featured: false,
    variants: [{ name: "500 جرام", price: 380_00, stock: 18, image: "glassDark" }],
  },
  {
    slug: "blackseed-honey-half",
    name: "عسل حبة البركة نص",
    description: "عسل برسيم مدعّم بحبة البركة المطحونة — منشط مناعة شتوي في حجم نص كيلو.",
    category: "blends",
    image: "blackseed",
    featured: false,
    variants: [{ name: "نص", price: 210_00, stock: 24, image: "blackseed" }],
  },
  {
    slug: "blackseed-honey-1kg",
    name: "عسل حبة البركة 1 ك",
    description:
      "عسل مدعّم بحبة البركة المطحونة — منشط طبيعي للمناعة والأكثر طلبًا في الشتاء، بحجم كيلو.",
    category: "blends",
    image: "blackseed",
    featured: true,
    variants: [{ name: "1 ك", price: 380_00, stock: 18, image: "blackseed" }],
  },
  {
    slug: "six-blend-1kg-plastic",
    name: "عسل خلطة سداسي بلاستيك",
    description:
      "الخلطة السداسية المتكاملة من أعشاب وعسل مختار لتقوية المناعة والطاقة اليومية — بعبوة بلاستيك اقتصادية.",
    category: "blends",
    image: "plasticJar",
    featured: false,
    variants: [{ name: "1 ك بلاستيك", price: 260_00, stock: 20, image: "plasticJar" }],
  },
  {
    slug: "nuts-in-honey-370",
    name: "مكسرات بالعسل 370",
    description: "لوز وفستق وكاجو وبندق مغموسة في عسل برسيم صافٍ — سناك صحي وملكي بعبوة 370 جرام.",
    category: "blends",
    image: "nutsInHoney",
    featured: false,
    variants: [{ name: "370 جرام", price: 260_00, stock: 20, image: "nutsInHoney" }],
  },
  {
    slug: "nuts-in-honey-370-round",
    name: "مكسرات بالعسل 370 دائري",
    description: "مكسرات فاخرة بالعسل في عبوة دائرية أنيقة — مظهر جميل ومذاق ملكي.",
    category: "blends",
    image: "nutsInHoney",
    featured: false,
    variants: [{ name: "370 جرام دائري", price: 260_00, stock: 18, image: "nutsInHoney" }],
  },
  {
    slug: "nuts-in-honey-oval",
    name: "مكسرات بالعسل بيضاوي",
    description: "تشكيلة مكسرات بالعسل بعبوة بيضاوية فاخرة — مظهر راقٍ ومذاق أرقى.",
    category: "blends",
    image: "nutsInHoney",
    featured: false,
    variants: [{ name: "بيضاوي", price: 280_00, stock: 16, image: "nutsInHoney" }],
  },
  {
    slug: "nuts-in-honey-can-400g",
    name: "مكسرات بالعسل كان 400 جرام",
    description: "مكسرات فاخرة بالعسل في علبة كان معدنية تحفظ الجودة والنكهة — للعزائم والهدايا.",
    category: "blends",
    image: "nutsCan",
    featured: false,
    variants: [{ name: "كان 400 جرام", price: 330_00, stock: 14, image: "nutsCan" }],
  },
  {
    slug: "nuts-in-honey-800g",
    name: "مكسرات بالعسل 800 جرام",
    description: "حجم العائلة — مكسرات مشكّلة فاخرة مغموسة في عسل برسيم بوزن 800 جرام.",
    category: "blends",
    image: "nutsInHoney",
    featured: true,
    variants: [{ name: "800 جرام", price: 560_00, stock: 10, image: "nutsInHoney" }],
  },
  {
    slug: "nuts-in-honey-extra-1kg",
    name: "مكسرات بالعسل اكستر 1 ك",
    description: "أفخم تشكيلة مكسرات بالعسل بوزن كيلو كامل — باقة الهدايا الملكية بامتياز.",
    category: "blends",
    image: "nutsInHoney",
    featured: false,
    variants: [{ name: "اكستر 1 ك", price: 690_00, stock: 8, image: "nutsInHoney" }],
  },
  {
    slug: "comb-frame-clover",
    name: "برواز شمع بالعسل برسيم",
    description: "برواز الشمع الكامل من بيت النحل — قطعة حقيقية من الخلية تؤكل كما هي.",
    category: "comb",
    image: "combFrame",
    featured: true,
    variants: [{ name: "برسيم", price: 70_00, stock: 15, image: "combFrame" }],
  },
  {
    slug: "comb-frame-citrus",
    name: "برواز شمع بالعسل موالح",
    description: "برواز شمع كامل بعسل الموالح الطازج — طبيعي 100% من قلب الخلية.",
    category: "comb",
    image: "combFrame",
    featured: false,
    variants: [{ name: "موالح", price: 75_00, stock: 15, image: "combFrame" }],
  },
  {
    slug: "comb-honey-250g-clover",
    name: "شمع بالعسل 250 برسيم",
    description: "قطع شمع طبيعية بعسل البرسيم الطازج من الفرازات — تُقطع وتُؤكل كما هي.",
    category: "comb",
    image: "combChunks",
    featured: false,
    variants: [{ name: "250 جرام برسيم", price: 90_00, stock: 25, image: "combChunks" }],
  },
  {
    slug: "comb-honey-250g-citrus",
    name: "شمع بالعسل 250 جرام موالح",
    description: "قطع شمع بعسل الموالح الطازج — وجبة الخلية الطبيعية بحجم 250 جرام.",
    category: "comb",
    image: "combChunks",
    featured: false,
    variants: [{ name: "250 جرام موالح", price: 95_00, stock: 25, image: "combChunks" }],
  },
  {
    slug: "comb-honey-500g-clover",
    name: "شمع بالعسل 500 برسيم",
    description: "نصف كيلو شمع طبيعي بالعسل البرسيم — من الفرازات مباشرة إلى بيتك.",
    category: "comb",
    image: "combChunks",
    featured: false,
    variants: [{ name: "500 جرام برسيم", price: 165_00, stock: 18, image: "combChunks" }],
  },
  {
    slug: "comb-honey-500g-citrus",
    name: "شمع بالعسل 500 جرام موالح",
    description: "نصف كيلو شمع بالعسل الموالح — يُقطع ويُؤكل كما هو طازجًا من الخلية.",
    category: "comb",
    image: "combChunks",
    featured: false,
    variants: [{ name: "500 جرام موالح", price: 175_00, stock: 18, image: "combChunks" }],
  },
  {
    slug: "royal-jelly-5g",
    name: "غذاء ملكات 5 جم بلدي",
    description: "غذاء ملكات نقي طازج من الخلية — أقوى منشطات الطاقة والمناعة الطبيعية في مصر.",
    category: "bee-supplements",
    image: "royalJelly",
    featured: true,
    variants: [{ name: "5 جم", price: 85_00, stock: 30, image: "royalJelly" }],
  },
  {
    slug: "propolis-box",
    name: "علبة بروبليس",
    description: "خلاصة البروبليس (العكبر) الطبيعي المعزّز للمناعة ومضاد الالتهابات.",
    category: "bee-supplements",
    image: "propolis",
    featured: true,
    variants: [{ name: "علبة", price: 160_00, stock: 20, image: "propolis" }],
  },
  {
    slug: "ginseng-box",
    name: "علبة جينسنج",
    description: "خلطة الجينسنج بالعسل لنشاط الجسم وزيادة التركيز — قوة الطبيعة في علبة.",
    category: "bee-supplements",
    image: "ginseng",
    featured: false,
    variants: [{ name: "علبة", price: 130_00, stock: 20, image: "ginseng" }],
  },
  {
    slug: "palm-pollen-box",
    name: "علبة طلع نخل",
    description: "طلع النخل الطبيعي بالعسل — مكمل الطاقة المصري التقليدي الخالد.",
    category: "bee-supplements",
    image: "palmPollen",
    featured: false,
    variants: [{ name: "علبة", price: 110_00, stock: 20, image: "palmPollen" }],
  },
  {
    slug: "bee-pollen-box",
    name: "علبة حبوب لقاح",
    description: "حبوب لقاح النحل الخام — بروتين طبيعي غني بالفيتامينات والمعادن.",
    category: "bee-supplements",
    image: "beePollen",
    featured: false,
    variants: [{ name: "علبة", price: 95_00, stock: 20, image: "beePollen" }],
  },
  {
    slug: "bee-pollen-125g",
    name: "علبة حبوب لقاح 125",
    description: "عبوة 125 جرام من حبوب اللقاح الخام — دعم مناعة منتظم بمقدار كافٍ.",
    category: "bee-supplements",
    image: "beePollen",
    featured: false,
    variants: [{ name: "125 جرام", price: 145_00, stock: 15, image: "beePollen" }],
  },
  {
    slug: "honey-spoons-box",
    name: "علبة ملاعق عسل",
    description: "ملاعق عسل سفر جاهزة لأي مكان — عملية وأنيقة لأوقاتك خارج البيت.",
    category: "bee-supplements",
    image: "honeySpoons",
    featured: false,
    variants: [{ name: "علبة", price: 90_00, stock: 25, image: "honeySpoons" }],
  },
  {
    slug: "hazelnut-100g",
    name: "بندق 100 جرام",
    description: "بندق فاخر محمّص — سناك صحي بمذاق غني وقوام مقرمش.",
    category: "nuts",
    image: "hazelnut",
    featured: false,
    variants: [{ name: "100 جرام", price: 110_00, stock: 25, image: "hazelnut" }],
  },
  {
    slug: "pistachio-100g",
    name: "فستق 100 جرام",
    description: "فستق حلبي مقشّر فاخر — خيار الرقّي الأول في السناكات الصحية.",
    category: "nuts",
    image: "pistachio",
    featured: false,
    variants: [{ name: "100 جرام", price: 145_00, stock: 25, image: "pistachio" }],
  },
  {
    slug: "almond-100g",
    name: "لوز 100 جرام",
    description: "لوز طبيعي محمّص غني بالدهون الصحية — سناك يمنحك الطاقة والتركيز.",
    category: "nuts",
    image: "almond",
    featured: false,
    variants: [{ name: "100 جرام", price: 125_00, stock: 25, image: "almond" }],
  },
  {
    slug: "cashew-100g",
    name: "كاجو 100 جرام",
    description: "كاجو فاخر محمّص بقوام كريمي ناعم — سناك راقٍ بلا مقارنة.",
    category: "nuts",
    image: "cashew",
    featured: false,
    variants: [{ name: "100 جرام", price: 135_00, stock: 25, image: "cashew" }],
  },
  {
    slug: "mixed-nuts-100g",
    name: "مكسرات مشكّلة 100 جرام",
    description: "تشكيلة مكسرات فاخرة للقهوة والمناسبات — نكهات متنوعة في عبوة واحدة.",
    category: "nuts",
    image: "mixedNuts",
    featured: false,
    variants: [{ name: "100 جرام", price: 85_00, stock: 30, image: "mixedNuts" }],
  },
  {
    slug: "nuts-extra-can-500g",
    name: "مكسرات اكسترا 500 كان",
    description: "باقة المكسرات الفاخرة بتشكيلة الموسم في علبة كان — للهدايا والعزائم.",
    category: "nuts",
    image: "nutsCan",
    featured: false,
    variants: [{ name: "500 كان", price: 320_00, stock: 12, image: "nutsCan" }],
  },
];

async function upsertCategory(slug: string, name: string): Promise<string> {
  const existing = await db
    .select()
    .from(schema.category)
    .where(eq(schema.category.slug, slug))
    .get();
  if (existing) {
    await db.update(schema.category).set({ name }).where(eq(schema.category.slug, slug));
    return existing.id;
  }
  const rows = await db
    .insert(schema.category)
    .values({ name, slug })
    .returning({ id: schema.category.id });
  return rows[0].id;
}

async function upsertProduct(p: SeedProduct, categoryId: string): Promise<string> {
  const values = {
    name: p.name,
    description: p.description,
    price: 0,
    stock: 0,
    image: IMG[p.image],
    categoryId,
    featured: p.featured ? 1 : 0,
  };
  const existing = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.slug, p.slug))
    .get();
  if (existing) {
    await db.update(schema.product).set(values).where(eq(schema.product.slug, p.slug));
    return existing.id;
  }
  const rows = await db
    .insert(schema.product)
    .values({ ...values, slug: p.slug })
    .returning({ id: schema.product.id });
  return rows[0].id;
}

async function upsertVariant(productId: string, v: SeedVariant, sortOrder: number): Promise<void> {
  const values = {
    productId,
    name: v.name,
    price: v.price,
    stock: v.stock,
    image: IMG[v.image],
    sortOrder,
  };
  const existing = await db
    .select()
    .from(schema.productVariant)
    .where(
      sql`${schema.productVariant.productId} = ${productId} AND ${schema.productVariant.name} = ${v.name}`,
    )
    .get();
  if (existing) {
    await db
      .update(schema.productVariant)
      .set(values)
      .where(eq(schema.productVariant.id, existing.id));
  } else {
    await db.insert(schema.productVariant).values(values);
  }
}

async function seed(): Promise<void> {
  await db.delete(schema.orderItem);
  await db.delete(schema.order);
  await db.delete(schema.productVariant);

  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) categoryIds.set(c.slug, await upsertCategory(c.slug, c.name));
  for (const p of PRODUCTS) {
    const productId = await upsertProduct(p, categoryIds.get(p.category)!);
    for (let i = 0; i < p.variants.length; i += 1) {
      await upsertVariant(productId, p.variants[i], i);
    }
  }

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
