# Honey Storefront (متجر العسل) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a beautiful Arabic RTL e-commerce MVP for an Egyptian honey store with catalog, cart, guest checkout (mock payment), and order confirmation.

**Architecture:** Single full-stack SvelteKit app (SSR). Drizzle ORM + libSQL (SQLite file DB). better-auth for optional accounts (guest checkout is primary). Cart is client state mirrored to an httpOnly HMAC-signed cookie; the server recomputes all prices from the DB at checkout. Mock payment step (validated, never charged).

**Tech Stack:** SvelteKit 2, Svelte 5 (runes, forced), Tailwind CSS 4, Drizzle ORM + libSQL, better-auth 1.6, zod, Vitest (node + browser-playwright projects), Playwright e2e, @fontsource-variable/cairo, Node adapter. Toolchain: vite-plus `vp`, pnpm.

## Global Constraints

Apply to every task unless a task says otherwise.

- UI is fully **Arabic**, RTL (`lang="ar" dir="rtl"`). Use Tailwind logical utilities (`ms-*/me-*`, `ps-*/pe-*`, `text-start/end`) — never `ml/mr`, `pl/pr`, `text-left/right`.
- Prices stored as **integer EGP × 100** (qirsh). Display only through `formatEGP` in `src/lib/currency.ts` (`Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" })`).
- Guest checkout is the primary path; better-auth optional. Logged-in orders get `userId`.
- Mock payment only: a card form (number/expiry/cvc) that is validated but never charged; success page labels payment as simulated.
- Shipping: `SHIPPING_COST = 60_00` qirsh, free when subtotal ≥ `FREE_SHIPPING_THRESHOLD = 600_00` qirsh — defined once in `src/lib/cart.ts`.
- Server never trusts client totals. Checkout re-reads prices from DB, clamps quantities to stock, decrements stock in a transaction.
- Seed: 4 categories + 14 products, idempotent (upsert by slug).
- TypeScript strict; no `any`; explicit return types on shared functions.
- Svelte 5 runes mode (`$state`, `$props`); match scaffold conventions.
- Vitest `requireAssertions: true` — every test must have assertions.
- Conventional commits; lint-staged runs `vp check --fix` on commit automatically.
- Server-only code under `src/lib/server/`; shared pure modules in `src/lib/`.

---

## File Structure

**New lib modules**

- `src/lib/currency.ts` — `formatEGP(qirsh: number): string`
- `src/lib/cart.ts` — types, `computeTotals`, `addItem`, `adjustQuantity`, `removeItem`, `linesToItems`, shipping constants
- `src/lib/cart-store.svelte.ts` — client runes store (localStorage + `/api/cart` cookie sync)
- `src/lib/server/cart-cookie.ts` — `sanitizeCartLines`, `signCartCookie`, `readCartFromString`, `verifyCartCookie`, `readCartCookie`, `setCartCookie`, `clearCartCookie`
- `src/lib/server/checkout-schema.ts` — zod `checkoutSchema`, `formatZodErrors`, `CheckoutInput`
- `src/lib/server/store.ts` — `getCategories`, `getFeaturedProducts`, `listProducts`, `getProductBySlug`, `getRelatedProducts`
- `src/lib/server/orders.ts` — `createOrder`, `generateOrderNumber`

**New routes**

- `src/routes/api/cart/+server.ts` — POST sync cart cookie
- `src/routes/+layout.server.ts`, `src/routes/+layout.svelte`
- `src/routes/+page.server.ts`, `src/routes/+page.svelte` — home
- `src/routes/products/+page.server.ts`, `src/routes/products/+page.svelte`
- `src/routes/products/[slug]/+page.server.ts`, `src/routes/products/[slug]/+page.svelte`
- `src/routes/cart/+page.svelte`
- `src/routes/checkout/+page.server.ts`, `src/routes/checkout/+page.svelte`
- `src/routes/checkout/success/[id]/+page.server.ts`, `src/routes/checkout/success/[id]/+page.svelte`
- `src/routes/login/+page.server.ts`, `src/routes/login/+page.svelte`
- `src/routes/register/+page.server.ts`, `src/routes/register/+page.svelte`
- `src/routes/account/orders/+page.server.ts`, `src/routes/account/orders/+page.svelte`

**New components** (`src/lib/components/`)

- `Header.svelte`, `Footer.svelte`, `CartDrawer.svelte`, `ProductCard.svelte`, `CategoryCard.svelte`, `Price.svelte`, `QuantityPicker.svelte`

**Config & scripts**

- Modify `src/lib/server/db/schema.ts`, `src/app.html`, `src/routes/layout.css`, `package.json`, `playwright.config.ts`, `.gitignore`
- Generate `src/lib/server/db/auth.schema.ts` (`pnpm auth:schema`) and `drizzle/` migrations (`pnpm db:generate`)
- Create `scripts/seed.ts`

**Tests**

- `src/lib/currency.spec.ts`, `src/lib/cart.spec.ts`, `src/lib/server/cart-cookie.spec.ts`, `src/lib/server/orders.spec.ts`
- `src/lib/components/ProductCard.svelte.spec.ts`
- `src/routes/store.e2e.ts`

---

## Task 1: Schema, auth tables, seed, and DB scripts

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Generate: `src/lib/server/db/auth.schema.ts`
- Create: `scripts/seed.ts`
- Modify: `package.json` (add `db:seed`, `db:reset`), `.gitignore`
- Generate: `drizzle/` migrations

**Interfaces:**

- Produces: drizzle tables `category`, `product`, `order`, `orderItem` (names `store_category`, `store_product`, `store_order`, `store_order_item`) plus better-auth `user`, `session`, `account`, `verification`. Later tasks use `import * as schema from "$lib/server/db/schema"`.
- Produces: `scripts/seed.ts` exits 0 and prints `Seeded <n> categories, <m> products`.

- [ ] **Step 1: Verify .gitignore covers the DB**

Read `/home/zeyad/projects/beeking-etman-website/.gitignore`. Add if missing:

```gitignore
local.db
local.db-shm
local.db-wal
```

- [ ] **Step 2: Generate the better-auth schema**

Run: `pnpm auth:schema`
Expected: `src/lib/server/db/auth.schema.ts` rewritten (no longer `export {}`), exporting `sqliteTable` definitions (likely `user`, `session`, `account`, `verification`). Read it; fix only import paths if needed, never columns.

- [ ] **Step 3: Extend `src/lib/server/db/schema.ts`**

Append (keep `export * from "./auth.schema";` last):

```ts
export const category = sqliteTable("store_category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const product = sqliteTable("store_product", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").notNull().default(0),
  image: text("image").notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => category.id),
  featured: integer("featured").notNull().default(0),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const order = sqliteTable("store_order", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  number: text("number").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("paid"),
  userId: text("user_id"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const orderItem = sqliteTable("store_order_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id")
    .notNull()
    .references(() => order.id),
  productId: text("product_id")
    .notNull()
    .references(() => product.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
});
```

Keep the existing `task` table as-is.

- [ ] **Step 4: Create `scripts/seed.ts`**

```ts
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
```

- [ ] **Step 5: Update scripts and install tsx**

package.json scripts (keep existing):

```json
"db:seed": "tsx scripts/seed.ts",
"db:reset": "npm run db:migrate && npm run db:seed"
```

Run: `pnpm add -D tsx`

- [ ] **Step 6: Generate migrations, apply, seed**

Run:

```
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Expected: `drizzle/` SQL + meta with all tables; migration applies to `file:local.db`; seed prints `Seeded 4 categories, 14 products`. If drizzle-kit can't read `DATABASE_URL`, run `set -a; . ./.env; set +a;` before the commands.

- [ ] **Step 7: Verify seed idempotency**

Run: `pnpm db:seed`
Expected: again `Seeded 4 categories, 14 products`, no duplicates.

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/db scripts package.json pnpm-lock.yaml drizzle .gitignore
git commit -m "feat(store): add store schema, auth tables, and seed script"
```

---

## Task 2: Shared pure helpers — currency, cart, checkout schema

**Files:**

- Create: `src/lib/currency.ts`, `src/lib/cart.ts`, `src/lib/server/checkout-schema.ts`
- Test: `src/lib/currency.spec.ts`, `src/lib/cart.spec.ts`
- Modify: `package.json` (add `zod`)

**Interfaces:**

- Produces: `formatEGP(amountQirsh: number): string`
- Produces: `CartLine`, `CartItem extends CartLine { name, slug, image, price, stock }`, `CartTotals { itemCount, subtotal, shipping, total }`, `SHIPPING_COST = 60_00`, `FREE_SHIPPING_THRESHOLD = 600_00`, `computeTotals`, `addItem`, `adjustQuantity`, `removeItem`, `linesToItems`
- Produces: `checkoutSchema`, `CheckoutInput`, `formatZodErrors(error: z.ZodError): Record<string, string>` (used in Task 9)

- [ ] **Step 1: Install zod**

Run: `pnpm add zod`

- [ ] **Step 2: Write the failing tests**

`src/lib/currency.spec.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { formatEGP } from "./currency";

describe("formatEGP", () => {
  it("formats whole pounds in Arabic digits with EGP symbol", () => {
    expect(formatEGP(26000)).toMatch(/٢٦٠/);
    expect(formatEGP(26000)).toContain("ج.م.");
  });
  it("includes qirsh decimals", () => {
    const out = formatEGP(26450);
    expect(out).toMatch(/٢٦٤/);
    expect(out).toContain("٥٠");
  });
  it("handles zero", () => {
    expect(formatEGP(0)).toContain("٠");
  });
  it("guards invalid input", () => {
    expect(formatEGP(-1)).toBe("—");
  });
});
```

