/// <reference types="node" />
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/server/db/schema";

const db = drizzle(createClient({ url: process.env.DATABASE_URL ?? "file:local.db" }), { schema });

const IMG = {
  jarLight:
    "https://images.unsplash.com/photo-1587049352851-8d4e89133924?q=80&w=1200&auto=format&fit=crop",
  jarGold:
    "https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=1200&auto=format&fit=crop",
  jarDark:
    "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?q=80&w=1200&auto=format&fit=crop",
  comb: "https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=1200&auto=format&fit=crop",
  frame:
    "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=1200&auto=format&fit=crop",
  dipper:
    "https://images.unsplash.com/photo-1581092335397-9583eb92d232?q=80&w=1200&auto=format&fit=crop",
  honeycombDish:
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=1200&auto=format&fit=crop",
  nuts: "https://images.unsplash.com/photo-1654747781241-d820d035c32f?q=80&w=1200&auto=format&fit=crop",
  pollen:
    "https://images.unsplash.com/photo-1577095870693-360d002ad341?q=80&w=1200&auto=format&fit=crop",
  royal:
    "https://images.unsplash.com/photo-1718146921295-700b969e7c78?q=80&w=1200&auto=format&fit=crop",
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
    slug: "clover",
    name: "عسل البرسيم المصري",
    description:
      "عسل البرسيم الفاتح من مناحل الدلتا، الأخف والأكثر استخدامًا في مصر، مثالي للإفطار والتحلية اليومية.",
    category: "flowers",
    image: "jarLight",
    featured: true,
    variants: [
      { name: "500 جرام بلاستيك", price: 120_00, stock: 50, image: "jarLight" },
      { name: "500 جرام زجاج", price: 140_00, stock: 40, image: "jarGold" },
      { name: "نص Vib", price: 125_00, stock: 35, image: "jarGold" },
      { name: "1 ك بلاستيك", price: 220_00, stock: 30, image: "jarLight" },
      { name: "1 ك اسكويز", price: 230_00, stock: 25, image: "jarGold" },
      { name: "1 ك Vib", price: 225_00, stock: 25, image: "jarGold" },
      { name: "1 ك زجاج", price: 250_00, stock: 30, image: "jarGold" },
    ],
  },
  {
    slug: "citrus",
    name: "عسل الموالح",
    description:
      "عسل ذهبي من أزهار البرتقال والليمون واليوسفي في وجه بحري، غني بفيتامين سي ومنعش للنكهة.",
    category: "flowers",
    image: "jarGold",
    featured: true,
    variants: [
      { name: "150 جرام", price: 60_00, stock: 45, image: "jarLight" },
      { name: "نص Vib", price: 130_00, stock: 30, image: "jarGold" },
      { name: "1 ك عادي", price: 240_00, stock: 25, image: "jarGold" },
      { name: "1 ك Vib", price: 230_00, stock: 20, image: "jarGold" },
    ],
  },
  {
    slug: "marjoram",
    name: "عسل البردقوش",
    description:
      "عسل طبي رفيع من زهر البردقوش، خفيف ولطيف، مفضل لتهدئة الأعصاب وصحة الجهاز التنفسي.",
    category: "flowers",
    image: "dipper",
    featured: false,
    variants: [
      { name: "500 جرام", price: 180_00, stock: 22, image: "dipper" },
      { name: "1 ك زجاج", price: 330_00, stock: 16, image: "jarDark" },
    ],
  },
  {
    slug: "sidr-egyptian",
    name: "عسل سدر مصري",
    description:
      "عسل السدر المصري الفاخر من جنوب الصعيد وسيناء، داكن القوام غني بالمعادن، ينافس السدر اليمني.",
    category: "sidr",
    image: "jarDark",
    featured: true,
    variants: [
      { name: "500 جرام", price: 380_00, stock: 18, image: "jarDark" },
      { name: "1 ك", price: 700_00, stock: 12, image: "jarDark" },
    ],
  },
  {
    slug: "blackseed",
    name: "عسل حبة البركة",
    description: "عسل مدعّم بحبة البركة المطحونة، منشط طبيعي للمناعة والأكثر طلبًا في الشتاء.",
    category: "blends",
    image: "dipper",
    featured: false,
    variants: [
      { name: "نص", price: 210_00, stock: 24, image: "dipper" },
      { name: "1 ك", price: 380_00, stock: 18, image: "dipper" },
    ],
  },
  {
    slug: "six-blend",
    name: "عسل خلطة سداسي",
    description: "خلطة سداسية متكاملة من أعشاب وعسل مختار لتقوية المناعة والطاقة اليومية.",
    category: "blends",
    image: "honeycombDish",
    featured: false,
    variants: [{ name: "بلاستيك 1 ك", price: 260_00, stock: 20, image: "honeycombDish" }],
  },
  {
    slug: "nuts-honey",
    name: "عسل المكسرات",
    description: "مكسرات فاخرة (لوز، فستق، كاجو، بندق) مغموسة في عسل برسيم صافٍ — سناك صحي وملكي.",
    category: "blends",
    image: "nuts",
    featured: true,
    variants: [
      { name: "370", price: 260_00, stock: 20, image: "nuts" },
      { name: "370 دائري", price: 260_00, stock: 18, image: "nuts" },
      { name: "بيضاوي", price: 280_00, stock: 16, image: "nuts" },
      { name: "كان 400 جرام", price: 330_00, stock: 14, image: "nuts" },
      { name: "800 جرام", price: 560_00, stock: 10, image: "nuts" },
      { name: "اكستر 1 ك", price: 690_00, stock: 8, image: "nuts" },
    ],
  },
  {
    slug: "comb-honey",
    name: "شمع بالعسل",
    description: "قطع شمع طبيعية بالعسل تُؤكل كما هي، طازجة من الفرازات.",
    category: "comb",
    image: "comb",
    featured: true,
    variants: [
      { name: "250 جرام برسيم", price: 90_00, stock: 25, image: "comb" },
      { name: "250 جرام موالح", price: 95_00, stock: 25, image: "comb" },
      { name: "500 جرام برسيم", price: 165_00, stock: 18, image: "comb" },
      { name: "500 جرام موالح", price: 175_00, stock: 18, image: "comb" },
    ],
  },
  {
    slug: "comb-frame",
    name: "برواز شمع بالعسل",
    description: "برواز الشمع الكامل ببيت النحل، قطعة حقيقية من الخلية.",
    category: "comb",
    image: "frame",
    featured: false,
    variants: [
      { name: "برسيم", price: 70_00, stock: 15, image: "frame" },
      { name: "موالح", price: 75_00, stock: 15, image: "frame" },
    ],
  },
  {
    slug: "royal-jelly",
    name: "غذاء ملكات بلدي",
    description: "غذاء ملكات نقي طازج، أقوى منشطات الطاقة والمناعة الطبيعية.",
    category: "bee-supplements",
    image: "royal",
    featured: true,
    variants: [{ name: "5 جم", price: 85_00, stock: 30, image: "royal" }],
  },
  {
    slug: "propolis",
    name: "بروبليس (عكبر)",
    description: "خلاصة البروبليس الطبيعي المعزّز للمناعة ومضاد الالتهابات.",
    category: "bee-supplements",
    image: "royal",
    featured: false,
    variants: [{ name: "علبة", price: 160_00, stock: 20, image: "royal" }],
  },
  {
    slug: "ginseng",
    name: "جينسنج",
    description: "خلطة الجينسنج بالعسل لنشاط الجسم وزيادة التركيز.",
    category: "bee-supplements",
    image: "dipper",
    featured: false,
    variants: [{ name: "علبة", price: 130_00, stock: 20, image: "dipper" }],
  },
  {
    slug: "palm-pollen",
    name: "طلع النخل",
    description: "طلع النخل الطبيعي بالعسل، مكمل طاقة تقليدي مصري.",
    category: "bee-supplements",
    image: "pollen",
    featured: false,
    variants: [{ name: "علبة", price: 110_00, stock: 20, image: "pollen" }],
  },
  {
    slug: "bee-pollen",
    name: "حبوب اللقاح",
    description: "حبوب لقاح النحل الخام، بروتين طبيعي غني بالفيتامينات.",
    category: "bee-supplements",
    image: "pollen",
    featured: false,
    variants: [
      { name: "علبة", price: 95_00, stock: 20, image: "pollen" },
      { name: "125 جرام", price: 145_00, stock: 15, image: "pollen" },
    ],
  },
  {
    slug: "honey-spoons",
    name: "علبة ملاعق العسل",
    description: "ملاعق عسل سفر جاهزة لأي مكان، عملية وأنيقة.",
    category: "bee-supplements",
    image: "honeycombDish",
    featured: false,
    variants: [{ name: "علبة", price: 90_00, stock: 25, image: "honeycombDish" }],
  },
  {
    slug: "hazelnut",
    name: "بندق محمّص",
    description: "بندق فاخر محمّص، سناك صحي بمذاق غني.",
    category: "nuts",
    image: "nuts",
    featured: false,
    variants: [{ name: "100 جرام", price: 110_00, stock: 25, image: "nuts" }],
  },
  {
    slug: "pistachio",
    name: "فستق حلبي",
    description: "فستق حلبي مقشّر فاخر، خيار الرقّي الأول.",
    category: "nuts",
    image: "nuts",
    featured: false,
    variants: [{ name: "100 جرام", price: 145_00, stock: 25, image: "nuts" }],
  },
  {
    slug: "almond",
    name: "لوز",
    description: "لوز طبيعي محمّص، غني بالدهون الصحية.",
    category: "nuts",
    image: "nuts",
    featured: false,
    variants: [{ name: "100 جرام", price: 125_00, stock: 25, image: "nuts" }],
  },
  {
    slug: "cashew",
    name: "كاجو",
    description: "كاجو فاخر محمّص بقوام كريمي.",
    category: "nuts",
    image: "nuts",
    featured: false,
    variants: [{ name: "100 جرام", price: 135_00, stock: 25, image: "nuts" }],
  },
  {
    slug: "mixed-nuts",
    name: "مكسرات مشكّلة",
    description: "تشكيلة مكسرات فاخرة للمناسبات والقهوة.",
    category: "nuts",
    image: "nuts",
    featured: false,
    variants: [{ name: "100 جرام", price: 85_00, stock: 30, image: "nuts" }],
  },
  {
    slug: "nuts-extra",
    name: "مكسرات اكسترا",
    description: "باقة المكسرات الفاخرة بتشكيلة الموسم، للهدايا والعزائم.",
    category: "nuts",
    image: "nuts",
    featured: false,
    variants: [{ name: "500 كان", price: 320_00, stock: 12, image: "nuts" }],
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
