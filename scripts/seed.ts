/// <reference types="node" />
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/server/db/schema";

const db = drizzle(createClient({ url: process.env.DATABASE_URL ?? "file:local.db" }), { schema });

const CATEGORIES = [
  { slug: "sidr", name: "عسل السدر" },
  { slug: "clover", name: "عسل البرسيم" },
  { slug: "citrus", name: "عسل الموالح" },
  { slug: "wild", name: "أعشاب جبلية وخلطات" },
];

const PRODUCTS: Array<{
  slug: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  featured: boolean;
}> = [
  {
    slug: "sidr-natural",
    name: "عسل سدر طبيعي",
    description:
      "عسل سدر نقي 100% من مناحل سيناء وسفوح سانت كاترين، قوام كثيف وطعم مميز وخصائص علاجية مشهورة.",
    price: 380_00,
    stock: 25,
    category: "sidr",
    image: "/images/honey/sidr.svg",
    featured: true,
  },
  {
    slug: "sidr-mountain",
    name: "عسل سدر جبلي فاخر",
    description: "إنتاج جبلي نادر بلون داكن ومذاق أعمق، يُعصر كمية محدودة من مرتفعات سيناء كل موسم.",
    price: 450_00,
    stock: 18,
    category: "sidr",
    image: "/images/honey/sidr.svg",
    featured: true,
  },
  {
    slug: "sidr-1kg",
    name: "عسل سدر سيناء 1 كجم",
    description: "عبوة عائلية سعة كيلو من أجود عسل السدر السيناوي لاستخدام يومي طويل.",
    price: 720_00,
    stock: 12,
    category: "sidr",
    image: "/images/honey/sidr.svg",
    featured: false,
  },
  {
    slug: "clover-blossom",
    name: "عسل البرسيم المصري",
    description:
      "عسل فاتح برائحة أزهار البرسيم المصرية الشهيرة، أخف أنواع العسل وأكثرها استخدامًا صباحًا.",
    price: 160_00,
    stock: 40,
    category: "clover",
    image: "/images/honey/clover.svg",
    featured: true,
  },
  {
    slug: "clover-cream",
    name: "عسل برسيم كريمي",
    description: "قوام كريمي ناعم يذوب على اللسان، مفضّل لدى الأطفال والعائلات.",
    price: 180_00,
    stock: 22,
    category: "clover",
    image: "/images/honey/cream.svg",
    featured: false,
  },
  {
    slug: "clover-1kg",
    name: "عسل البرسيم 1 كجم",
    description: "عبوة كيلو من عسل البرسيم الطازج من مناحل الدلتا وريف مصر.",
    price: 290_00,
    stock: 16,
    category: "clover",
    image: "/images/honey/clover.svg",
    featured: false,
  },
  {
    slug: "orange-blossom",
    name: "عسل زهر البرتقال",
    description: "عسل ذهبي برائحة زهر البرتقال والموالح من أراضي البحيرة والدلتا، مثالي للإفطار.",
    price: 240_00,
    stock: 30,
    category: "citrus",
    image: "/images/honey/citrus.svg",
    featured: true,
  },
  {
    slug: "citrus-mix",
    name: "عسل الموالح المشكل",
    description: "خليط عسل الليمون والبرتقال واليوسفي، لطيف على المعدة وعطر المنكه.",
    price: 220_00,
    stock: 20,
    category: "citrus",
    image: "/images/honey/citrus.svg",
    featured: false,
  },
  {
    slug: "orange-1kg",
    name: "عسل زهر البرتقال 1 كجم",
    description: "عبوة كيلو من عسل الموالح الطازج بقطف موسمي من بساتين الدلتا.",
    price: 430_00,
    stock: 14,
    category: "citrus",
    image: "/images/honey/citrus.svg",
    featured: false,
  },
  {
    slug: "royal-jelly",
    name: "عسل بالغذاء الملكي",
    description: "عسل برسيم مصري مدعّم بالغذاء الملكي الطازج، منشط طبيعي للطاقة والمناعة.",
    price: 340_00,
    stock: 18,
    category: "citrus",
    image: "/images/honey/royal.svg",
    featured: true,
  },
  {
    slug: "sinai-wildflower",
    name: "عسل أعشاب سيناء",
    description: "عسل جبلي متعدد الأزهار والأعشاب البرية من جنوب سيناء، مذاق غني ولون كهرماني.",
    price: 280_00,
    stock: 25,
    category: "wild",
    image: "/images/honey/wild.svg",
    featured: true,
  },
  {
    slug: "cotton-honey",
    name: "عسل القطن الصعيدي",
    description: "عسل فاتح ناعم من حقول القطن في صعيد مصر، خفيف ولطيف على الأطفال.",
    price: 200_00,
    stock: 20,
    category: "wild",
    image: "/images/honey/cotton.svg",
    featured: false,
  },
  {
    slug: "honeycomb",
    name: "قرص الشمع الصافي",
    description: "قرص شمع كامل بأقراصه الطبيعية يُقطَع ويُؤكل طازجًا من الفرازات مباشرة.",
    price: 150_00,
    stock: 16,
    category: "wild",
    image: "/images/honey/comb.svg",
    featured: false,
  },
  {
    slug: "gift-trio",
    name: "بوكس عسل مصري ثلاثي",
    description: "ثلاث عينات مختارة (سدر سيناء، زهر البرتقال، البرسيم) في علبة هدية أنيقة.",
    price: 640_00,
    stock: 15,
    category: "wild",
    image: "/images/honey/gift.svg",
    featured: true,
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
    image: p.image,
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
  // Wipe prior orders (children first) so repeated e2e/seed runs start clean and
  // deterministic — the suite accumulates an order on every checkout.
  await db.delete(schema.orderItem);
  await db.delete(schema.order);

  // Prune catalog rows that no longer exist in the current seed (renamed or
  // removed products/categories would otherwise linger forever).
  const slugs = PRODUCTS.map((p) => p.slug);
  await db.delete(schema.product).where(
    sql`${schema.product.slug} not in (${sql.join(
      slugs.map((s) => sql`${s}`),
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
