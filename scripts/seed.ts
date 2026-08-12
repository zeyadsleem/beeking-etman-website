/// <reference types="node" />
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/server/db/schema";

const db = drizzle(createClient({ url: process.env.DATABASE_URL ?? "file:local.db" }), { schema });

const HONEY_IMAGES = [
  "https://images.unsplash.com/photo-1587049352846-4a222e784d38?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1587049352851-8d4e89133924?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=1200&auto=format&fit=crop",
];

const CATEGORIES = [
  { slug: "sidr", name: "عسل السدر" },
  { slug: "orange-blossom", name: "عسل الأزهار" },
  { slug: "wildflower", name: "عسل بري متنوع" },
  { slug: "gift-sets", name: "سلال وهدايا" },
];

const PRODUCTS: Array<{
  slug: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: number;
  featured: boolean;
}> = [
  {
    slug: "sidr-natural",
    name: "عسل سدر طبيعي",
    description: "عسل سدر نقي 100% من مناحل سيناء، قوام كثيف وطعم مميز وخصائص علاجية مشهورة.",
    price: 380_00,
    stock: 25,
    category: "sidr",
    image: 0,
    featured: true,
  },
  {
    slug: "sidr-mountain",
    name: "عسل سدر جبلي",
    description: "إنتاج جبلي نادر بمذاق أعمق ولون داكن، يُعصر كمية محدودة كل موسم.",
    price: 420_00,
    stock: 18,
    category: "sidr",
    image: 1,
    featured: true,
  },
  {
    slug: "sidr-1kg",
    name: "عسل سدر 1 كجم",
    description: "عبوة عائلية سعة كيلو من أجود عسل السدر لاستخدام يومي طويل.",
    price: 640_00,
    stock: 12,
    category: "sidr",
    image: 0,
    featured: false,
  },
  {
    slug: "orange-blossom",
    name: "عسل زهر البرتقال",
    description: "عسل فاتح برائحة زهر البرتقال من ريف مصر، مثالي للإفطار.",
    price: 260_00,
    stock: 30,
    category: "orange-blossom",
    image: 1,
    featured: true,
  },
  {
    slug: "orange-cream",
    name: "عسل برتقال كريمي",
    description: "قوام كريمي ناعم يذوب على اللسان، مفضّل لدى الأطفال.",
    price: 280_00,
    stock: 22,
    category: "orange-blossom",
    image: 0,
    featured: false,
  },
  {
    slug: "orange-1kg",
    name: "عسل زهر البرتقال 1 كجم",
    description: "عبوة كيلو من عسل البرتقال الطازج بعطر أزهار النرجس.",
    price: 460_00,
    stock: 14,
    category: "orange-blossom",
    image: 1,
    featured: false,
  },
  {
    slug: "wild-flower",
    name: "عسل أزهار برية",
    description: "مراعي متعددة الأزهار تعطي مذاقًا غنيًا متوازنًا من مناحل الدلتا.",
    price: 240_00,
    stock: 35,
    category: "wildflower",
    image: 2,
    featured: true,
  },
  {
    slug: "mountain-honey",
    name: "عسل جبلي",
    description: "عسل من المرتفعات الطبيعية، غني بالعناصر ومضادات الأكسدة.",
    price: 300_00,
    stock: 20,
    category: "wildflower",
    image: 1,
    featured: false,
  },
  {
    slug: "manuka",
    name: "عسل مانوكا",
    description: "صنف مستورد فاخر بتركيز عالٍ من المركبات النشطة.",
    price: 950_00,
    stock: 8,
    category: "wildflower",
    image: 0,
    featured: false,
  },
  {
    slug: "honeycomb",
    name: "قرص العسل الطبيعي",
    description: "قرص شمع كامل بشكله الأصلي، يُقطَع ويُؤكل طازجًا من الفرازات.",
    price: 180_00,
    stock: 16,
    category: "wildflower",
    image: 2,
    featured: false,
  },
  {
    slug: "pine-honey",
    name: "عسل الصنوبر",
    description: "لون غامق وطعم حاد مميز، خيار مثالي مع الشاي والأعشاب.",
    price: 330_00,
    stock: 10,
    category: "wildflower",
    image: 1,
    featured: false,
  },
  {
    slug: "gift-trio",
    name: "بوكس عسل ثلاثي",
    description: "ثلاث عينات مختارة (سدر، برتقال، أزهار برية) في علبة هدية أنيقة.",
    price: 750_00,
    stock: 15,
    category: "gift-sets",
    image: 0,
    featured: true,
  },
  {
    slug: "gift-wedding",
    name: "سلة هدايا مناسبات",
    description: "سلة فاخرة لعروسين أو مولود جديد، تشمل عسلًا وشموعًا مشكيلة.",
    price: 1100_00,
    stock: 6,
    category: "gift-sets",
    image: 2,
    featured: false,
  },
  {
    slug: "gift-with-comb",
    name: "علبة عسل بأقراص الشمع",
    description: "عسل سدر مع قطع شمع حقيقية في صندوق خشبي هدية.",
    price: 450_00,
    stock: 9,
    category: "gift-sets",
    image: 1,
    featured: false,
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

async function upsertProduct(p: (typeof PRODUCTS)[number], categoryId: string): Promise<void> {
  const values = {
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    image: HONEY_IMAGES[p.image % HONEY_IMAGES.length],
    categoryId,
    featured: p.featured ? 1 : 0,
  };
  const existing = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.slug, p.slug))
    .get();
  if (existing) {
    await db
      .update(schema.product)
      .set({ ...values, slug: p.slug })
      .where(eq(schema.product.slug, p.slug));
  } else {
    await db.insert(schema.product).values({ ...values, slug: p.slug });
  }
}

async function seed(): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) categoryIds.set(c.slug, await upsertCategory(c.slug, c.name));
  for (const p of PRODUCTS) await upsertProduct(p, categoryIds.get(p.category)!);
  const catCount = await db.select({ n: sql<number>`count(*)` }).from(schema.category);
  const prodCount = await db.select({ n: sql<number>`count(*)` }).from(schema.product);
  console.log(`Seeded ${catCount[0].n} categories, ${prodCount[0].n} products`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