`src/lib/cart.spec.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import {
  addItem,
  adjustQuantity,
  computeTotals,
  FREE_SHIPPING_THRESHOLD,
  linesToItems,
  removeItem,
  SHIPPING_COST,
} from "./cart";
import type { CartItem } from "./cart";

const product = {
  productId: "p1",
  name: "عسل سدر",
  slug: "sidr-natural",
  image: "https://example.com/honey.jpg",
  price: 380_00,
  stock: 3,
};

function item(p = product, quantity = 1): CartItem {
  return { ...p, quantity };
}

describe("addItem", () => {
  it("adds a new line", () => {
    expect(addItem([], product, 2)).toEqual([{ ...product, quantity: 2 }]);
  });
  it("merges into an existing line", () => {
    expect(addItem([item(product, 1)], product, 2)[0].quantity).toBe(3);
  });
  it("clamps to stock", () => {
    expect(addItem([item(product, 2)], product, 5)[0].quantity).toBe(3);
  });
  it("never adds a zero-stock product", () => {
    expect(addItem([], { ...product, stock: 0 }, 1)).toEqual([]);
  });
});

describe("adjustQuantity", () => {
  it("increments", () => {
    expect(adjustQuantity([item(product, 1)], product.productId, 1)[0].quantity).toBe(2);
  });
  it("removes the line when it hits zero", () => {
    expect(adjustQuantity([item(product, 1)], product.productId, -1)).toEqual([]);
  });
  it("clamps to stock", () => {
    expect(adjustQuantity([item(product, 3)], product.productId, 1)[0].quantity).toBe(3);
  });
});

describe("removeItem", () => {
  it("removes only the matching product", () => {
    const other = { ...product, productId: "p2" };
    expect(
      removeItem([item(product), item(other)], product.productId).map((i) => i.productId),
    ).toEqual(["p2"]);
  });
});

describe("computeTotals", () => {
  it("returns a zero cart", () => {
    expect(computeTotals([])).toEqual({ itemCount: 0, subtotal: 0, shipping: 0, total: 0 });
  });
  it("applies shipping below the threshold", () => {
    const totals = computeTotals([item({ ...product, price: 300_00 }, 1)]);
    expect(totals.shipping).toBe(SHIPPING_COST);
    expect(totals.total).toBe(300_00 + SHIPPING_COST);
  });
  it("free shipping at and above the threshold", () => {
    expect(computeTotals([item({ ...product, price: FREE_SHIPPING_THRESHOLD }, 1)]).shipping).toBe(
      0,
    );
    expect(
      computeTotals([item({ ...product, price: FREE_SHIPPING_THRESHOLD + 1 }, 1)]).shipping,
    ).toBe(0);
  });
  it("multiplies quantity into subtotal", () => {
    expect(computeTotals([item({ ...product, price: 100_00 }, 3)]).subtotal).toBe(300_00);
  });
});

describe("linesToItems", () => {
  it("maps and clamps quantity to stock", () => {
    expect(linesToItems([{ productId: "p1", quantity: 9 }], [product])).toEqual([
      { ...product, quantity: 3 },
    ]);
  });
  it("drops unknown products", () => {
    expect(linesToItems([{ productId: "nope", quantity: 1 }], [product])).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `pnpm test:unit -- --run src/lib/cart.spec.ts src/lib/currency.spec.ts`
Expected: FAIL — missing `./cart`, `./currency`.

- [ ] **Step 4: Implement `src/lib/currency.ts`**

```ts
const egpFormatter = new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" });

export function formatEGP(amountQirsh: number): string {
  if (!Number.isInteger(amountQirsh) || amountQirsh < 0) return "—";
  return egpFormatter.format(amountQirsh / 100);
}
```

- [ ] **Step 5: Implement `src/lib/cart.ts`**

```ts
export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CartItem extends CartLine {
  name: string;
  slug: string;
  image: string;
  price: number;
  stock: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
}

export const SHIPPING_COST = 60_00;
export const FREE_SHIPPING_THRESHOLD = 600_00;

export function computeTotals(items: CartItem[]): CartTotals {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  return { itemCount, subtotal, shipping, total: subtotal + shipping };
}

export function addItem(
  items: CartItem[],
  product: Omit<CartItem, "quantity">,
  quantity: number,
): CartItem[] {
  if (quantity <= 0 || product.stock <= 0) return items;
  const existing = items.find((i) => i.productId === product.productId);
  const merged = existing ? existing.quantity + quantity : quantity;
  const next = Math.min(merged, product.stock);
  if (!existing) return [...items, { ...product, quantity: next }];
  return items.map((i) => (i.productId === product.productId ? { ...i, quantity: next } : i));
}

export function adjustQuantity(items: CartItem[], productId: string, delta: number): CartItem[] {
  return items
    .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
    .filter((i) => i.quantity > 0)
    .map((i) => ({ ...i, quantity: Math.min(i.quantity, i.stock) }));
}

export function removeItem(items: CartItem[], productId: string): CartItem[] {
  return items.filter((i) => i.productId !== productId);
}

export function linesToItems(lines: CartLine[], catalog: Omit<CartItem, "quantity">[]): CartItem[] {
  return lines.flatMap((line) => {
    const product = catalog.find((p) => p.productId === line.productId);
    if (!product) return [];
    return [{ ...product, quantity: Math.min(line.quantity, product.stock) }];
  });
}
```

- [ ] **Step 6: Implement `src/lib/server/checkout-schema.ts`**

```ts
import { z } from "zod";

