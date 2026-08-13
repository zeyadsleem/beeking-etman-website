# مملكة النحل — Royal Honey Kingdom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the store as مملكة النحل / عتمان الأصلي with a variant product catalog (43 real lines), real honey photography, and a full Royal Kingdom UX/UI overhaul with Svelte animations.

**Architecture:** New `store_product_variant` table makes `store_product` a honey _type_; cart/checkout/order become variant-keyed. UI moves to a gold-on-black royal theme over parchment with view transitions, staggered reveals, marquee, count-ups, and a variant selector.

**Tech Stack:** Svelte 5 (runes), SvelteKit, Drizzle ORM + libsql (SQLite), Tailwind v4, Vitest (browser) + Playwright, Vite+ (`vp`), pnpm.

**Spec:** `docs/superpowers/specs/2026-08-14-mamlakat-alnahl-design.md`

## Global Constraints

- TypeScript strict; no `any`; explicit return types on shared functions.
- Money is integer qirsh (1/100 EGP); format only via `formatEGP` (`src/lib/currency.ts`).
- pnpm for everything. Commits are Conventional Commits.
- Arabic RTL storefront: all UI copy Arabic, `dir="rtl"`, Cairo/Amiri/Aref Ruqaa fonts already imported in `src/routes/+layout.svelte`.
- Preserve test hooks unless a task explicitly rewrites them: `data-testid="cart-drawer"`, `data-testid="cart-count"`, `data-testid="cart-error"`, `data-testid="order-number"`, `data-testid="order-link"`, button aria-labels "فتح سلة التسوق" / "أضف إلى السلة" / "تأكيد الطلب" / "جاري التأكيد…", checkout labels, order numbers `^HNY-\d{6}$`.
- Free shipping at subtotal ≥ `FREE_SHIPPING_THRESHOLD` (600_00), else `SHIPPING_COST` (60_00).
- Every product line from the user's list must map to exactly one variant; no line may be dropped.
- All product images must be real honey photographs whose URL returns HTTP 200 with an image content-type (verify, don't assume).

---

### Task 1: Schema migration — product variants + order item variant name

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/0001_<generated>.sql` (via drizzle-kit generate)

**Interfaces:**

- Consumes: existing `product`, `category`, `order`, `orderItem` tables.
- Produces: `schema.productVariant` table (columns `id, productId, name, price, stock, image, sortOrder`); `schema.orderItem.variantName` column. Later tasks read these.

- [ ] **Step 1: Update the schema**

Add to `src/lib/server/db/schema.ts` (after the `product` table) and add `variantName` to `orderItem`:

```ts
export const productVariant = sqliteTable("store_product_variant", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => product.id),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").notNull().default(0),
  image: text("image").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
```

In `orderItem` add: `variantName: text("variant_name").notNull().default(""),`

- [ ] **Step 2: Generate the migration**

Run: `pnpm exec drizzle-kit generate`
Expected: a new `drizzle/0001_*.sql` containing `CREATE TABLE store_product_variant ...` and `ALTER TABLE store_order_item ADD COLUMN variant_name ...`.

- [ ] **Step 3: Verify migration applies**

Run: `pnpm db:migrate`
Expected: "migrations applied successfully!". Confirm the column exists:

```bash
sqlite3 local.db "SELECT name FROM sqlite_master WHERE type='table' AND name='store_product_variant';"
sqlite3 local.db "PRAGMA table_info(store_order_item);" | grep variant_name
```

- [ ] **Step 4: Run check**

Run: `pnpm check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/
git commit -m "feat(db): product variants and order item variant name"
```

---

### Task 2: Cart core — variant-keyed (TDD)

**Files:**

- Modify: `src/lib/cart.ts`, `src/lib/cart.spec.ts`, `src/lib/server/cart-cookie.ts`, `src/lib/server/cart-cookie.spec.ts`, `src/lib/cart-store.svelte.ts`
- `src/routes/api/cart/+server.ts` needs **no change** (it calls `sanitizeCartLines`).

**Interfaces:**

- Consumes: nothing new (self-contained).
- Produces: `CartLine { variantId, quantity }`, `CartItem { variantId, productId, name, variantName, slug, image, price, stock, quantity }`; functions `addItem(items, item: Omit<CartItem,"quantity">, quantity)`, `adjustQuantity(items, variantId, delta)`, `removeItem(items, variantId)`, `linesToItems(lines, catalog)` all keyed by `variantId`. Cart store functions `setQuantity(productId, q)` / `removeFromCart(productId)` become `setQuantity(variantId, q)` / `removeFromCart(variantId)`.

- [ ] **Step 1: Write failing unit tests** — rewrite `src/lib/cart.spec.ts`

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
  variantId: "v1",
  productId: "p1",
  name: "عسل سدر مصري",
  variantName: "500 جرام",
  slug: "sidr-egyptian",
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
  it("merges into the same variant line", () => {
    expect(addItem([item(product, 1)], product, 2)[0].quantity).toBe(3);
  });
  it("does not merge different variants of the same product", () => {
    const other = { ...product, variantId: "v2", variantName: "1 ك", price: 700_00 };
    expect(addItem([item(product, 1)], other, 1)).toHaveLength(2);
  });
  it("clamps to stock", () => {
    expect(addItem([item(product, 2)], product, 5)[0].quantity).toBe(3);
  });
  it("never adds a zero-stock variant", () => {
    expect(addItem([], { ...product, stock: 0 }, 1)).toEqual([]);
  });
});

describe("adjustQuantity", () => {
  it("increments by variant", () => {
    expect(adjustQuantity([item(product, 1)], "v1", 1)[0].quantity).toBe(2);
  });
  it("removes the line when it hits zero", () => {
    expect(adjustQuantity([item(product, 1)], "v1", -1)).toEqual([]);
  });
  it("clamps to stock", () => {
    expect(adjustQuantity([item(product, 3)], "v1", 1)[0].quantity).toBe(3);
  });
});

describe("removeItem", () => {
  it("removes only the matching variant", () => {
    const other = { ...product, variantId: "v2" };
    expect(removeItem([item(product), item(other)], "v1").map((i) => i.variantId)).toEqual(["v2"]);
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
  });
});

describe("linesToItems", () => {
  it("maps and clamps quantity to stock", () => {
    expect(linesToItems([{ variantId: "v1", quantity: 9 }], [product])).toEqual([
      { ...product, quantity: 3 },
    ]);
  });
  it("drops unknown variants", () => {
    expect(linesToItems([{ variantId: "nope", quantity: 1 }], [product])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- --run`
Expected: compile/type failures on `productId` / `variantName` — the tests are red.

- [ ] **Step 3: Implement `src/lib/cart.ts`**

```ts
export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface CartItem extends CartLine {
  productId: string;
  name: string;
  variantName: string;
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
  const existing = items.find((i) => i.variantId === product.variantId);
  const merged = existing ? existing.quantity + quantity : quantity;
  const next = Math.min(merged, product.stock);
  if (!existing) return [...items, { ...product, quantity: next }];
  return items.map((i) => (i.variantId === product.variantId ? { ...i, quantity: next } : i));
}

export function adjustQuantity(items: CartItem[], variantId: string, delta: number): CartItem[] {
  return items
    .map((i) => (i.variantId === variantId ? { ...i, quantity: i.quantity + delta } : i))
    .filter((i) => i.quantity > 0)
    .map((i) => ({ ...i, quantity: Math.min(i.quantity, i.stock) }));
}

export function removeItem(items: CartItem[], variantId: string): CartItem[] {
  return items.filter((i) => i.variantId !== variantId);
}

export function linesToItems(lines: CartLine[], catalog: Omit<CartItem, "quantity">[]): CartItem[] {
  return lines.flatMap((line) => {
    const product = catalog.find((p) => p.variantId === line.variantId);
    if (!product) return [];
    return [{ ...product, quantity: Math.min(line.quantity, product.stock) }];
  });
}
```

- [ ] **Step 4: Update `sanitizeCartLines` and its spec**

In `src/lib/server/cart-cookie.ts` replace the entry destructure:

```ts
const { variantId, quantity } = entry as Record<string, unknown>;
if (typeof variantId !== "string" || variantId.length === 0) return [];
if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return [];
return [{ variantId, quantity: Math.floor(quantity) }];
```

Rewrite `src/lib/server/cart-cookie.spec.ts` fixtures: every `productId` → `variantId` (five occurrences in the file).

- [ ] **Step 5: Update the cart store** — `src/lib/cart-store.svelte.ts`

```ts
const STORAGE_KEY = "honey_cart_v2";

const CartItemSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  name: z.string(),
  variantName: z.string(),
  slug: z.string(),
  image: z.string(),
  quantity: z.number(),
  price: z.number(),
  stock: z.number(),
});
```

In `persist`, send `{ variantId: i.variantId, quantity: i.quantity }`. Rename `setQuantity(productId, q)` → `setQuantity(variantId, q)` and `removeFromCart(productId)` → `removeFromCart(variantId)` (bodies key off `variantId`).

- [ ] **Step 6: Run tests**

Run: `pnpm test:unit -- --run`
Expected: all green (cart, cart-cookie, currency, ProductCard, orders still pass).

- [ ] **Step 7: Commit**

```bash
git add src/lib/cart.ts src/lib/cart.spec.ts src/lib/server/cart-cookie.ts src/lib/server/cart-cookie.spec.ts src/lib/cart-store.svelte.ts
git commit -m "refactor(cart): variant-keyed cart lines"
```

---

### Task 3: Server store queries — products + variants

**Files:**

- Modify: `src/lib/server/store.ts`
- Create: `src/lib/server/store.spec.ts`

**Interfaces:**

- Consumes: `schema.product`, `schema.productVariant` (Task 1).
- Produces:
  - `ProductVariantSummary { id, name, price, stock, image, sortOrder }`
  - `ProductSummary { id, name, slug, description, image, categoryId, featured, createdAt, variants: ProductVariantSummary[], minPrice: number }`
  - `getCategories(db)` (unchanged shape)
  - `getFeaturedProducts(db, limit)` → `ProductSummary[]`
  - `listProducts(db, filters)` → `ProductSummary[]` (sort by minPrice when price-asc/desc)
  - `getProductWithVariants(db, slug)` → `ProductSummary | null`
  - `getRelatedProducts(db, product, limit)` → `ProductSummary[]`
  - `resolveCartItems(db, lines: CartLine[])` → `CartItem[]` (used by orders + checkout; returns `[]` for unknown variantIds, clamps qty to stock)

- [ ] **Step 1: Write failing tests** — create `src/lib/server/store.spec.ts`

```ts
import { afterAll, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import { getProductWithVariants, listProducts, resolveCartItems } from "./store";

const DB_FILE = "store-test.db";

async function buildDb() {
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  await db.run(`
    CREATE TABLE store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE
    )`);
  await db.run(`
    CREATE TABLE store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL, category_id TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_product_variant (
      id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL,
      price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
  const cat = (
    await db
      .insert(schema.category)
      .values({ name: "عسل السدر", slug: "sidr" })
      .returning({ id: schema.category.id })
  )[0];
  const p = (
    await db
      .insert(schema.product)
      .values({
        name: "عسل سدر مصري",
        slug: "sidr-egyptian",
        description: "سدر مصري",
        price: 0,
        stock: 0,
        image: "https://example.com/s.jpg",
        categoryId: cat.id,
        featured: 1,
        createdAt: Date.now(),
      })
      .returning()
  )[0];
  const variants = await db
    .insert(schema.productVariant)
    .values([
      {
        productId: p.id,
        name: "1 ك",
        price: 700_00,
        stock: 4,
        image: "https://example.com/s.jpg",
        sortOrder: 1,
      },
      {
        productId: p.id,
        name: "500 جرام",
        price: 380_00,
        stock: 6,
        image: "https://example.com/s.jpg",
        sortOrder: 0,
      },
    ])
    .returning();
  return { db, p, cat, v1: variants.find((v) => v.name === "500 جرام")! };
}

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("store queries with variants", () => {
  it("returns variants sorted by sortOrder with minPrice", async () => {
    const { db } = await buildDb();
    const product = await getProductWithVariants(db, "sidr-egyptian");
    expect(product?.variants.map((v) => v.name)).toEqual(["500 جرام", "1 ك"]);
    expect(product?.minPrice).toBe(380_00);
  });

  it("sorts price-asc by minPrice", async () => {
    const { db } = await buildDb();
    const rows = await listProducts(db, { sort: "price-asc" });
    expect(rows[0].minPrice).toBe(380_00);
  });

  it("resolveCartItems joins variant info and clamps to stock", async () => {
    const { db, v1 } = await buildDb();
    const items = await resolveCartItems(db, [{ variantId: v1.id, quantity: 99 }]);
    expect(items).toHaveLength(1);
    expect(items[0].variantName).toBe("500 جرام");
    expect(items[0].quantity).toBe(6);
    expect(items[0].price).toBe(380_00);
  });

  it("resolveCartItems drops unknown variants", async () => {
    const { db } = await buildDb();
    expect(await resolveCartItems(db, [{ variantId: "nope", quantity: 1 }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- --run`
Expected: red (new types/functions missing).

- [ ] **Step 3: Implement `src/lib/server/store.ts`**

```ts
import { and, asc, desc, eq, inArray, like, ne, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { CartItem, CartLine } from "$lib/cart";
import * as schema from "$lib/server/db/schema";

export interface ProductVariantSummary {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  sortOrder: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  categoryId: string;
  featured: number;
  createdAt: number;
  variants: ProductVariantSummary[];
  minPrice: number;
}

export type SortOrder = "newest" | "price-asc" | "price-desc";

export interface ProductFilters {
  query?: string;
  category?: string;
  sort?: SortOrder;
  limit?: number;
  offset?: number;
}

type VariantRow = typeof schema.productVariant.$inferSelect;
type ProductRow = typeof schema.product.$inferSelect;

export function withVariants(
  rows: ProductRow[],
  variantsByProduct: Map<string, VariantRow[]>,
): ProductSummary[] {
  return rows.map((row) => {
    const variants = (variantsByProduct.get(row.id) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      image: row.image,
      categoryId: row.categoryId,
      featured: row.featured,
      createdAt: row.createdAt,
      variants,
      minPrice: variants.length ? Math.min(...variants.map((v) => v.price)) : 0,
    };
  });
}

async function loadVariantsForProducts(
  db: LibSQLDatabase<typeof schema>,
  productIds: string[],
): Promise<Map<string, VariantRow[]>> {
  if (productIds.length === 0) return new Map();
  const variants = await db
    .select()
    .from(schema.productVariant)
    .where(inArray(schema.productVariant.productId, productIds));
  const map = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const list = map.get(v.productId) ?? [];
    list.push(v);
    map.set(v.productId, list);
  }
  return map;
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
  return withVariants(
    rows,
    await loadVariantsForProducts(
      db,
      rows.map((r) => r.id),
    ),
  );
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
  const rows = await db
    .select()
    .from(schema.product)
    .where(where)
    .orderBy(desc(schema.product.createdAt))
    .limit(filters.limit ?? 1000)
    .offset(filters.offset ?? 0);
  const summaries = withVariants(
    rows,
    await loadVariantsForProducts(
      db,
      rows.map((r) => r.id),
    ),
  );
  if (filters.sort === "price-asc") summaries.sort((a, b) => a.minPrice - b.minPrice);
  if (filters.sort === "price-desc") summaries.sort((a, b) => b.minPrice - a.minPrice);
  return summaries;
}

export async function getProductWithVariants(
  db: LibSQLDatabase<typeof schema>,
  slug: string,
): Promise<ProductSummary | null> {
  const row = await db.select().from(schema.product).where(eq(schema.product.slug, slug)).get();
  if (!row) return null;
  const list = await withVariants([row], await loadVariantsForProducts(db, [row.id]));
  return list[0];
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
  return withVariants(
    rows,
    await loadVariantsForProducts(
      db,
      rows.map((r) => r.id),
    ),
  );
}

export async function resolveCartItems(
  db: LibSQLDatabase<typeof schema>,
  lines: CartLine[],
): Promise<CartItem[]> {
  if (lines.length === 0) return [];
  const ids = [...new Set(lines.map((l) => l.variantId))];
  const variants = await db
    .select()
    .from(schema.productVariant)
    .where(inArray(schema.productVariant.id, ids));
  if (variants.length === 0) return [];
  const products = await db
    .select()
    .from(schema.product)
    .where(inArray(schema.product.id, [...new Set(variants.map((v) => v.productId))]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));
  return lines.flatMap((line) => {
    const v = variantById.get(line.variantId);
    if (!v) return [];
    const p = productById.get(v.productId);
    if (!p) return [];
    return [
      {
        variantId: v.id,
        productId: p.id,
        name: p.name,
        variantName: v.name,
        slug: p.slug,
        image: v.image,
        price: v.price,
        stock: v.stock,
        quantity: Math.min(line.quantity, v.stock),
      },
    ];
  });
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:unit -- --run` and `pnpm check`
Expected: new store tests green; check clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/store.ts src/lib/server/store.spec.ts
git commit -m "feat(store): product variants with minPrice and cart resolution"
```

---

### Task 4: Order service + checkout server — variant flow

**Files:**

- Modify: `src/lib/server/orders.ts`, `src/lib/server/orders.spec.ts`, `src/routes/checkout/+page.server.ts`

**Interfaces:**

- Consumes: `resolveCartItems` (Task 3), `computeTotals` (Task 2), `schema.orderItem.variantName` (Task 1).
- Produces: `createOrder(db, lines: CartLine[], customer, userId?)` unchanged signature, now variant-based; order items carry `variantName`.

- [ ] **Step 1: Write failing tests** — rewrite `src/lib/server/orders.spec.ts`

Replace the whole file:

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
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_order_item`);
  await db.run(`DROP TABLE IF EXISTS store_order`);
  await db.run(`DROP TABLE IF EXISTS store_product_variant`);
  await db.run(`DROP TABLE IF EXISTS store_product`);
  await db.run(`DROP TABLE IF EXISTS store_category`);
  await db.run(`
    CREATE TABLE store_category (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE
    )`);
  await db.run(`
    CREATE TABLE store_product (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL, category_id TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_product_variant (
      id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL,
      price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0, image TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`);
  await db.run(`
    CREATE TABLE store_order (
      id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
      address TEXT NOT NULL, city TEXT NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid', user_id TEXT, created_at INTEGER NOT NULL
    )`);
  await db.run(`
    CREATE TABLE store_order_item (
      id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL,
      product_name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    )`);
  const cat = (
    await db
      .insert(schema.category)
      .values({ name: "عسل السدر", slug: "sidr" })
      .returning({ id: schema.category.id })
  )[0];
  const p = (
    await db
      .insert(schema.product)
      .values({
        name: "عسل سدر مصري",
        slug: "sidr-egyptian",
        description: "د",
        price: 0,
        stock: 0,
        image: "https://example.com/h.jpg",
        categoryId: cat.id,
        featured: 0,
        createdAt: Date.now(),
      })
      .returning()
  )[0];
  const v = (
    await db
      .insert(schema.productVariant)
      .values({
        productId: p.id,
        name: "500 جرام",
        price: 380_00,
        stock: 3,
        image: "https://example.com/h.jpg",
        sortOrder: 0,
      })
      .returning()
  )[0];
  return { db, p, v };
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
  it("creates an order, decrements variant stock, stores variantName", async () => {
    const { db, v } = await buildDb();
    const result = await createOrder(db, [{ variantId: v.id, quantity: 2 }], customer, undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(380_00 * 2);
    expect(result.orderNumber).toMatch(/^HNY-\d{6}$/);

    const order = await db
      .select()
      .from(schema.order)
      .where(eq(schema.order.id, result.orderId))
      .get();
    expect(order?.number).toBe(result.orderNumber);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(1);
    const items = await db
      .select()
      .from(schema.orderItem)
      .where(eq(schema.orderItem.orderId, result.orderId));
    expect(items).toEqual([
      expect.objectContaining({
        productName: "عسل سدر مصري",
        variantName: "500 جرام",
        quantity: 2,
        unitPrice: 380_00,
      }),
    ]);
  });

  it("rejects an empty cart", async () => {
    const { db } = await buildDb();
    const result = await createOrder(db, [], customer);
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-stock and writes nothing", async () => {
    const { db, v } = await buildDb();
    const result = await createOrder(db, [{ variantId: v.id, quantity: 5 }], customer);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outOfStock).toContain("عسل سدر مصري");
    expect(await db.select().from(schema.order)).toEqual([]);
    const stock = await db
      .select()
      .from(schema.productVariant)
      .where(eq(schema.productVariant.id, v.id))
      .get();
    expect(stock?.stock).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- --run`
Expected: red (variant-based orders not implemented).

- [ ] **Step 3: Implement `src/lib/server/orders.ts`**

```ts
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { computeTotals } from "$lib/cart";
import type { CartLine } from "$lib/cart";
import { resolveCartItems } from "$lib/server/store";
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

  const items = await resolveCartItems(db, lines);
  if (items.length === 0) return { ok: false, message: "لا توجد منتجات متاحة", outOfStock: [] };

  const requested = new Map(lines.map((l) => [l.variantId, l.quantity]));
  const outOfStock = [
    ...new Set(items.filter((i) => (requested.get(i.variantId) ?? 0) > i.stock).map((i) => i.name)),
  ];
  if (outOfStock.length > 0) {
    return {
      ok: false,
      message: "نفدت الكمية لبعض المنتجات",
      outOfStock,
    };
  }

  const totals = computeTotals(items);
  const orderNumber = generateOrderNumber();
  const orderId = crypto.randomUUID();

  try {
    await db.transaction(async (tx) => {
      for (const item of items) {
        const requested = lines.find((l) => l.variantId === item.variantId)!.quantity;
        const updated = await tx
          .update(schema.productVariant)
          .set({ stock: sql`${schema.productVariant.stock} - ${item.quantity}` })
          .where(
            and(
              eq(schema.productVariant.id, item.variantId),
              gte(schema.productVariant.stock, requested),
            ),
          )
          .returning({ id: schema.productVariant.id });
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
          variantName: i.variantName,
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

- [ ] **Step 4: Update `src/routes/checkout/+page.server.ts` load**

Replace the product resolution block with variant resolution:

```ts
import { redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { db } from "$lib/server/db";
import { clearCartCookie, getCartSecret, readCartCookie } from "$lib/server/cart-cookie";
import { checkoutSchema, formatZodErrors } from "$lib/server/checkout-schema";
import { createOrder } from "$lib/server/orders";
import { resolveCartItems } from "$lib/server/store";
import { computeTotals } from "$lib/cart";
import type { Actions, PageServerLoad } from "./$types";

// ... keep CARD_FIELDS, shippingValues, CheckoutFail unchanged ...

export const load: PageServerLoad = async ({ cookies }) => {
  const lines = readCartCookie(cookies, getCartSecret(env));
  if (lines.length === 0) redirect(302, "/cart");
  const items = await resolveCartItems(db, lines);
  if (items.length === 0) redirect(302, "/cart");
  return { items, totals: computeTotals(items) };
};
```

(The `submit` action already passes `lines` to `createOrder`; no change needed there.)

- [ ] **Step 5: Run tests**

Run: `pnpm test:unit -- --run` and `pnpm check`
Expected: orders + store specs green; check clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/orders.ts src/lib/server/orders.spec.ts src/routes/checkout/+page.server.ts
git commit -m "feat(orders): variant-based order creation with variantName"
```

---

### Task 5: Product detail page — variant selector

**Files:**

- Modify: `src/routes/products/[slug]/+page.server.ts`, `src/routes/products/[slug]/+page.svelte`

**Interfaces:**

- Consumes: `getProductWithVariants`, `getRelatedProducts` (Task 3).
- Produces: page data `{ product: ProductSummary, related: ProductSummary[] }`; detail page renders a variant selector that updates `selectedVariant` (`ProductVariantSummary`) and adds the selected variant to the cart.

- [ ] **Step 1: Update `+page.server.ts`**

```ts
import { error } from "@sveltejs/kit";
import { getProductWithVariants, getRelatedProducts } from "$lib/server/store";
import { db } from "$lib/server/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const product = await getProductWithVariants(db, params.slug);
  if (!product) error(404, "المنتج غير موجود");
  const related = await getRelatedProducts(db, product, 4);
  return { product, related };
};
```

- [ ] **Step 2: Update `+page.svelte`** — rewrite the script + purchase area

Script:

```svelte
<script lang="ts">
  import Price from "$lib/components/Price.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import { addToCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let selectedVariant = $state(data.product.variants[0]);
  let quantity = $state(1);

  function selectVariant(id: string) {
    const v = data.product.variants.find((x) => x.id === id);
    if (v) {
      selectedVariant = v;
      quantity = 1;
    }
  }

  function handleAdd() {
    addToCart(
      {
        variantId: selectedVariant.id,
        productId: data.product.id,
        name: data.product.name,
        variantName: selectedVariant.name,
        slug: data.product.slug,
        image: selectedVariant.image,
        price: selectedVariant.price,
        stock: selectedVariant.stock,
      },
      quantity,
    );
  }
</script>
```

Replace the `<svelte:head>` title with `مملكة النحل — {data.product.name}`. In the image figure wrap the `<img>` in `{#key selectedVariant.id}` so the image crossfades on variant change:

```svelte
<div class="arch-frame-lg relative overflow-hidden border-4 border-gold-500/70 bg-ink-950 shadow-warm-lg">
  {#key selectedVariant.id}
    <img src={selectedVariant.image} alt={data.product.name} class="aspect-square h-full w-full object-cover motion-safe:animate-fade-up" />
  {/key}
</div>
```

Replace the price/stock block with variant-aware rendering:

```svelte
<div class="flex flex-wrap items-center gap-3">
  <Price amount={selectedVariant.price} className="rounded-full border border-gold-400 bg-ink-950 px-5 py-1.5 text-2xl font-extrabold text-gold-300 shadow-warm-sm" />
  {#if selectedVariant.stock === 0}
    <span class="badge-stock bg-red-100 text-red-700">نفدت الكمية</span>
  {:else}
    <span class="badge-stock border border-gold-400/40 bg-parchment text-cocoa-700">متوفر: {selectedVariant.stock} قطعة</span>
  {/if}
</div>
```

Insert the variant selector between the badge row and the description:

```svelte
{#if data.product.variants.length > 1}
  <div class="flex flex-wrap items-center gap-2" role="group" aria-label="اختيار الحجم">
    <span class="text-sm font-semibold text-cocoa-700">الحجم:</span>
    {#each data.product.variants as v (v.id)}
      <button
        type="button"
        class="chip"
        class:chip-active={selectedVariant.id === v.id}
        class:border-cocoa-200={selectedVariant.id !== v.id}
        class:bg-white={selectedVariant.id !== v.id}
        class:text-cocoa-700={selectedVariant.id !== v.id}
        disabled={v.stock === 0}
        onclick={() => selectVariant(v.id)}
      >
        {v.name}{v.stock === 0 ? " (نفد)" : ""}
      </button>
    {/each}
  </div>
{/if}
```

Replace the add-to-cart block condition `data.product.stock > 0` with `selectedVariant.stock > 0`, the picker `max={selectedVariant.stock}`, and the total line with `formatEGP(selectedVariant.price * quantity)`. Keep the button text **"أضف إلى السلة"** (test hook).

- [ ] **Step 3: Verify**

Run: `pnpm check` and `vp build`
Expected: 0 errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/routes/products/[slug]/+page.server.ts src/routes/products/[slug]/+page.svelte
git commit -m "feat(products): variant selector on product detail page"
```

---

### Task 6: Product cards + list + home — variant-aware

**Files:**

- Modify: `src/lib/components/ProductCard.svelte`, `src/lib/components/ProductCard.svelte.spec.ts`
- Modify: `src/routes/products/+page.server.ts` (works already via `listProducts`; verify only)
- `src/routes/products/+page.svelte` and `src/routes/+page.server.ts` get `ProductSummary[]` from Task 3 already.

**Interfaces:**

- Consumes: `ProductSummary`/`ProductVariantSummary` (Task 3).
- Produces: `ProductCard` prop `product: Pick<ProductSummary, "id" | "name" | "slug" | "image" | "variants" | "minPrice">`; card quick-add adds the cheapest in-stock variant; button disabled when every variant is out of stock.

- [ ] **Step 1: Write failing tests** — rewrite `src/lib/components/ProductCard.svelte.spec.ts`

```ts
import { page } from "vite-plus/test/browser";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import ProductCard from "./ProductCard.svelte";

const product = {
  id: "p1",
  name: "عسل سدر مصري",
  slug: "sidr-egyptian",
  image: "https://example.com/h.jpg",
  minPrice: 380_00,
  variants: [
    {
      id: "v1",
      name: "1 ك",
      price: 700_00,
      stock: 10,
      image: "https://example.com/h.jpg",
      sortOrder: 0,
    },
    {
      id: "v2",
      name: "500 جرام",
      price: 380_00,
      stock: 5,
      image: "https://example.com/h.jpg",
      sortOrder: 1,
    },
  ],
};

describe("ProductCard", () => {
  it("renders product name and min price", async () => {
    render(ProductCard, { product });
    await expect.element(page.getByText("عسل سدر مصري")).toBeInTheDocument();
    await expect.element(page.getByText(/ج\.م\./)).toBeInTheDocument();
  });

  it("shows out-of-stock state and disabled button when all variants are gone", async () => {
    const soldOut = {
      ...product,
      minPrice: 700_00,
      variants: [
        {
          id: "v1",
          name: "1 ك",
          price: 700_00,
          stock: 0,
          image: "https://example.com/h.jpg",
          sortOrder: 0,
        },
      ],
    };
    render(ProductCard, { product: soldOut });
    await expect.element(page.getByText("نفدت الكمية")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "غير متوفر" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit -- --run`
Expected: red (ProductCard still uses old props).

- [ ] **Step 3: Implement `src/lib/components/ProductCard.svelte`**

```svelte
<script lang="ts">
  import { addToCart } from "$lib/cart-store.svelte";
  import Price from "./Price.svelte";
  import type { ProductSummary, ProductVariantSummary } from "$lib/server/store";

  let { product }: { product: Pick<ProductSummary, "id" | "name" | "slug" | "image" | "variants" | "minPrice"> } = $props();

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const cheapestInStock = product.variants.find((v: ProductVariantSummary) => v.stock > 0);

  function handleAdd() {
    if (!cheapestInStock) return;
    addToCart({
      variantId: cheapestInStock.id,
      productId: product.id,
      name: product.name,
      variantName: cheapestInStock.name,
      slug: product.slug,
      image: cheapestInStock.image,
      price: cheapestInStock.price,
      stock: cheapestInStock.stock,
    });
  }
</script>

<section class="group flex flex-col overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-warm">
  <a href={`/products/${product.slug}`} class="relative block overflow-hidden bg-ink-950 p-2 pb-0">
    <div class="arch-frame relative aspect-[4/3] overflow-hidden border border-gold-500/40">
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-ink-950/25 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"></div>
    </div>
    {#if totalStock === 0}
      <span class="badge-stock absolute bottom-4 start-1/2 -translate-x-1/2 bg-ink-950/90 text-gold-200">نفدت الكمية</span>
    {:else if cheapestInStock && cheapestInStock.stock <= 5}
      <span class="badge-stock absolute bottom-4 start-1/2 -translate-x-1/2 bg-gold-600/95 text-ink-950">كمية محدودة</span>
    {/if}
  </a>
  <div class="flex flex-1 flex-col gap-2 p-4">
    <h2 class="headline text-lg leading-snug text-cocoa-900">{product.name}</h2>
    {#if product.variants.length > 1}
      <span class="text-xs font-semibold text-cocoa-400">{product.variants.length} أحجام متاحة</span>
    {/if}
    <div class="mt-auto flex items-center justify-between gap-2">
      <Price amount={product.minPrice} className="text-lg font-extrabold text-gold-700" />
      <button
        type="button"
        class="rounded-full bg-gold-600 px-4 py-2 text-sm font-semibold text-ink-950 shadow-warm-sm transition-all duration-300 hover:bg-gold-500 hover:shadow-warm disabled:cursor-not-allowed disabled:opacity-40"
        disabled={totalStock === 0}
        onclick={handleAdd}
      >
        {totalStock === 0 ? "غير متوفر" : "أضف للسلة"}
      </button>
    </div>
  </div>
</section>
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:unit -- --run` and `pnpm check`
Expected: ProductCard spec green; check clean. (`products/+page.svelte`, home, related, and drawer/cart pages now type-check against the new `ProductSummary`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ProductCard.svelte src/lib/components/ProductCard.svelte.spec.ts
git commit -m "feat(products): variant-aware product cards with min price"
```

---

### Task 7: Cart UI + checkout + success + orders — variant display

**Files:**

- Modify: `src/lib/components/CartDrawer.svelte`, `src/routes/cart/+page.svelte`, `src/routes/checkout/+page.svelte`, `src/routes/checkout/success/[id]/+page.svelte`, `src/routes/account/orders/+page.svelte`

**Interfaces:**

- Consumes: `CartItem` with `variantName` (Task 2); `orderItem.variantName` (Task 1).

- [ ] **Step 1: Cart drawer — `src/lib/components/CartDrawer.svelte`**

Change the `{#each}` key from `item.productId` to `item.variantId` and add the variant line under the name:

```svelte
{#each cartState.items as item (item.variantId)}
  <li class="flex gap-3 rounded-xl border border-cocoa-100 bg-parchment p-2.5 shadow-warm-sm">
    <a href={`/products/${item.slug}`} class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gold-500/40 bg-ink-950">
      <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
    </a>
    <div class="flex flex-1 flex-col gap-1.5">
      <a href={`/products/${item.slug}`} class="line-clamp-1 text-sm font-semibold text-cocoa-800 hover:text-gold-700">{item.name}</a>
      <span class="text-xs text-cocoa-500">{item.variantName}</span>
      <QuantityPicker value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.variantId, q)} />
      <button type="button" class="w-fit text-xs text-cocoa-400 transition hover:text-clay-600" onclick={() => removeFromCart(item.variantId)}>إزالة</button>
    </div>
    <Price amount={item.price * item.quantity} className="ms-auto self-start text-sm font-bold text-gold-800" />
  </li>
{/each}
```

- [ ] **Step 2: Cart page — `src/routes/cart/+page.svelte`**

Change the `{#each}` key to `item.variantId`; under the product name add `<span class="text-sm text-cocoa-500">{item.variantName} — {formatEGP(item.price)}</span>`; change `setQuantity(item.productId, q)` → `setQuantity(item.variantId, q)` and `removeFromCart(item.productId)` → `removeFromCart(item.variantId)`.

- [ ] **Step 3: Checkout page — `src/routes/checkout/+page.svelte`**

In the order summary `{#each data.items as item (item.variantId)}` and render the variant:

```svelte
<li class="flex justify-between gap-2 text-sm text-cocoa-700">
  <span class="line-clamp-1">{item.name} — {item.variantName} × {item.quantity}</span>
  <span class="font-semibold">{formatEGP(item.price * item.quantity)}</span>
</li>
```

- [ ] **Step 4: Success page — `src/routes/checkout/success/[id]/+page.svelte`**

Read the current file first; in the items list render `{item.productName} — {item.variantName}` instead of `{item.productName}` alone.

- [ ] **Step 5: Account orders — `src/routes/account/orders/+page.svelte`**

Read the current file first; where order items are rendered inside `{#each order.items as item}`, show `{item.productName} — {item.variantName}`. (Its `+page.server.ts` already returns `orders`; if items are not loaded per order, load them: after selecting orders, query `orderItem` with `inArray(orderItem.orderId, orders.map(o => o.id))` and group by `orderId`.)

- [ ] **Step 6: Verify**

Run: `pnpm check` and `vp build`
Expected: 0 errors; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/CartDrawer.svelte src/routes/cart/+page.svelte src/routes/checkout/+page.svelte "src/routes/checkout/success/[id]/+page.svelte" src/routes/account/orders/+page.svelte
git commit -m "feat(ui): variant names across cart, checkout, and order history"
```

---

### Task 8: Seed — the real catalog with researched prices and verified real photos

**Files:**

- Modify: `scripts/seed.ts`

**Interfaces:**

- Consumes: `schema.category`, `schema.product`, `schema.productVariant` (Task 1).
- Produces: 6 categories, 21 products, 43 variants; idempotent pruning of stale rows; products/categories/variants keyed by slug/id referenced by all routes and e2e.

- [ ] **Step 1: Verify every image URL is real, live, and an image**

Run for each URL in the pool (adjust pool per type below):

```bash
curl -sI -o /dev/null -w "%{http_code} %{content_type}\n" "<url>"
```

Expected for each: `200 image/*`. The pool (real honey photography, Unsplash CDN):

```ts
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
  nuts: "https://images.unsplash.com/photo-1606776226036-7b6cf0d5b8b7?q=80&w=1200&auto=format&fit=crop",
  pollen:
    "https://images.unsplash.com/photo-1587467107032-dc60c9601ccb?q=80&w=1200&auto=format&fit=crop",
  royal:
    "https://images.unsplash.com/photo-1584782930699-3f77b9f8064f?q=80&w=1200&auto=format&fit=crop",
};
```

Any URL that does **not** return `200 image/*` must be replaced from the remaining pool; if the pool is exhausted, run `websearch` for a real honey photograph URL, verify it with `curl -sI`, and use it. Every product type must end up with a verified real honey photo. Never ship a 404 image.

- [ ] **Step 2: Write the new `scripts/seed.ts`**

Full replacement (categories, products with variants, researched EGP qirsh prices, real photos, pruning):

```ts
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
  nuts: "https://images.unsplash.com/photo-1606776226036-7b6cf0d5b8b7?q=80&w=1200&auto=format&fit=crop",
  pollen:
    "https://images.unsplash.com/photo-1587467107032-dc60c9601ccb?q=80&w=1200&auto=format&fit=crop",
  royal:
    "https://images.unsplash.com/photo-1584782930699-3f77b9f8064f?q=80&w=1200&auto=format&fit=crop",
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
  await db.delete(schema.productVariant);

  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) categoryIds.set(c.slug, await upsertCategory(c.slug, c.name));
  for (const p of PRODUCTS) {
    const productId = await upsertProduct(p, categoryIds.get(p.category)!);
    for (let i = 0; i < p.variants.length; i += 1) {
      await upsertVariant(productId, p.variants[i], i);
    }
  }
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
```

- [ ] **Step 3: Reseed and verify counts**

Run: `pnpm run db:reset && pnpm run db:reset`
Expected: both runs print `Seeded 6 categories, 21 products, 43 variants` (idempotent).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): مملكة النحل catalog with 43 real variants and researched prices"
```

---

### Task 9: Brand rename + view transitions + Royal Kingdom theme foundation

**Files:**

- Modify: `src/app.html`, `src/routes/+layout.svelte`, `src/lib/components/Header.svelte`, `src/lib/components/Footer.svelte`
- Create: `src/lib/assets/favicon.svg` (replace existing)

**Interfaces:**

- Consumes: existing fonts, layout.css classes.
- Produces: brand "مملكة النحل" + tagline "عتمان الأصلي" in header/footer/titles; `startViewTransition` on client navigation.

- [ ] **Step 1: Favicon** — replace `src/lib/assets/favicon.svg` with a gold hexagon-bee mark:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path d="M16 1.5 30 9v14L16 30.5 2 23V9L16 1.5Z" fill="#1a1a13"/>
  <path d="M16 5.5 27.4 12v8L16 26.5 4.6 20v-8L16 5.5Z" fill="#e5a82e"/>
  <path d="M12 13h8M16 9.5v9" stroke="#1a1a13" stroke-width="1.8" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Titles** — `src/app.html`: replace the `<title>` (and any "بيت العسل") with `مملكة النحل | عتمان الأصلي`. In `src/routes/+layout.svelte` `<svelte:head><title>` do the same.

- [ ] **Step 3: View transitions** — in `src/routes/+layout.svelte` script add:

```ts
import { onNavigate } from "$app/navigation";

onNavigate((navigation) => {
  if (!document.startViewTransition) return;
  return new Promise((resolve) => {
    document.startViewTransition(async () => {
      resolve();
      await navigation.complete;
    });
  });
});
```

- [ ] **Step 4: Header wordmark** — in `src/lib/components/Header.svelte` replace the wordmark anchor with the brand + tagline:

```svelte
<a href="/" class="flex items-center gap-2 transition hover:opacity-90">
  <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 1.5 30 9v14L16 30.5 2 23V9L16 1.5Z" fill="#1a1a13"/>
    <path d="M16 5.5 27.4 12v8L16 26.5 4.6 20v-8L16 5.5Z" fill="#e5a82e"/>
    <path d="M12 13h8M16 9.5v9" stroke="#1a1a13" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
  <span class="leading-tight">
    <span class="wordmark block text-2xl text-gold-600">مملكة النحل</span>
    <span class="block text-[0.7rem] font-semibold tracking-widest text-cocoa-500">عتمان الأصلي</span>
  </span>
</a>
```

- [ ] **Step 5: Footer** — in `src/lib/components/Footer.svelte` replace "بيت العسل" brand block with the wordmark + tagline, and update any links/copy that reference "بيت العسل".

- [ ] **Step 6: Sweep for the old brand**

```bash
rg -n "بيت العسل" src/
```

Replace every remaining occurrence with the appropriate new copy (title, taglines, empty-state text, checkout success, etc.). **Do not** change Arabic product names.

- [ ] **Step 7: Verify**

Run: `pnpm check` and `vp build`
Expected: 0 errors; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/app.html src/routes/+layout.svelte src/lib/components/Header.svelte src/lib/components/Footer.svelte src/lib/assets/favicon.svg
git commit -m "feat(brand): مملكة النحل with عتمان الأصلي and view transitions"
```

---

### Task 10: Royal Kingdom design system — layout.css

**Files:**

- Modify: `src/routes/layout.css`

**Interfaces:**

- Consumes: Tailwind v4 theme (existing honey scale kept), fonts.
- Produces: tokens/classes used by every page/component: `--ink`/`--gold` palette classes (`bg-ink-*`, `text-gold-*`, `border-gold-*`, etc.), `.btn-gold`, `.btn-ink`, `.btn-outline`, `.field`, `.chip`, `.badge-stock`, `.arch-frame(-lg)`, `.headline`, `.wordmark`, `.rule-flourish`, `.honeycomb-bg`, `.dot-bg`, `.grain-bg`, `.paper-panel`, `@utility` animations (`animate-fade-up`, `animate-float`, `animate-drip`, `animate-shine`, `animate-marquee`), plus `::view-transition-*` styles.

- [ ] **Step 1: Extend the theme with ink/gold tokens**

In `layout.css`'s `@theme inline` add royal tokens (keeping the honey/cocoa/paper scale):

```css
--color-ink-950: #14140e;
--color-ink-900: #1c1b12;
--color-ink-800: #2a2820;
--color-gold-200: #f3d68c;
--color-gold-300: #ecc153;
--color-gold-400: #e5a82e;
--color-gold-500: #d18f1f;
--color-gold-600: #b87717;
--color-gold-700: #96600f;
--shadow-warm: 0 18px 40px -18px rgb(60 42 16 / 0.35);
--shadow-warm-sm: 0 8px 22px -12px rgb(60 42 16 / 0.35);
```

- [ ] **Step 2: Add the button/component classes**

```css
.btn-gold {
  @apply inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-400 to-gold-600 px-6 py-3 text-sm font-bold text-ink-950 shadow-warm-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-warm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40;
}
.btn-ink {
  @apply inline-flex items-center justify-center gap-2 rounded-full bg-ink-950 px-6 py-3 text-sm font-bold text-gold-300 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40;
}
.btn-outline {
  @apply inline-flex items-center justify-center gap-2 rounded-full border-2 border-gold-500 px-6 py-2.5 text-sm font-semibold text-gold-700 transition-all duration-300 hover:border-gold-600 hover:bg-gold-400/10 disabled:cursor-not-allowed disabled:opacity-40;
}
```

- [ ] **Step 3: Textures + view transition styles + animations**

Add `::view-transition-old(root) { animation: fade-out 0.18s ease; }`, `::view-transition-new(root) { animation: fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1); }`, and the `@utility` blocks for `animate-fade-up`, `animate-float`, `animate-drip`, `animate-shine`, `animate-marquee` (define matching `@keyframes` globally, e.g. `drip` = translateY gold blob, `shine` = background-position sweep, `marquee` = translateX loop for the ticker). Wrap them so the existing `prefers-reduced-motion` media query still neutralizes all animation/transition durations.

- [ ] **Step 4: Verify Tailwind compiles**

Run: `pnpm check` and `vp build`
Expected: 0 errors; build succeeds; no unknown-utility warnings.

- [ ] **Step 5: Commit**

```bash
git add src/routes/layout.css
git commit -m "feat(ui): royal kingdom design tokens and animations"
```

---

### Task 11: Svelte magic — reveal action, hero, marquee, stats, home sections

**Files:**

- Create: `src/lib/actions/reveal.svelte.ts`
- Modify: `src/routes/+page.svelte` (hero, marquee, count-ups, benefit rails, category storytelling), `src/routes/products/+page.svelte` (hero strip to royal theme + staggered grid), `src/lib/components/Footer.svelte` (dark royal footer)

**Interfaces:**

- Consumes: `ProductSummary`, `getFeaturedProducts` data (Task 3); layout.css classes (Task 10).
- Produces: home sections and animations listed in the spec.

- [ ] **Step 1: Reveal action — `src/lib/actions/reveal.svelte.ts`**

```ts
export function reveal(node: HTMLElement, opts: { delay?: number } = {}) {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  node.classList.add("reveal-hidden");
  if (opts.delay) node.style.transitionDelay = `${opts.delay}ms`;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        node.classList.add("reveal-visible");
        io.disconnect();
      }
    },
    { threshold: 0.12 },
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}
```

In `layout.css` add:

```css
.reveal-hidden {
  opacity: 0;
  transform: translateY(18px);
}
.reveal-visible {
  opacity: 1;
  transform: none;
  transition:
    opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 2: Home hero + marquee + stats — `src/routes/+page.svelte`**

Read the current file. Rewrite it to include (all Arabic copy, hooks preserved):

1. **Dark royal hero**: full-width `bg-ink-950` band with `honeycomb-bg`/floating hexagons, gold-drip SVG animation, the wordmark headline "مملكة النحل", subhead "من مناحلنا في مصر إلى بيتك — عسل نقي بلا إضافات", CTA buttons `btn-gold` ("تسوق الآن" → /products) and `btn-outline` ("اكتشف الأصناف" → /products#categories). Keep the existing `<h1>` containing the word "عسل" (e2e asserts `heading level 1` contains "عسل").
2. **Count-up stats** (three figures — أصناف/محافظات/عملاء) using a tiny count-up action: `use:countUp` with `data-count` on the numbers, defined inline in the page or `src/lib/actions/countup.svelte.ts` (IntersectionObserver + rAF easing to the target; respect reduced-motion by setting instantly).
3. **Marquee**: a `overflow-hidden` strip with a duplicated `<div class="animate-marquee ...">` ticker: "عسل طبيعي 100% • شحن لجميع المحافظات • دفع عند الاستلام • تغليف فاخر •".
4. **Category storytelling banners**: iterate `data.categories` (load them in `src/routes/+page.server.ts` via `getCategories`) as royal banners with `arch-frame`, gold overline, category name, and a short story line per category (e.g. "عسل السدر" → "من سفوح سيناء وجنوب الصعيد، أغلى أنواع العسل المصرية"), linking to `/products?category=<slug>`.
5. **Benefit rails**: three sections — "للمناعة والطاقة" (سدر، غذاء ملكات، بروبليس، حبة البركة)، "للعائلة والإفطار" (برسيم، موالح، بردقوش، شمع بالعسل)، "سناكات صحية" (مكسرات، عسل مكسرات) — each a horizontal `ProductCard` rail filtered from `data.featured`/`listProducts`.
6. **Featured grid** with staggered `use:reveal` and per-card `delay={i * 60}`.

- [ ] **Step 3: Products list hero + grid — `src/routes/products/+page.svelte`**

Restyle the top hero band to royal (`bg-ink-950`, gold accents, "مملكة النحل" overline), keep the search/sort/filter controls, and add `use:reveal` with `delay={i * 40}` to the product grid items. Keep the empty-state text and "لا توجد منتجات مطابقة لبحثك" behavior.

- [ ] **Step 4: Footer — `src/lib/components/Footer.svelte`**

Restyle to `bg-ink-950 text-cocoa-300`, gold wordmark + tagline, trust line "من مناحلنا إلى بيتك — عتمان الأصلي", quick links, and the payment-free shipping note.

- [ ] **Step 5: Verify**

Run: `pnpm check`, `pnpm test:unit -- --run`, `vp build`
Expected: 0 errors; unit green; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions src/routes/+page.svelte src/routes/+page.server.ts src/routes/products/+page.svelte src/routes/layout.css src/lib/components/Footer.svelte
git commit -m "feat(ui): svelte magic hero, marquee, stats, and reveals"
```

---

### Task 12: E2E — variant checkout flow

**Files:**

- Modify: `src/routes/store.e2e.ts`

**Interfaces:**

- Consumes: seeded catalog (Task 8) — product "عسل سدر مصري" (slug `sidr-egyptian`) with a "500 جرام" variant; header cart button aria-label "فتح سلة التسوق"; drawer "إتمام الشراء" link; checkout labels; order number `HNY-`.

- [ ] **Step 1: Rewrite `src/routes/store.e2e.ts`**

```ts
import { expect, test } from "@playwright/test";

test("guest browses, picks a variant, checks out", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("عسل");

  await page.getByRole("link", { name: "المتجر" }).first().click();
  await expect(page).toHaveURL(/\/products/);

  await page.getByRole("link", { name: "عسل سدر مصري" }).first().click();
  await expect(page).toHaveURL(/\/products\/sidr-egyptian/);

  await page.getByRole("button", { name: "500 جرام" }).click();
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.getByRole("button", { name: "فتح سلة التسوق" }).click();
  await expect(page.getByTestId("cart-drawer")).toBeVisible();
  await expect(page.getByTestId("cart-drawer")).toContainText("عسل سدر مصري");

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
  await expect(page.getByTestId("cart-count")).toBeHidden();
  await expect(page.getByTestId("order-number")).toBeVisible();
  const number = await page.getByTestId("order-number").textContent();
  expect(number).toMatch(/^HNY-\d{6}$/);
});

test("checkout shows validation errors for bad input", async ({ page }) => {
  await page.goto("/products/sidr-egyptian");
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.goto("/checkout");

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page.getByText("رقم هاتف مصري غير صالح")).toBeVisible();
  await expect(page.getByText("بريد إلكتروني غير صالح")).toBeVisible();
});
```

- [ ] **Step 2: Run the full suite**

Run: `pnpm test:e2e`
Expected: 2/2 passing (webserver runs `db:reset` + `build` + `preview` itself).

- [ ] **Step 3: Commit**

```bash
git add src/routes/store.e2e.ts
git commit -m "test(e2e): variant checkout flow"
```

---

### Task 13: Quality gate + docs + final commit

**Files:**

- Modify: `docs/decisions.md`
- Possibly: any file the gate surfaces.

- [ ] **Step 1: Run the full quality gate**

```bash
pnpm check
pnpm test:unit -- --run
pnpm test:e2e
```

Expected: `svelte-check` 0 errors/0 warnings; all unit tests green (cart, cart-cookie, currency, orders, store, ProductCard); e2e 2/2. Fix anything that fails before continuing (do not claim done on failures).

- [ ] **Step 2: Verify no debug leftovers**

```bash
rg -n "console\.log|debugger|TODO|FIXME" src/ scripts/ || true
```

Expected: no matches (the seed's `console.log` of counts is intentional).

- [ ] **Step 3: Update `docs/decisions.md`**

Add two ADRs (newest last): (1) **2026-08-14: Variant product model** — `store_product_variant`, variant-keyed cart/orders, `variantName` on order items, seed pruning, real researched EGP prices. (2) **2026-08-14: Royal Kingdom brand & UI** — مملكة النحل / عتمان الأصلي, ink+gold theme over parchment, view transitions + reveal/marquee/count-up animations, real honey photography per line.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions.md
git commit -m "docs: ADRs for variant model and royal kingdom redesign"
```

---

## Self-Review notes

- **Spec coverage:** variant schema (Task 1), variant cart/checkout/orders (Tasks 2–4), variant selector (Task 5), cards/lists/home (Tasks 6, 11), cart/success/orders display (Task 7), catalog + prices + images (Task 8), brand + view transitions (Task 9), royal theme (Task 10), animations (Task 11), e2e (Task 12), gate + docs (Task 13). Every spec section maps to a task.
- **Type consistency:** `CartLine { variantId }` / `CartItem { variantId, productId, name, variantName, slug, image, price, stock }` are defined in Task 2 and used identically in Tasks 3–7; `ProductSummary`/`ProductVariantSummary`/`minPrice` defined in Task 3 and consumed in Tasks 5–6, 11; `schema.productVariant`/`orderItem.variantName` defined in Task 1 and consumed in Tasks 3–4, 7–8. `getProductWithVariants` (Task 3) is consumed by Task 5. No name drift.
- **Placeholder scan:** all steps carry concrete code; the only run-time decision is image-URL verification (Step 8.1), which has an explicit fallback procedure. Prices are embedded as concrete qirsh values from 2026 Egyptian market research (برسيم 1ك 220–250ج، سدر 1ك 700ج، موالح 1ك 230–240ج، حبة البركة 1ك 380ج، بردقوش 1ك 330ج).