export const checkoutSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح"),
  name: z.string().trim().min(2, "الاسم قصير جدًا"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?20|0)?1[0-9]{9}$/, "رقم هاتف مصري غير صالح"),
  city: z.string().trim().min(2, "أدخل اسم المدينة"),
  address: z.string().trim().min(5, "أدخل عنوانًا تفصيليًا"),
  cardNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{13,16}$/, "رقم البطاقة غير صالح"),
  cardExpiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, "التاريخ بصيغة MM/YY"),
  cardCvc: z
    .string()
    .trim()
    .regex(/^[0-9]{3,4}$/, "رمز الأمان غير صالح"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test:unit -- --run src/lib/cart.spec.ts src/lib/currency.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib package.json pnpm-lock.yaml
git commit -m "feat(store): add currency and cart helpers with unit tests"
```

---

## Task 3: Signed cart cookie + API endpoint

**Files:**

- Create: `src/lib/server/cart-cookie.ts`
- Create: `src/routes/api/cart/+server.ts`
- Test: `src/lib/server/cart-cookie.spec.ts`

**Interfaces:**

- Consumes: `CartLine` from `src/lib/cart.ts`
- Produces: `sanitizeCartLines(input: unknown): CartLine[]`, `signCartCookie(secret, lines): string`, `verifyCartCookie(raw): { ok }`, `readCartFromString(raw, secret): CartLine[]`, `readCartCookie(cookies, secret): CartLine[]`, `setCartCookie(cookies, secret, lines)`, `clearCartCookie(cookies)`
- The `/api/cart` POST endpoint is consumed by the client store (Task 5); `readCartCookie`/`clearCartCookie` by Task 9.

- [ ] **Step 1: Install cookie**

Run: `pnpm add cookie`

- [ ] **Step 2: Write the failing test `src/lib/server/cart-cookie.spec.ts`**

```ts
import { describe, expect, it } from "vite-plus/test";
import { parse, serialize } from "cookie";
import { readCartFromString, signCartCookie, verifyCartCookie } from "./cart-cookie";

const SECRET = "test-secret-for-cookie-signing";

function headerFor(lines: Array<{ productId: string; quantity: number }>): string {
  return parse(serialize("honey_cart", signCartCookie(SECRET, lines))).honey_cart ?? "";
}

describe("cart-cookie", () => {
  it("round-trips valid lines", () => {
    expect(readCartFromString(headerFor([{ productId: "p1", quantity: 2 }]), SECRET)).toEqual([
      { productId: "p1", quantity: 2 },
    ]);
  });
  it("rejects a tampered payload", () => {
    const [payload] = headerFor([{ productId: "p1", quantity: 2 }]).split(".");
    expect(readCartFromString(`${payload}.Zm9v`, SECRET)).toEqual([]);
  });
  it("rejects a mismatched secret", () => {
    expect(
      readCartFromString(
        signCartCookie(SECRET, [{ productId: "p1", quantity: 1 }]),
        "other-secret",
      ),
    ).toEqual([]);
  });
  it("sanitizes out malformed entries", () => {
    expect(signCartCookie(SECRET, [{ productId: "", quantity: 0 }])).toContain("[]");
  });
  it("drops junk on read", () => {
    expect(readCartFromString("garbage", SECRET)).toEqual([]);
  });
  it("verify only checks format", () => {
    expect(verifyCartCookie("a.b").ok).toBe(true);
    expect(verifyCartCookie("no-dot").ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run test and confirm it fails**

Run: `pnpm test:unit -- --run src/lib/server/cart-cookie.spec.ts`
Expected: FAIL — missing `./cart-cookie`.

- [ ] **Step 4: Implement `src/lib/server/cart-cookie.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Cookies } from "@sveltejs/kit";
import type { CartLine } from "$lib/cart";

export const CART_COOKIE_NAME = "honey_cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function splitPayload(raw: string): { body: string; sig: string } {
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return { body: "", sig: "" };
  return { body: raw.slice(0, dot), sig: raw.slice(dot + 1) };
}

export function sanitizeCartLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { productId, quantity } = entry as Record<string, unknown>;
    if (typeof productId !== "string" || productId.length === 0) return [];
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return [];
    return [{ productId, quantity: Math.floor(quantity) }];
  });
}

export function signCartCookie(secret: string, lines: CartLine[]): string {
  const body = JSON.stringify(sanitizeCartLines(lines));
  return `${body}.${sign(secret, body)}`;
}

export function verifyCartCookie(raw: string): { ok: boolean } {
  const { body, sig } = splitPayload(raw);
  return { ok: body.length > 0 && sig.length > 0 };
}

export function readCartFromString(raw: string, secret: string): CartLine[] {
  const { body, sig } = splitPayload(raw);
  if (!body || !sig) return [];
  const expected = sign(secret, body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return [];
  try {
    return sanitizeCartLines(JSON.parse(body));
  } catch {
    return [];
  }
}

export function readCartCookie(cookies: Cookies, secret: string): CartLine[] {
  const raw = cookies.get(CART_COOKIE_NAME);
  if (!raw) return [];
  return readCartFromString(raw, secret);
}

export function setCartCookie(cookies: Cookies, secret: string, lines: CartLine[]): void {
  cookies.set(CART_COOKIE_NAME, signCartCookie(secret, lines), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearCartCookie(cookies: Cookies): void {
  cookies.delete(CART_COOKIE_NAME, { path: "/" });
}
```

- [ ] **Step 5: Create `src/routes/api/cart/+server.ts`**

```ts
import { json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { sanitizeCartLines, setCartCookie } from "$lib/server/cart-cookie";

export const POST: RequestHandler = async ({ request, cookies }) => {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const items = (body as { items?: unknown } | null)?.items;
  const secret = env.BETTER_AUTH_SECRET || env.ORIGIN || "dev-secret";
  setCartCookie(cookies, secret, sanitizeCartLines(items));
  return json({ ok: true });
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test:unit -- --run src/lib/server/cart-cookie.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/cart-cookie.ts src/lib/server/cart-cookie.spec.ts src/routes/api/cart package.json pnpm-lock.yaml
git commit -m "feat(store): add signed cart cookie and sync endpoint"
```

---

## Task 4: Store queries + order service

**Files:**

- Create: `src/lib/server/store.ts`, `src/lib/server/orders.ts`
- Test: `src/lib/server/orders.spec.ts`

**Interfaces:**

- Consumes: drizzle tables (Task 1); `computeTotals`, `linesToItems`, `CartLine` (Task 2)
- Produces: `ProductSummary`, `SortOrder`, `ProductFilters`, `listProducts`, `getCategories`, `getFeaturedProducts`, `getProductBySlug`, `getRelatedProducts`, `Customer`, `CreateOrderResult`, `createOrder`, `generateOrderNumber`
- Every query function takes the DB as its first param for testability.

- [ ] **Step 1: Write the failing test `src/lib/server/orders.spec.ts`**

```ts
import { afterAll, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { createOrder } from "./orders";
import type { Customer } from "./orders";

const DB_FILE = "orders-test.db";

async function buildDb() {
  const db = drizzle(createClient({ url: `file:${DB_FILE}` }), { schema });
  db.run(`
    CREATE TABLE IF NOT EXISTS store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE
    )`);
  db.run(`
    CREATE TABLE IF NOT EXISTS store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL, category_id TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
  db.run(`
    CREATE TABLE IF NOT EXISTS store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid', user_id TEXT, created_at INTEGER NOT NULL
    )`);
  db.run(`
    CREATE TABLE IF NOT EXISTS store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      product_name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )`);
  const inserted = await db
    .insert(schema.category)
    .values({ name: "عسل", slug: "sidr" })
    .returning({ id: schema.category.id });
  return { db, catId: inserted[0].id };
}

const customer: Customer = {
  email: "a@example.com",
  name: "أحمد",
  phone: "01012345678",
  address: "شارع 9",
  city: "القاهرة",
};

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("createOrder", () => {
  it("creates an order and decrements stock", async () => {
    const { db, catId } = await buildDb();
    const p = (
      await db
        .insert(schema.product)
        .values({
          name: "عسل سدر",
          slug: "sidr",
          description: "د",
          price: 380_00,
          stock: 3,
          image: "https://example.com/h.jpg",
          categoryId: catId,
          featured: 0,
          createdAt: Date.now(),
        })
        .returning()
    )[0];

    const result = await createOrder(db, [{ productId: p.id, quantity: 2 }], customer, undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(380_00 * 2 + 60_00);
    expect(result.orderNumber).toMatch(/^HNY-\d{6}$/);

    const order = await db
      .select()
      .from(schema.order)
      .where(eq(schema.order.id, result.orderId))
      .get();
    expect(order?.number).toBe(result.orderNumber);
    const stock = await db.select().from(schema.product).where(eq(schema.product.id, p.id)).get();
    expect(stock?.stock).toBe(1);
    const items = await db
      .select()
      .from(schema.orderItem)
      .where(eq(schema.orderItem.orderId, result.orderId));
    expect(items).toEqual([
      expect.objectContaining({ productName: "عسل سدر", quantity: 2, unitPrice: 380_00 }),
    ]);
  });

  it("rejects an empty cart", async () => {
    const { db } = await buildDb();
    const result = await createOrder(db, [], customer);
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-stock and writes nothing", async () => {
    const { db, catId } = await buildDb();
    const p = (
      await db
        .insert(schema.product)
        .values({
          name: "عسل برتقال",
          slug: "orange",
          description: "د",
          price: 260_00,
          stock: 1,
          image: "https://example.com/o.jpg",
          categoryId: catId,
          featured: 0,
          createdAt: Date.now(),
        })
        .returning()
    )[0];

    const result = await createOrder(db, [{ productId: p.id, quantity: 5 }], customer);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("عسل برتقال");
    expect(await db.select().from(schema.order)).toEqual([]);
    const stock = await db.select().from(schema.product).where(eq(schema.product.id, p.id)).get();
    expect(stock?.stock).toBe(1);
  });
});
```

- [ ] **Step 2: Run test and confirm it fails**

Run: `pnpm test:unit -- --run src/lib/server/orders.spec.ts`
Expected: FAIL — missing `./orders`.

- [ ] **Step 3: Implement `src/lib/server/store.ts`**

```ts
import { and, asc, desc, eq, like, ne, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  categoryId: string;
  featured: number;
  createdAt: number;
}

export type SortOrder = "newest" | "price-asc" | "price-desc";

export interface ProductFilters {
  query?: string;
  category?: string;
  sort?: SortOrder;
  limit?: number;
  offset?: number;
}

function toSummary(row: typeof schema.product.$inferSelect): ProductSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    stock: row.stock,
    image: row.image,
    categoryId: row.categoryId,
    featured: row.featured,
    createdAt: row.createdAt,
  };
}

export async function getCategories(
  db: LibSQLDatabase<typeof schema>,
): Promise<{ id: string; name: string; slug: string }[]> {
  return db.select().from(schema.category).orderBy(asc(schema.category.name));
}

export async function getFeaturedProducts(
  db: LibSQLDatabase<typeof schema>,
  limit = 8,
): Promise<ProductSummary[]> {
  const rows = await db
    .select()
    .from(schema.product)
    .where(eq(schema.product.featured, 1))
    .orderBy(desc(schema.product.createdAt))
    .limit(limit);
  return rows.map(toSummary);
}

export async function listProducts(
  db: LibSQLDatabase<typeof schema>,
  filters: ProductFilters = {},
): Promise<ProductSummary[]> {
  const conds = [];
  if (filters.query) {
    const q = `%${filters.query.trim()}%`;
    conds.push(or(like(schema.product.name, q), like(schema.product.description, q))!);
  }
  if (filters.category) {
    conds.push(eq(schema.product.categoryId, filters.category));
  }
  const where = conds.length ? and(...conds) : undefined;
  const orderBy =
    filters.sort === "price-asc"
      ? asc(schema.product.price)
      : filters.sort === "price-desc"
        ? desc(schema.product.price)
        : desc(schema.product.createdAt);
  const rows = await db
    .select()
    .from(schema.product)
    .where(where)
    .orderBy(orderBy)
    .limit(filters.limit ?? 1000)
    .offset(filters.offset ?? 0);
  return rows.map(toSummary);
}

export async function getProductBySlug(
  db: LibSQLDatabase<typeof schema>,
  slug: string,
): Promise<ProductSummary | null> {
  const row = await db.select().from(schema.product).where(eq(schema.product.slug, slug)).get();
  return row ? toSummary(row) : null;
}

export async function getRelatedProducts(
  db: LibSQLDatabase<typeof schema>,
  product: Pick<ProductSummary, "id" | "categoryId">,
  limit = 4,
): Promise<ProductSummary[]> {
  const rows = await db
    .select()
    .from(schema.product)
    .where(
      and(eq(schema.product.categoryId, product.categoryId), ne(schema.product.id, product.id)),
    )
    .orderBy(desc(schema.product.featured), desc(schema.product.createdAt))
    .limit(limit);
  return rows.map(toSummary);
}
```

- [ ] **Step 4: Implement `src/lib/server/orders.ts`**

```ts
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { computeTotals, linesToItems } from "$lib/cart";
import type { CartLine } from "$lib/cart";
import * as schema from "$lib/server/db/schema";

export interface Customer {
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string; total: number }
  | { ok: false; message: string; outOfStock: string[] };

export function generateOrderNumber(): string {
  return `HNY-${String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6)}`;
}

export async function createOrder(
  db: LibSQLDatabase<typeof schema>,
  lines: CartLine[],
  customer: Customer,
  userId?: string,
): Promise<CreateOrderResult> {
  if (lines.length === 0) return { ok: false, message: "السلة فارغة", outOfStock: [] };

  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await db.select().from(schema.product).where(inArray(schema.product.id, ids));
  const catalog = products.map((p) => ({
    productId: p.id,
    name: p.name,
    slug: p.slug,
    image: p.image,
    price: p.price,
    stock: p.stock,
  }));
  const items = linesToItems(lines, catalog);
  if (items.length === 0) return { ok: false, message: "لا توجد منتجات متاحة", outOfStock: [] };
  const outOfStock = items.filter((i) => i.stock < i.quantity).map((i) => i.name);
  if (outOfStock.length > 0) {
    return { ok: false, message: "نفدت الكمية لبعض المنتجات", outOfStock };
  }

  const totals = computeTotals(items);
  const orderNumber = generateOrderNumber();
  const orderId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      for (const item of items) {
        const updated = await tx
          .update(schema.product)
          .set({ stock: sql`${schema.product.stock} - ${item.quantity}` })
          .where(
            and(eq(schema.product.id, item.productId), gte(schema.product.stock, item.quantity)),
          )
          .returning({ id: schema.product.id });
        if (updated.length === 0) throw new Error(`OUT_OF_STOCK:${item.name}`);
      }
      await tx.insert(schema.order).values({
        id: orderId,
        number: orderNumber,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        total: totals.total,
        status: "paid",
        userId: userId ?? null,
        createdAt: Date.now(),
      });
      await tx.insert(schema.orderItem).values(
        items.map((i) => ({
          orderId,
          productId: i.productId,
          productName: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
        })),
      );
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OUT_OF_STOCK:")) {
      return {
        ok: false,
        message: "نفدت الكمية لبعض المنتجات",
        outOfStock: [error.message.slice("OUT_OF_STOCK:".length)],
      };
    }
    return { ok: false, message: "تعذر إتمام الطلب، حاول مرة أخرى", outOfStock: [] };
  }

  return { ok: true, orderId, orderNumber, total: totals.total };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:unit -- --run src/lib/server/orders.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/store.ts src/lib/server/orders.ts src/lib/server/orders.spec.ts
git commit -m "feat(store): add catalog queries and transactional order service"
```

---

## Task 5: Design system, components, cart store, RTL shell

**Files:**

- Modify: `src/app.html`, `src/routes/layout.css`
- Create: `src/lib/cart-store.svelte.ts`
- Create: `src/lib/components/{Header,Footer,CartDrawer,ProductCard,CategoryCard,Price,QuantityPicker}.svelte`
- Create: `src/routes/+layout.server.ts`, `src/routes/+layout.svelte`
- Test: `src/lib/components/ProductCard.svelte.spec.ts`
- Modify: `package.json` (add `@fontsource-variable/cairo`)

**Interfaces:**

- Consumes: `getCategories` (Task 4); `formatEGP`; cart helpers; `addItem`/`adjustQuantity`/`removeItem`/`computeTotals`
- Produces: cart store exports `state` (`{ items: CartItem[]; drawerOpen: boolean }`), `loadCart()`, `addToCart(product, quantity=1)`, `setQuantity(productId, qty)`, `removeFromCart(productId)`, `clearCart()`, `openDrawer()`, `closeDrawer()`, `getTotals()`, `cartCount()`. Plus the RTL shell and reusable components.

- [ ] **Step 1: Install the Cairo font**

Run: `pnpm add -D @fontsource-variable/cairo`

- [ ] **Step 2: RTL + Arabic in `src/app.html`**

Change `<html lang="en">` to `<html lang="ar" dir="rtl">`. Keep everything else.

- [ ] **Step 3: Theme in `src/routes/layout.css`**

```css
@import "tailwindcss";
@plugin '@tailwindcss/forms';
@plugin '@tailwindcss/typography';

@theme inline {
  --font-sans: "Cairo Variable", ui-sans-serif, system-ui, "Segoe UI", sans-serif;

  --color-honey-50: #fdf8ee;
  --color-honey-100: #f9eecd;
  --color-honey-200: #f3da99;
  --color-honey-300: #ecc05c;
  --color-honey-400: #e5a82e;
  --color-honey-500: #dc8f17;
  --color-honey-600: #c46f0f;
  --color-honey-700: #a35110;
  --color-honey-800: #854015;
  --color-honey-900: #6d3615;
  --color-honey-950: #401a08;

  --color-cream: #faf6ec;
  --color-clay: #9a5b2b;
}

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-cream font-sans text-stone-900;
}
```

- [ ] **Step 4: Implement `src/lib/cart-store.svelte.ts`**

```ts
import { browser } from "$app/environment";
import { addItem, adjustQuantity, computeTotals, removeItem } from "./cart";
import type { CartItem, CartTotals } from "./cart";

const STORAGE_KEY = "honey_cart_v1";

interface CartUiState {
  items: CartItem[];
  drawerOpen: boolean;
}

const state = $state<CartUiState>({ items: [], drawerOpen: false });

function persist(items: CartItem[]): void {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  void fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    }),
  }).catch(() => undefined);
}

export function loadCart(): void {
  if (!browser) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.items = JSON.parse(raw) as CartItem[];
  } catch {
    state.items = [];
  }
}

export function addToCart(product: Omit<CartItem, "quantity">, quantity = 1): void {
  state.items = addItem(state.items, product, quantity);
  persist(state.items);
}

export function setQuantity(productId: string, quantity: number): void {
  const current = state.items.find((i) => i.productId === productId);
  if (!current) return;
  state.items = adjustQuantity(state.items, productId, quantity - current.quantity);
  persist(state.items);
}

export function removeFromCart(productId: string): void {
  state.items = removeItem(state.items, productId);
  persist(state.items);
}

export function clearCart(): void {
  state.items = [];
  persist(state.items);
}

export function openDrawer(): void {
  state.drawerOpen = true;
}

export function closeDrawer(): void {
  state.drawerOpen = false;
}

export function getTotals(): CartTotals {
  return computeTotals(state.items);
}

export function cartCount(): number {
  return state.items.reduce((n, i) => n + i.quantity, 0);
}

export { state };
```

- [ ] **Step 5: Create `src/lib/components/QuantityPicker.svelte`**

```svelte
<script lang="ts">
  let { value, max, onChange }: { value: number; max: number; onChange: (next: number) => void } = $props();
</script>

<div class="inline-flex items-center rounded-full border border-stone-300 bg-white" role="group" aria-label="كمية المنتج">
  <button
    type="button"
    class="px-3 py-1.5 text-honey-700 transition disabled:opacity-30"
    disabled={value >= max}
    onclick={() => onChange(Math.min(value + 1, max))}
    aria-label="زيادة الكمية"
  >+</button>
  <span class="min-w-8 text-center font-semibold" data-testid="quantity">{value}</span>
  <button
    type="button"
    class="px-3 py-1.5 text-honey-700 transition disabled:opacity-30"
    disabled={value <= 1}
    onclick={() => onChange(Math.max(value - 1, 1))}
    aria-label="تقليل الكمية"
  >−</button>
</div>
```

- [ ] **Step 6: Create `src/lib/components/Price.svelte`**

```svelte
<script lang="ts">
  import { formatEGP } from "$lib/currency";

  let { amount, className = "" }: { amount: number; className?: string } = $props();
</script>

<span class={className}>{formatEGP(amount)}</span>
```

- [ ] **Step 7: Create `src/lib/components/CategoryCard.svelte`**

```svelte
<script lang="ts">
  let { name, slug }: { name: string; slug: string } = $props();
</script>

<a
  href={`/products?category=${slug}`}
  class="group relative flex h-32 items-end overflow-hidden rounded-2xl bg-gradient-to-br from-honey-200 to-honey-500 p-5 text-white shadow-sm transition hover:shadow-lg"
>
  <span class="text-lg font-bold drop-shadow-sm group-hover:underline">{name}</span>
</a>
```

- [ ] **Step 8: Create `src/lib/components/ProductCard.svelte`**

```svelte
<script lang="ts">
  import { addToCart } from "$lib/cart-store.svelte";
  import Price from "./Price.svelte";
  import type { ProductSummary } from "$lib/server/store";

  let { product }: { product: Pick<ProductSummary, "id" | "name" | "slug" | "price" | "stock" | "image"> } = $props();

  function handleAdd() {
    if (product.stock <= 0) return;
    addToCart({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: product.image,
      price: product.price,
      stock: product.stock,
    });
  }
</script>

<section class="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md">
  <a href={`/products/${product.slug}`} class="relative block aspect-[4/3] overflow-hidden bg-honey-100">
    <img
      src={product.image}
      alt={product.name}
      loading="lazy"
      class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
    />
    {#if product.stock === 0}
      <span class="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-stone-900/80 px-3 py-1 text-xs font-semibold text-white">نفدت الكمية</span>
    {:else if product.stock <= 5}
      <span class="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-honey-600/90 px-3 py-1 text-xs font-semibold text-white">كمية محدودة</span>
    {/if}
  </a>
  <div class="flex flex-1 flex-col gap-2 p-4">
    <h2 class="font-bold leading-snug">{product.name}</h2>
    <div class="mt-auto flex items-center justify-between gap-2">
      <Price amount={product.price} className="text-lg font-extrabold text-honey-800" />
      <button
        type="button"
        class="rounded-full bg-honey-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-honey-700 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={product.stock === 0}
        onclick={handleAdd}
      >
        {product.stock === 0 ? "غير متوفر" : "أضف للسلة"}
      </button>
    </div>
  </div>
</section>
```

- [ ] **Step 9: Create `src/lib/components/CartDrawer.svelte`**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { formatEGP } from "$lib/currency";
  import {
    closeDrawer,
    getTotals,
    loadCart,
    removeFromCart,
    setQuantity,
    state,
  } from "$lib/cart-store.svelte";
  import QuantityPicker from "./QuantityPicker.svelte";
  import Price from "./Price.svelte";

  onMount(() => {
    loadCart();
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    });
  });
</script>

{#if state.drawerOpen}
  <div class="fixed inset-0 z-40 bg-stone-900/50" role="presentation" onclick={closeDrawer}></div>
  <aside
    class="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col bg-white shadow-xl"
    role="dialog"
    aria-label="سلة التسوق"
    data-testid="cart-drawer"
  >
    <header class="flex items-center justify-between border-b border-stone-200 px-4 py-3">
      <h2 class="text-lg font-bold">سلة التسوق</h2>
      <button type="button" class="text-stone-500 hover:text-stone-800" onclick={closeDrawer} aria-label="إغلاق">✕</button>
    </header>

    {#if state.items.length === 0}
      <div class="flex flex-1 items-center justify-center p-8 text-center text-stone-500">
        سلتك فارغة — أضف بعض العسل!
      </div>
    {:else}
      <ul class="flex-1 space-y-4 overflow-y-auto p-4">
        {#each state.items as item (item.productId)}
          <li class="flex gap-3">
            <a href={`/products/${item.slug}`} class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-honey-100">
              <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
            </a>
            <div class="flex flex-1 flex-col gap-1">
              <a href={`/products/${item.slug}`} class="line-clamp-1 text-sm font-semibold">{item.name}</a>
              <QuantityPicker value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.productId, q)} />
              <button type="button" class="w-fit text-xs text-stone-400 hover:text-red-600" onclick={() => removeFromCart(item.productId)}>إزالة</button>
            </div>
            <Price amount={item.price * item.quantity} className="ms-auto self-start text-sm font-bold text-honey-800" />
          </li>
        {/each}
      </ul>
    {/if}

    {#if state.items.length > 0}
      <footer class="border-t border-stone-200 p-4">
        <div class="mb-1 flex justify-between text-sm text-stone-600">
          <span>المجموع الفرعي</span>
          <Price amount={getTotals().subtotal} />
        </div>
        <p class="mb-3 text-xs text-honey-700">
          {#if getTotals().shipping === 0}توصيل مجاني ✓{:else}الشحن {formatEGP(getTotals().shipping)}{/if}
        </p>
        <a href="/cart" class="block rounded-full bg-stone-900 py-2.5 text-center font-semibold text-white hover:bg-stone-800" onclick={closeDrawer}>عرض السلة</a>
        <a href="/checkout" class="mt-2 block rounded-full bg-honey-600 py-2.5 text-center font-semibold text-white hover:bg-honey-700" onclick={closeDrawer}>إتمام الشراء</a>
      </footer>
    {/if}
  </aside>
{/if}
```

- [ ] **Step 10: Create `src/lib/components/Footer.svelte`**

```svelte
<footer class="mt-16 border-t border-stone-200 bg-white">
  <div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="text-xl font-extrabold text-honey-800">بيت العسل</p>
      <p class="mt-1 text-sm text-stone-500">عسل طبيعي نقي 100% من مناحل مصر.</p>
    </div>
    <nav class="flex gap-6 text-sm text-stone-600" aria-label="روابط الموقع">
      <a href="/" class="hover:text-honey-700">الرئيسية</a>
      <a href="/products" class="hover:text-honey-700">المتجر</a>
      <a href="/cart" class="hover:text-honey-700">سلة التسوق</a>
    </nav>
    <p class="text-xs text-stone-400">منصة تجريبية — الدفع محاكى ولا تتم أي عمليات خصم فعلية.</p>
  </div>
</footer>
```

- [ ] **Step 11: Create `src/lib/components/Header.svelte`**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { cartCount, openDrawer } from "$lib/cart-store.svelte";

  let {
    categories,
    user,
  }: {
    categories: { name: string; slug: string }[];
    user?: { name?: string | null } | null;
  } = $props();

  let query = $state("");
  let count = $state(0);

  onMount(() => {
    count = cartCount();
  });
  $effect(() => {
    count = cartCount();
  });

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLFormElement;
    const input = target.querySelector<HTMLInputElement>('input[name="q"]');
    const q = (input?.value ?? "").trim();
    window.location.assign(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }
</script>

<header class="sticky top-0 z-30 border-b border-stone-200 bg-cream/90 backdrop-blur">
  <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
    <a href="/" class="text-2xl font-extrabold text-honey-800">بيت العسل</a>

    <nav class="hidden items-center gap-5 text-sm font-medium text-stone-700 lg:flex">
      <a href="/" class="hover:text-honey-700">الرئيسية</a>
      <a href="/products" class="hover:text-honey-700">المتجر</a>
      {#each categories as cat}
        <a href={`/products?category=${cat.slug}`} class="hover:text-honey-700">{cat.name}</a>
      {/each}
    </nav>

    <form class="ms-auto flex flex-1 max-w-xs items-center gap-2" role="search" onsubmit={submitSearch}>
      <input
        type="search"
        name="q"
        bind:value={query}
        placeholder="ابحث عن عسل…"
        class="w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-honey-500 focus:ring-honey-500"
      />
    </form>

    <div class="flex items-center gap-3">
      {#if user}
        <a href="/account/orders" class="hidden text-sm font-medium text-stone-700 hover:text-honey-700 sm:block">{user.name ?? "حسابي"}</a>
        <a href="/account/orders" class="rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:border-honey-500 sm:hidden">حسابي</a>
      {:else}
        <a href="/login" class="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium hover:border-honey-500 hover:text-honey-700">دخول</a>
      {/if}
      <button
        type="button"
        class="relative rounded-full bg-honey-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-honey-700"
        onclick={openDrawer}
        aria-label="فتح سلة التسوق"
      >
        السلة
        {#if count > 0}
          <span class="absolute -top-1.5 -end-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-stone-900 px-1 text-xs font-bold text-white" data-testid="cart-count">
            {count}
          </span>
        {/if}
      </button>
    </div>
  </div>
</header>
```

- [ ] **Step 12: Create `src/routes/+layout.server.ts`**

```ts
import { getCategories } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async (event) => {
  const categories = await getCategories(db);
  return {
    categories,
    user: event.locals.user ?? null,
  };
};
```

- [ ] **Step 13: Create `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
  import "@fontsource-variable/cairo";
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import CartDrawer from "$lib/components/CartDrawer.svelte";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>بيت العسل</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
  <Header categories={data.categories} user={data.user} />
  <main class="mx-auto w-full max-w-7xl flex-1 px-4">
    {@render children()}
  </main>
  <Footer />
  <CartDrawer />
</div>
```

- [ ] **Step 14: Write the failing component test `src/lib/components/ProductCard.svelte.spec.ts`**

```ts
import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import ProductCard from "./ProductCard.svelte";

describe("ProductCard", () => {
  it("renders product name and formatted price", async () => {
    render(ProductCard, {
      product: {
        id: "p1",
        name: "عسل سدر طبيعي",
        slug: "sidr-natural",
        price: 380_00,
        stock: 10,
        image: "https://example.com/h.jpg",
      },
    });
    await expect.element(page.getByText("عسل سدر طبيعي")).toBeInTheDocument();
    await expect.element(page.getByText(/ج\.م\./)).toBeInTheDocument();
  });

  it("shows out-of-stock state and disabled button", async () => {
    render(ProductCard, {
      product: {
        id: "p2",
        name: "عسل مانوكا",
        slug: "manuka",
        price: 950_00,
        stock: 0,
        image: "https://example.com/m.jpg",
      },
    });
    await expect.element(page.getByText("نفدت الكمية")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "غير متوفر" })).toBeDisabled();
  });
});
```

- [ ] **Step 15: Run the component test (should pass if card is implemented)**

Run: `pnpm test:unit -- --run src/lib/components/ProductCard.svelte.spec.ts`
Expected: PASS (component + fonts + css resolve). The browser project compiles the Svelte component; the store module is imported but only mutates state in the handler.

- [ ] **Step 16: Quick SSR smoke**

Run: `vp build`
Expected: build succeeds with no import errors (fonts, css, layout resolve).

- [ ] **Step 17: Commit**

```bash
git add src/app.html src/routes/layout.css src/routes/+layout.svelte src/routes/+layout.server.ts src/lib/cart-store.svelte.ts src/lib/components package.json pnpm-lock.yaml
git commit -m "feat(store): add rtl shell, design system, components, and cart store"
```

---

## Task 6: Home page

**Files:**

- Create: `src/routes/+page.server.ts`, `src/routes/+page.svelte`

**Interfaces:**

- Consumes: `getFeaturedProducts`, `getCategories` (Task 4); `CategoryCard`; `ProductCard` (Task 5)
- Produces: SSR home page backed by `data.categories`, `data.featured`.

- [ ] **Step 1: Implement `src/routes/+page.server.ts`**

```ts
import { getCategories, getFeaturedProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const [categories, featured] = await Promise.all([getCategories(db), getFeaturedProducts(db, 8)]);
  return { categories, featured };
};
```

- [ ] **Step 2: Implement `src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import ProductCard from "$lib/components/ProductCard.svelte";
  import CategoryCard from "$lib/components/CategoryCard.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>بيت العسل — متجر العسل الطبيعي</title></svelte:head>

<section class="mt-6 overflow-hidden rounded-3xl bg-gradient-to-l from-honey-600 via-honey-500 to-honey-400 px-8 py-14 text-white">
  <div class="max-w-2xl">
    <p class="mb-3 w-fit rounded-full bg-white/20 px-4 py-1 text-sm font-semibold">من مناحلنا مباشرة إلى بابك</p>
    <h1 class="text-4xl font-extrabold leading-tight sm:text-5xl">عسل طبيعي نقي 100%</h1>
    <p class="mt-4 text-lg text-honey-50">اختر من تشكيلة عسل السدر، زهر البرتقال، والأصناف البرية — بجودة مضمونة وتوصيل سريع لكل المحافظات.</p>
    <a href="/products" class="mt-6 inline-block rounded-full bg-white px-6 py-3 font-bold text-honey-800 transition hover:bg-honey-50">تسوق الآن</a>
  </div>
</section>

<section class="mt-12">
  <div class="flex items-end justify-between">
    <h2 class="text-2xl font-extrabold">اختير لك</h2>
    <a href="/products" class="text-sm font-semibold text-honey-700 hover:underline">كل المنتجات ←</a>
  </div>
  <div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {#each data.featured as product (product.id)}
      <ProductCard {product} />
    {/each}
  </div>
</section>

<section class="mt-12">
  <h2 class="text-2xl font-extrabold">تصفح حسب الفئات</h2>
  <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.categories as cat (cat.id)}
      <CategoryCard name={cat.name} slug={cat.slug} />
    {/each}
  </div>
</section>
```

- [ ] **Step 3: Verify SSR**

Run: `vp dev` and open `http://localhost:5173`, or `vp build`
Expected: home renders hero, featured grid (heading "اختير لك"), category tiles. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.server.ts src/routes/+page.svelte
git commit -m "feat(store): add home page with hero, featured and categories"
```

---

## Task 7: Catalog listing and product detail

**Files:**

- Create: `src/routes/products/+page.server.ts`, `src/routes/products/+page.svelte`
- Create: `src/routes/products/[slug]/+page.server.ts`, `src/routes/products/[slug]/+page.svelte`

**Interfaces:**

- Consumes: `listProducts`, `getCategories`, `getProductBySlug`, `getRelatedProducts` (Task 4); `ProductCard`, `Price`, `QuantityPicker` (Task 5); cart store `addToCart`
- Produces: catalog with `?q=&category=&sort=` filters; detail with add-to-cart.

- [ ] **Step 1: Implement `src/routes/products/+page.server.ts`**

```ts
import { error } from "@sveltejs/kit";
import { listProducts, getCategories } from "$lib/server/store";
import type { SortOrder } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

const SORTS = new Set(["newest", "price-asc", "price-desc"]);

export const load: PageServerLoad = async ({ url }) => {
  const rawQ = url.searchParams.get("q")?.toString().trim() ?? "";
  const rawCategory = url.searchParams.get("category")?.toString().trim() ?? "";
  const rawSort = url.searchParams.get("sort")?.toString() ?? "newest";
  const sort: SortOrder = SORTS.has(rawSort) ? (rawSort as SortOrder) : "newest";

  const [categories, products] = await Promise.all([
    getCategories(db),
    listProducts(db, { query: rawQ, category: rawCategory, sort }),
  ]);
  if (!categories.length) error(500, "المتجر غير متاح حاليًا");
  const activeCategory = categories.find((c) => c.slug === rawCategory);
  if (rawCategory && !activeCategory) error(404, "قسم غير موجود");

  return { categories, products, filters: { q: rawQ, category: rawCategory, sort } };
};
```

- [ ] **Step 2: Implement `src/routes/products/+page.svelte`**

```svelte
<script lang="ts">
  import ProductCard from "$lib/components/ProductCard.svelte";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function applyQuery(event: SubmitEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLFormElement;
    const q = (target.querySelector<HTMLInputElement>('input[name="q"]')?.value ?? "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (data.filters.category) params.set("category", data.filters.category);
    if (data.filters.sort && data.filters.sort !== "newest") params.set("sort", data.filters.sort);
    goto(`/products${params.size ? `?${params}` : ""}`);
  }

  function selectCategory(slug: string | null) {
    const params = new URLSearchParams();
    if (slug) params.set("category", slug);
    if (data.filters.q) params.set("q", data.filters.q);
    if (data.filters.sort && data.filters.sort !== "newest") params.set("sort", data.filters.sort);
    goto(`/products${params.size ? `?${params}` : ""}`);
  }

  function selectSort(sort: string) {
    const params = new URLSearchParams();
    if (data.filters.q) params.set("q", data.filters.q);
    if (data.filters.category) params.set("category", data.filters.category);
    if (sort !== "newest") params.set("sort", sort);
    goto(`/products${params.size ? `?${params}` : ""}`);
  }
</script>

<svelte:head><title>المتجر — بيت العسل</title></svelte:head>

<div class="mt-6">
  <nav class="mb-5 flex items-center gap-2 text-sm text-stone-500">
    <a href="/" class="hover:text-honey-700">الرئيسية</a>
    <span>/</span>
    <span class="text-stone-800">المتجر</span>
  </nav>

  <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <form class="flex max-w-sm flex-1 gap-2" role="search" onsubmit={applyQuery}>
      <input
        type="search"
        name="q"
        value={data.filters.q}
        placeholder="ابحث في المتجر…"
        class="w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-honey-500 focus:ring-honey-500"
      />
      <button type="submit" class="rounded-full bg-honey-600 px-5 py-2 text-sm font-semibold text-white">بحث</button>
    </form>
    <label class="text-sm text-stone-600">
      ترتيب
      <select
        class="ms-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-honey-500 focus:ring-honey-500"
        value={data.filters.sort}
        onchange={(e) => selectSort((e.currentTarget as HTMLSelectElement).value)}
      >
        <option value="newest">الأحدث</option>
        <option value="price-asc">الأرخص أولاً</option>
        <option value="price-desc">الأغلى أولاً</option>
      </select>
    </label>
  </div>

  <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="تصفية حسب الفئة">
    <button
      type="button"
      class="rounded-full border px-4 py-1.5 text-sm transition hover:border-honey-500"
      class:bg-honey-600
      class:text-white
      class:border-transparent={data.filters.category === ""}
      class:border-stone-300={data.filters.category !== ""}
      class:bg-white={data.filters.category !== ""}
      onclick={() => selectCategory(null)}
    >الكل</button>
    {#each data.categories as cat (cat.id)}
      <button
        type="button"
        class="rounded-full border px-4 py-1.5 text-sm transition hover:border-honey-500"
        class:bg-honey-600
        class:text-white
        class:border-transparent={data.filters.category === cat.slug}
        class:border-stone-300={data.filters.category !== cat.slug}
        class:bg-white={data.filters.category !== cat.slug}
        onclick={() => selectCategory(cat.slug)}
      >{cat.name}</button>
    {/each}
  </div>

  {#if data.products.length === 0}
    <div class="mt-16 text-center text-stone-500">لا توجد منتجات مطابقة لبحثك.</div>
  {:else}
    <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {#each data.products as product (product.id)}
        <ProductCard {product} />
      {/each}
    </div>
  {/if}
</div>
```

Note on the "الكل" chip: use a plain class binding like the other chips to avoid the literal `class:is-active` typo above — give it `class:bg-honey-600`, `class:text-white`, and conditional border/bg for the inactive state. Keep logic identical to the other buttons.

- [ ] **Step 3: Implement `src/routes/products/[slug]/+page.server.ts`**

```ts
import { error } from "@sveltejs/kit";
import { getProductBySlug, getRelatedProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const product = await getProductBySlug(db, params.slug);
  if (!product) error(404, "المنتج غير موجود");
  const related = await getRelatedProducts(db, product, 4);
  return { product, related };
};
```

- [ ] **Step 4: Implement `src/routes/products/[slug]/+page.svelte`**

```svelte
<script lang="ts">
  import Price from "$lib/components/Price.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import { addToCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let quantity = $state(1);

  function handleAdd() {
    addToCart(
      {
        productId: data.product.id,
        name: data.product.name,
        slug: data.product.slug,
        image: data.product.image,
        price: data.product.price,
        stock: data.product.stock,
      },
      quantity,
    );
  }
</script>

<svelte:head><title>{data.product.name} — بيت العسل</title></svelte:head>

<nav class="my-6 flex items-center gap-2 text-sm text-stone-500">
  <a href="/" class="hover:text-honey-700">الرئيسية</a>
  <span>/</span>
  <a href="/products" class="hover:text-honey-700">المتجر</a>
  <span>/</span>
  <span class="text-stone-800">{data.product.name}</span>
</nav>

<div class="grid gap-8 lg:grid-cols-2">
  <div class="aspect-square overflow-hidden rounded-3xl bg-honey-100">
    <img src={data.product.image} alt={data.product.name} class="h-full w-full object-cover" />
  </div>

  <div class="flex flex-col gap-5">
    <div>
      <p class="text-sm font-semibold text-honey-700">بيت العسل</p>
      <h1 class="mt-1 text-3xl font-extrabold leading-tight">{data.product.name}</h1>
    </div>
    <Price amount={data.product.price} className="text-3xl font-extrabold text-honey-800" />
    {#if data.product.stock === 0}
      <p class="w-fit rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">نفدت الكمية</p>
    {:else}
      <p class="text-sm text-stone-500">متوفر: {data.product.stock} قطعة</p>
    {/if}
    <p class="leading-relaxed text-stone-600">{data.product.description}</p>

    {#if data.product.stock > 0}
      <div class="flex items-center gap-3">
        <QuantityPicker value={quantity} max={data.product.stock} onChange={(q) => (quantity = q)} />
        <button
          type="button"
          class="rounded-full bg-honey-600 px-6 py-3 font-semibold text-white transition hover:bg-honey-700"
          onclick={handleAdd}
        >أضف إلى السلة</button>
      </div>
      <p class="text-xs text-stone-400">إجمالي: {formatEGP(data.product.price * quantity)}</p>
    {/if}
  </div>
</div>

{#if data.related.length > 0}
  <section class="mt-16">
    <h2 class="text-2xl font-extrabold">منتجات مشابهة</h2>
    <div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {#each data.related as product (product.id)}
        <ProductCard {product} />
      {/each}
    </div>
  </section>
{/if}
```

- [ ] **Step 5: Verify pages**

Run: `vp dev`; visit `/products`, `/products/sidr-natural`, and `/products?q=سدر&sort=price-asc`.
Expected: grid renders, filter chips update URL, detail shows price/qty/add button.

- [ ] **Step 6: Commit**

```bash
git add src/routes/products
git commit -m "feat(store): add catalog listing with filters and product detail"
```

---

## Task 8: Cart page

**Files:**

- Create: `src/routes/cart/+page.svelte`

**Interfaces:**

- Consumes: cart store (Task 5); `QuantityPicker`, `Price`; works without a `.server.ts`.

- [ ] **Step 1: Implement `src/routes/cart/+page.svelte`**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import Price from "$lib/components/Price.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import {
    clearCart,
    getTotals,
    loadCart,
    removeFromCart,
    setQuantity,
    state,
  } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";

  let totals = $state(getTotals());

  onMount(loadCart);
  $effect(() => {
    totals = getTotals();
  });
</script>

<svelte:head><title>سلة التسوق — بيت العسل</title></svelte:head>

<div class="mt-6">
  <h1 class="text-3xl font-extrabold">سلة التسوق</h1>

  {#if state.items.length === 0}
    <div class="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-500">
      <p class="text-lg">سلتك فارغة.</p>
      <a href="/products" class="mt-4 inline-block rounded-full bg-honey-600 px-6 py-3 font-semibold text-white hover:bg-honey-700">تصفح المتجر</a>
    </div>
  {:else}
    <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <ul class="space-y-4">
        {#each state.items as item (item.productId)}
          <li class="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center">
            <a href={`/products/${item.slug}`} class="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-honey-100">
              <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
            </a>
            <div class="flex flex-1 flex-col gap-1">
              <a href={`/products/${item.slug}`} class="font-semibold hover:text-honey-700">{item.name}</a>
              <span class="text-sm text-stone-500">{formatEGP(item.price)}</span>
              <QuantityPicker value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.productId, q)} />
              <button type="button" class="w-fit text-xs text-stone-400 hover:text-red-600" onclick={() => removeFromCart(item.productId)}>إزالة</button>
            </div>
            <Price amount={item.price * item.quantity} className="font-extrabold text-honey-800 sm:ms-auto" />
          </li>
        {/each}
      </ul>

      <aside class="h-fit rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-lg font-bold">ملخص الطلب</h2>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between"><dt>عدد القطع</dt><dd>{totals.itemCount}</dd></div>
          <div class="flex justify-between"><dt>المجموع الفرعي</dt><dd>{formatEGP(totals.subtotal)}</dd></div>
          <div class="flex justify-between"><dt>الشحن</dt><dd>{totals.shipping === 0 ? "مجاني" : formatEGP(totals.shipping)}</dd></div>
          <div class="mt-3 flex justify-between border-t border-stone-200 pt-3 text-base font-extrabold"><dt>الإجمالي</dt><dd>{formatEGP(totals.total)}</dd></div>
        </dl>
        <a href="/checkout" class="mt-5 block rounded-full bg-honey-600 py-3 text-center font-bold text-white transition hover:bg-honey-700">إتمام الشراء</a>
        <a href="/products" class="mt-2 block text-center text-sm text-stone-500 hover:text-honey-700">مواصلة التسوق</a>
        <button type="button" class="mt-2 block w-full text-center text-xs text-stone-400 hover:text-red-600" onclick={clearCart}>تفريغ السلة</button>
      </aside>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Verify**

Run: `vp dev`; add items on a product page, open `/cart`.
Expected: lines with qty steppers, summary with shipping rules, empty state works after clearing.

- [ ] **Step 3: Commit**

```bash
git add src/routes/cart
git commit -m "feat(store): add cart page with quantities and order summary"
```

---

## Task 9: Checkout flow (checkout, success, API surface)

**Files:**

- Create: `src/routes/checkout/+page.server.ts`, `src/routes/checkout/+page.svelte`
- Create: `src/routes/checkout/success/[id]/+page.server.ts`, `src/routes/checkout/success/[id]/+page.svelte`

**Interfaces:**

- Consumes: `readCartCookie`, `clearCartCookie` (Task 3); `checkoutSchema`, `formatZodErrors` (Task 2); `createOrder`, `getProductBySlug`/`listProducts` (Task 4); `linesToItems`, `computeTotals` (Task 2); `env` for secret.
- Produces: checkout submit action that creates the order, clears the cart cookie, redirects to success; success page reads order by id.

- [ ] **Step 1: Implement `src/routes/checkout/+page.server.ts`**

```ts
import { fail, redirect } from "@sveltejs/kit";
import { inArray } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { readCartCookie, clearCartCookie } from "$lib/server/cart-cookie";
import { checkoutSchema, formatZodErrors } from "$lib/server/checkout-schema";
import { createOrder } from "$lib/server/orders";
import { linesToItems, computeTotals } from "$lib/cart";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  const lines = readCartCookie(cookies, env.BETTER_AUTH_SECRET || env.ORIGIN || "dev-secret");
  if (lines.length === 0) redirect(302, "/cart");
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await db.select().from(schema.product).where(inArray(schema.product.id, ids));
  const catalog = products.map((p) => ({
    productId: p.id,
    name: p.name,
    slug: p.slug,
    image: p.image,
    price: p.price,
    stock: p.stock,
  }));
  const items = linesToItems(lines, catalog);
  return { items, totals: computeTotals(items) };
};

export const actions: Actions = {
  submit: async (event) => {
    const { request, cookies, locals } = event;
    const form = Object.fromEntries(await request.formData());

    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      return fail(400, { errors: formatZodErrors(parsed.error), values: form });
    }

    const lines = readCartCookie(cookies, env.BETTER_AUTH_SECRET || env.ORIGIN || "dev-secret");
    if (lines.length === 0) {
      return fail(400, { errors: { cart: "سلتك فارغة" }, values: form });
    }

    const result = await createOrder(
      db,
      lines,
      {
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        address: parsed.data.address,
        city: parsed.data.city,
      },
      locals.user?.id,
    );

    if (!result.ok) {
      return fail(409, { errors: { cart: result.message }, values: form });
    }

    clearCartCookie(cookies);
    redirect(303, `/checkout/success/${result.orderId}`);
  },
};
```

- [ ] **Step 2: Implement `src/routes/checkout/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";
  import Price from "$lib/components/Price.svelte";
  import { formatEGP } from "$lib/currency";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  function value(name: string) {
    return form?.values ? String(form.values[name] ?? "") : "";
  }
  function error(name: string) {
    return form?.errors?.[name] ?? "";
  }
</script>

<svelte:head><title>إتمام الشراء — بيت العسل</title></svelte:head>

<div class="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
  <form method="post" action="?/submit" use:enhance class="space-y-5 rounded-2xl border border-stone-200 bg-white p-6">
    <h1 class="text-2xl font-extrabold">معلومات التوصيل</h1>

    {#if error("cart")}
      <p class="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert" data-testid="cart-error">{error("cart")}</p>
    {/if}

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm font-medium">
        الاسم بالكامل *
        <input name="name" value={value("name")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
        {#if error("name")}<span class="mt-1 block text-xs text-red-600">{error("name")}</span>{/if}
      </label>
      <label class="block text-sm font-medium">
        البريد الإلكتروني *
        <input name="email" type="email" value={value("email")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
        {#if error("email")}<span class="mt-1 block text-xs text-red-600">{error("email")}</span>{/if}
      </label>
      <label class="block text-sm font-medium">
        رقم الهاتف *
        <input name="phone" inputmode="tel" value={value("phone")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
        {#if error("phone")}<span class="mt-1 block text-xs text-red-600">{error("phone")}</span>{/if}
      </label>
      <label class="block text-sm font-medium">
        المدينة *
        <input name="city" value={value("city")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
        {#if error("city")}<span class="mt-1 block text-xs text-red-600">{error("city")}</span>{/if}
      </label>
    </div>
    <label class="block text-sm font-medium">
      العنوان بالتفصيل *
      <input name="address" value={value("address")} class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
      {#if error("address")}<span class="mt-1 block text-xs text-red-600">{error("address")}</span>{/if}
    </label>

    <fieldset class="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <legend class="px-2 text-sm font-bold">الدفع</legend>
      <p class="mb-4 text-xs text-stone-500">مرحلة تجريبية — لن تُخصم أي مبالغ من بطاقتك.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-medium sm:col-span-2">
          رقم البطاقة *
          <input name="cardNumber" inputmode="numeric" placeholder="4242 4242 4242 4242" value={value("cardNumber")} class="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
          {#if error("cardNumber")}<span class="mt-1 block text-xs text-red-600">{error("cardNumber")}</span>{/if}
        </label>
        <label class="block text-sm font-medium">
          تاريخ الانتهاء (MM/YY) *
          <input name="cardExpiry" placeholder="08/28" value={value("cardExpiry")} class="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
          {#if error("cardExpiry")}<span class="mt-1 block text-xs text-red-600">{error("cardExpiry")}</span>{/if}
        </label>
        <label class="block text-sm font-medium">
          رمز الأمان (CVV) *
          <input name="cardCvc" inputmode="numeric" value={value("cardCvc")} class="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
          {#if error("cardCvc")}<span class="mt-1 block text-xs text-red-600">{error("cardCvc")}</span>{/if}
        </label>
      </div>
    </fieldset>

    <button type="submit" class="w-full rounded-full bg-honey-600 py-3 font-bold text-white transition hover:bg-honey-700">تأكيد الطلب</button>
  </form>

  <aside class="h-fit rounded-2xl border border-stone-200 bg-white p-5">
    <h2 class="text-lg font-bold">ملخص الطلب</h2>
    <ul class="mt-4 space-y-3">
      {#each data.items as item (item.productId)}
        <li class="flex justify-between gap-2 text-sm">
          <span class="line-clamp-1">{item.name} × {item.quantity}</span>
          <span class="font-semibold">{formatEGP(item.price * item.quantity)}</span>
        </li>
      {/each}
    </ul>
    <dl class="mt-4 space-y-1 border-t border-stone-200 pt-3 text-sm">
      <div class="flex justify-between"><dt>المجموع الفرعي</dt><dd>{formatEGP(data.totals.subtotal)}</dd></div>
      <div class="flex justify-between"><dt>الشحن</dt><dd>{data.totals.shipping === 0 ? "مجاني" : formatEGP(data.totals.shipping)}</dd></div>
      <div class="flex justify-between text-base font-extrabold"><dt>الإجمالي</dt><dd>{formatEGP(data.totals.total)}</dd></div>
    </dl>
    <p class="mt-4 text-xs text-stone-400">بإتمام الطلب أنت توافق على استلام طلبك خلال 2-4 أيام عمل.</p>
  </aside>
</div>
```

- [ ] **Step 3: Implement `src/routes/checkout/success/[id]/+page.server.ts`**

```ts
import { error } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const order = await db.select().from(schema.order).where(eq(schema.order.id, params.id)).get();
  if (!order) error(404, "الطلب غير موجود");
  const items = await db
    .select()
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, order.id));
  return { order, items };
};
```

Note: remove the unused `and` import — only `eq` is needed.

- [ ] **Step 4: Implement `src/routes/checkout/success/[id]/+page.svelte`**

```svelte
<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const localized = new Intl.DateTimeFormat("ar-EG", { dateStyle: "long", timeStyle: "short" });
</script>

<svelte:head><title>تأكيد الطلب — بيت العسل</title></svelte:head>

<div class="mx-auto max-w-2xl pt-10 text-center">
  <div class="mx-auto grid h-20 w-20 place-items-center rounded-full bg-green-100 text-3xl text-green-700">✓</div>
  <h1 class="mt-4 text-3xl font-extrabold">شكراً لك! تم استلام طلبك</h1>
  <p class="mt-2 text-stone-500">رقم الطلب <span class="font-bold text-honey-800" data-testid="order-number">{data.order.number}</span></p>
  <p class="mt-1 text-sm text-stone-400">الدفع تمت محاكاته — لا يوجد أي خصم فعلي على بطاقتك.</p>

  <section class="mt-8 rounded-3xl border border-stone-200 bg-white p-6 text-start">
    <h2 class="text-lg font-bold">المنتجات</h2>
    <ul class="mt-3 space-y-2 text-sm">
      {#each data.items as item (item.id)}
        <li class="flex justify-between gap-2">
          <span>{item.productName} × {item.quantity}</span>
          <span class="font-semibold">{formatEGP(item.unitPrice * item.quantity)}</span>
        </li>
      {/each}
    </ul>
    <dl class="mt-4 flex justify-between border-t border-stone-200 pt-3 text-base font-extrabold">
      <dt>الإجمالي</dt>
      <dd>{formatEGP(data.order.total)}</dd>
    </dl>
  </section>

  <section class="mt-4 rounded-3xl border border-stone-200 bg-white p-6 text-start text-sm text-stone-600">
    <p><span class="font-bold">التوصيل إلى:</span> {data.order.address}، {data.order.city}</p>
    <p>العميل: {data.order.name} — {data.order.phone}</p>
    <p>التاريخ: {localized.format(data.order.createdAt)}</p>
  </section>

  <a href="/products" class="mt-8 inline-block rounded-full bg-honey-600 px-6 py-3 font-bold text-white hover:bg-honey-700">مواصلة التسوق</a>
</div>
```

- [ ] **Step 5: Manual flow check**

Run: `vp dev`; add items, go to `/checkout`, submit a valid form.
Expected: success page shows order number; DB now has the order with decremented stock; cart cookie cleared (add → cart returns to empty). Also submit an invalid form (bad phone) → field errors render.

- [ ] **Step 6: Commit**

```bash
git add src/routes/checkout
git commit -m "feat(store): add checkout flow with mock payment and success page"
```

---

## Task 10: Auth pages + account orders

**Files:**

- Create: `src/routes/login/+page.server.ts`, `src/routes/login/+page.svelte`
- Create: `src/routes/register/+page.server.ts`, `src/routes/register/+page.svelte`
- Create: `src/routes/account/orders/+page.server.ts`, `src/routes/account/orders/+page.svelte`

**Interfaces:**

- Consumes: `auth` from `$lib/server/auth` (better-auth `signInEmail`/`signUpEmail`), `event.locals.user`, `db`, drizzle `desc`/`eq`.
- Produces: `/login`, `/register`, `/account/orders`.

- [ ] **Step 1: Implement `src/routes/login/+page.server.ts`**

```ts
import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = (event) => {
  if (event.locals.user) redirect(302, "/account/orders");
};

export const actions: Actions = {
  signIn: async (event) => {
    const form = Object.fromEntries(await event.request.formData());
    const email = String(form.email ?? "");
    const password = String(form.password ?? "");
    try {
      await auth.api.signInEmail({ body: { email, password } });
    } catch (error) {
      if (error instanceof APIError) return fail(400, { message: "بيانات الدخول غير صحيحة" });
      return fail(500, { message: "حدث خطأ غير متوقع" });
    }
    redirect(302, "/account/orders");
  },
};
```

- [ ] **Step 2: Implement `src/routes/login/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>تسجيل الدخول — بيت العسل</title></svelte:head>

<div class="mx-auto mt-12 max-w-md">
  <h1 class="text-2xl font-extrabold">تسجيل الدخول</h1>
  <p class="mt-1 text-sm text-stone-500">لا تحتاج حسابًا للشراء — يمكنك الدخول لمتابعة طلباتك.</p>
  <form method="post" action="?/signIn" use:enhance class="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
    {#if form?.message}
      <p class="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{form.message}</p>
    {/if}
    <label class="block text-sm font-medium">
      البريد الإلكتروني
      <input name="email" type="email" required class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <label class="block text-sm font-medium">
      كلمة المرور
      <input name="password" type="password" required class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <button type="submit" class="w-full rounded-full bg-honey-600 py-3 font-bold text-white hover:bg-honey-700">دخول</button>
    <p class="text-center text-sm text-stone-500">ليس لديك حساب؟ <a href="/register" class="font-semibold text-honey-700 hover:underline">أنشئ حسابًا</a></p>
  </form>
</div>
```

- [ ] **Step 3: Implement `src/routes/register/+page.server.ts`**

```ts
import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = (event) => {
  if (event.locals.user) redirect(302, "/account/orders");
};

export const actions: Actions = {
  register: async (event) => {
    const form = Object.fromEntries(await event.request.formData());
    const name = String(form.name ?? "");
    const email = String(form.email ?? "");
    const password = String(form.password ?? "");
    try {
      await auth.api.signUpEmail({ body: { name, email, password } });
    } catch (error) {
      if (error instanceof APIError)
        return fail(400, { message: "تعذر إنشاء الحساب، تحقق من البيانات" });
      return fail(500, { message: "حدث خطأ غير متوقع" });
    }
    redirect(302, "/account/orders");
  },
};
```

- [ ] **Step 4: Implement `src/routes/register/+page.svelte`** (mirror of login form plus a `name` field, action `?/register`, CTA to `/login`)

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>إنشاء حساب — بيت العسل</title></svelte:head>

<div class="mx-auto mt-12 max-w-md">
  <h1 class="text-2xl font-extrabold">إنشاء حساب</h1>
  <form method="post" action="?/register" use:enhance class="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
    {#if form?.message}
      <p class="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{form.message}</p>
    {/if}
    <label class="block text-sm font-medium">
      الاسم
      <input name="name" required class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <label class="block text-sm font-medium">
      البريد الإلكتروني
      <input name="email" type="email" required class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <label class="block text-sm font-medium">
      كلمة المرور
      <input name="password" type="password" required minlength="8" class="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-honey-500 focus:ring-honey-500" />
    </label>
    <button type="submit" class="w-full rounded-full bg-honey-600 py-3 font-bold text-white hover:bg-honey-700">إنشاء الحساب</button>
    <p class="text-center text-sm text-stone-500">لديك حساب بالفعل؟ <a href="/login" class="font-semibold text-honey-700 hover:underline">سجّل الدخول</a></p>
  </form>
</div>
```

- [ ] **Step 5: Implement `src/routes/account/orders/+page.server.ts`**

```ts
import { redirect } from "@sveltejs/kit";
import { desc, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user) redirect(302, "/login");
  const orders = await db
    .select()
    .from(schema.order)
    .where(eq(schema.order.userId, event.locals.user.id))
    .orderBy(desc(schema.order.createdAt));
  return { orders };
};
```

- [ ] **Step 6: Implement `src/routes/account/orders/+page.svelte`**

```svelte
<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const localized = new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" });
</script>

<svelte:head><title>طلباتي — بيت العسل</title></svelte:head>

<div class="mt-6">
  <h1 class="text-3xl font-extrabold">طلباتي</h1>
  {#if data.orders.length === 0}
    <div class="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-500">
      <p>لم تقم بأي طلبات بعد.</p>
      <a href="/products" class="mt-4 inline-block rounded-full bg-honey-600 px-6 py-3 font-semibold text-white hover:bg-honey-700">تصفح المتجر</a>
    </div>
  {:else}
    <ul class="mt-6 space-y-4">
      {#each data.orders as order (order.id)}
        <li class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-5">
          <div>
            <a href={`/checkout/success/${order.id}`} class="font-bold text-honey-800 hover:underline" data-testid="order-link">{order.number}</a>
            <p class="text-sm text-stone-500">{localized.format(order.createdAt)}</p>
          </div>
          <div class="text-start">
            <span class="text-sm text-stone-500">الحالة</span>
            <span class="ms-2 rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">مؤكد</span>
          </div>
          <span class="font-extrabold">{formatEGP(order.total)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

- [ ] **Step 7: Verify auth flow**

Run: `vp dev`; register, then check `/account/orders` shows empty state; place an order while logged in; confirm it appears under orders.

- [ ] **Step 8: Commit**

```bash
git add src/routes/login src/routes/register src/routes/account
git commit -m "feat(store): add login, register, and account orders pages"
```

---

## Task 11: E2E tests, docs, and quality gate

**Files:**

- Create: `src/routes/store.e2e.ts`
- Modify: `playwright.config.ts` (webServer seeds), README.md
- Create/update: `docs/decisions.md`, `docs/architecture.md`, `docs/todo.md` (per project-memory)

**Interfaces:**

- Consumes the whole app; depends on seeded DB and the preview server.

- [ ] **Step 1: Update `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "npm run db:reset && npm run build && npm run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  testMatch: "**/*.e2e.{ts,js}",
});
```

- [ ] **Step 2: Write `src/routes/store.e2e.ts`**

```ts
import { expect, test } from "@playwright/test";

test("guest browses, adds to cart, and completes checkout", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("عسل");

  await page.getByRole("link", { name: "المتجر" }).first().click();
  await expect(page).toHaveURL(/\/products/);

  const card = page.getByText("عسل سدر طبيعي").first();
  await card.click();
  await expect(page).toHaveURL(/\/products\/sidr-natural/);

  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.getByRole("button", { name: "فتح سلة التسوق" }).click();
  await expect(page.getByTestId("cart-drawer")).toBeVisible();
  await expect(page.getByTestId("cart-drawer")).toContainText("عسل سدر طبيعي");

  await page.getByRole("link", { name: "إتمام الشراء" }).click();
  await page.getByLabel("الاسم بالكامل").fill("أحمد محمد");
  await page.getByLabel("البريد الإلكتروني").fill("e2e@example.com");
  await page.getByLabel("رقم الهاتف").fill("01012345678");
  await page.getByLabel("المدينة").fill("القاهرة");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع التسعين، التجمع الخامس");
  await page.getByLabel("رقم البطاقة").fill("4242424242424242");
  await page.getByLabel("تاريخ الانتهاء (MM/YY)").fill("08/28");
  await page.getByLabel("رمز الأمان (CVV)").fill("123");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page).toHaveURL(/\/checkout\/success\//);
  await expect(page.getByTestId("order-number")).toBeVisible();
  const number = await page.getByTestId("order-number").textContent();
  expect(number).toMatch(/^HNY-\d{6}$/);
});

test("checkout shows validation errors for bad input", async ({ page }) => {
  await page.goto("/products/sidr-natural");
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.goto("/checkout");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page.getByText("رقم هاتف مصري غير صالح")).toBeVisible();
  await expect(page.getByText("بريد إلكتروني غير صالح")).toBeVisible();
});
```

- [ ] **Step 3: Run the e2e suite**

Run: `pnpm test:e2e`
Expected: both tests pass against the seeded preview server. If the second test's first click races the cart cookie POST, `page.goto("/checkout")` still carries the cookie because the flow navigates after the POST resolves (fetch in the store is fire-and-forget — if flaky, add `await page.waitForTimeout(300)` after the add-to-cart click).

- [ ] **Step 4: Update docs**

README: replace the scaffold section with a short stack + setup list (`pnpm install`, `pnpm db:reset`, `pnpm dev`).
Create `docs/decisions.md`, `docs/architecture.md`, `docs/todo.md` per the project-memory skill, capturing: store architecture (Drizzle schema, cart cookie design, checkout transaction, mock payment) and the decisions (Arabic RTL, EGP qirsh, guest-first auth, flat shipping).

- [ ] **Step 5: Quality gate**

Run:

```
vp check
pnpm test:unit -- --run
pnpm test:e2e
vp build
```

Expected: all green. Then run the quality-gate skill checklist and fix anything it flags (compiles, lint, tests, security, duplication, docs).

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts src/routes/store.e2e.ts README.md docs
git commit -m "test(store): add e2e coverage, docs, and quality gate"
```

---

## Self-Review Notes (run before handoff)

- Spec coverage: catalog ✓ (Task 7), cart ✓ (Tasks 5 + 8), guest checkout + mock payment ✓ (Task 9), order success ✓, optional accounts ✓ (Task 10), Arabic RTL + EGP ✓ (Tasks 1, 5, 2), seed 4/14 ✓ (Task 1), stock decrement transaction ✓ (Task 4), shipping flat fee ✓ (Task 2). Acceptance criteria met by Tasks 9/10/11.
- No placeholders: every code step contains real implementation or test code.
- Type/name consistency: `formatEGP`, `CartItem`, `computeTotals`, `createOrder`, `readCartCookie`, `checkoutSchema`, `state`/`addToCart` are referenced only by the names/param lists defined in earlier tasks.
