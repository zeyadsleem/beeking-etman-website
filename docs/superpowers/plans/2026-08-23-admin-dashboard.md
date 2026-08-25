# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protected `/admin` dashboard managing orders (status lifecycle + cancel-restock), products/variants/categories CRUD with R2 image uploads, and a stats dashboard.

**Architecture:** Route group inside the existing SvelteKit app guarded server-side by better-auth's `admin()` plugin role. Server logic in focused services under `src/lib/server/admin/`, each with a colocated vitest spec. Uploads go through form actions into an R2 binding.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, better-auth 1.7 (`admin` plugin), drizzle-orm + D1/libsql, zod v4, Tailwind 4, vitest (`vite-plus/test`), Playwright, Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-08-23-admin-dashboard-design.md`

## Global Constraints

- TypeScript strict mode; no `any`; explicit return types on exported/shared functions.
- zod validation at every boundary (form actions, service inputs).
- Prices are integers in qirsh (1 EGP = 100 qirsh); render via `formatEGP` from `$lib/currency`.
- i18n: every user-facing string is a flat key present in BOTH `ar` and `en` objects in `src/lib/i18n/messages.ts`; read via `t(lang, key)`.
- Unit tests import from `vite-plus/test`; DB tests build a file-backed libsql database whose DDL mirrors the production migrations (pattern of `src/lib/server/addresses.spec.ts`); services take `db` as their first argument.
- Conventional commits: `type(scope): subject` with scope `admin`.
- Never commit secrets; `ADMIN_EMAIL` / `MEDIA_PUBLIC_BASE_URL` live only in env.
- `sveltekitCookies` must remain the LAST plugin in the better-auth plugins array.
- Quality gate before claiming any task done: `pnpm run check` + affected unit suites green.

---

### Task 1: Admin plugin wiring + migration 0008

**Files:**

- Modify: `src/lib/server/auth.ts`
- Regenerate: `src/lib/server/db/auth.schema.ts`
- Create (generated): `drizzle/0008_*.sql` via drizzle-kit
- Modify: `src/app.d.ts`

**Interfaces:**

- Consumes: existing `auth` export shape.
- Produces: `session.user.role: string` available to all server code via inferred types; `user` table columns `role/banned/ban_reason/ban_expires/impersonated_by`.

- [ ] **Step 1: Add the admin plugin**

In `src/lib/server/auth.ts` add to imports:

```ts
import { admin } from "better-auth/plugins";
```

Insert `admin(),` as the FIRST entry of the `plugins` array (before `sveltekitCookies(...)`).

- [ ] **Step 2: Regenerate the auth schema**

Run: `pnpm run auth:schema`
Expected: `src/lib/server/db/auth.schema.ts` now includes `role`, `banned`, `banReason`, `banExpires`, `impersonatedBy` fields on `user`. Do not hand-edit the file.

- [ ] **Step 3: Generate and apply migration 0008**

Run: `pnpm run db:generate && pnpm run db:migrate`
Expected: new `drizzle/0008_*.sql` containing `ALTER TABLE user ADD COLUMN role TEXT NOT NULL DEFAULT 'user'` plus the other four columns; applied locally without error.

- [ ] **Step 4: Type locals from the real auth instance**

In `src/app.d.ts` replace the better-auth type imports and Locals block:

```ts
import type { auth } from "$lib/server/auth";

type AuthSession = typeof auth.$Infer.Session;
```

and inside `namespace App`:

```ts
interface Locals {
  user?: AuthSession["user"];
  session?: AuthSession["session"];
}
```

Keep everything else in the file unchanged.

- [ ] **Step 5: Typecheck**

Run: `pnpm run check`
Expected: PASS (no consumers of `.role` exist yet).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/auth.ts src/lib/server/db/auth.schema.ts drizzle/0008_*.sql drizzle/meta src/app.d.ts
git commit -m "feat(admin): better-auth admin plugin + user role columns"
```

---

### Task 2: ADMIN_EMAIL bootstrap promotion

**Files:**

- Create: `src/lib/server/admin/bootstrap.ts`
- Test: `src/lib/server/admin/bootstrap.spec.ts`
- Modify: `src/routes/login/+page.server.ts`

**Interfaces:**

- Produces:
  - `promoteAdminByEmail(db: LibSQLDatabase<typeof schema>, email: string): Promise<boolean>` — returns true if a row was promoted; no-op when `ADMIN_EMAIL` unset or mismatched.
  - `isAdminEmail(email: string): boolean` — case-insensitive compare against `env.ADMIN_EMAIL`.

- [ ] **Step 1: Write the failing test**

`src/lib/server/admin/bootstrap.spec.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { existsSync, unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";

let savedAdminEmail: string | undefined;

const DB_FILE = "admin-bootstrap-test.db";

async function buildDb() {
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS user`);
  await db.run(`CREATE TABLE user (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0, image TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT, ban_expires INTEGER, impersonated_by TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  return db;
}

async function seedUser(db: ReturnType<typeof buildDb>, email: string, role = "user") {
  const id = crypto.randomUUID();
  await db.insert(schema.user).values({
    id,
    name: "Owner",
    email,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

describe("promoteAdminByEmail", () => {
  beforeEach(() => {
    savedAdminEmail = process.env.ADMIN_EMAIL;
    if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
  });

  afterAll(() => {
    if (savedAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = savedAdminEmail;
    if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
  });

  it("promotes the matching user case-insensitively", async () => {
    process.env.ADMIN_EMAIL = "Owner@Beeking.com";
    const db = await buildDb();
    await seedUser(db, "owner@beeking.com");
    const { promoteAdminByEmail } = await import("./bootstrap");
    expect(await promoteAdminByEmail(db, "OWNER@beeking.com")).toBe(true);
    const row = await db.select().from(schema.user).get();
    expect(row?.role).toBe("admin");
  });

  it("is a no-op when emails differ or ADMIN_EMAIL is unset", async () => {
    delete process.env.ADMIN_EMAIL;
    const db = await buildDb();
    await seedUser(db, "owner@beeking.com");
    const { promoteAdminByEmail } = await import("./bootstrap");
    expect(await promoteAdminByEmail(db, "owner@beeking.com")).toBe(false);
    expect((await db.select().from(schema.user).get())?.role).toBe("user");
  });

  it("returns false for unknown users without throwing", async () => {
    process.env.ADMIN_EMAIL = "owner@beeking.com";
    const db = await buildDb();
    const { promoteAdminByEmail } = await import("./bootstrap");
    expect(await promoteAdminByEmail(db, "ghost@beeking.com")).toBe(false);
  });
});
```

Note: `process.env.ADMIN_EMAIL` works in vitest because `$env/dynamic/private` reads Node env at runtime; the module reads it lazily inside each call (never at import time).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- --run src/lib/server/admin/bootstrap.spec.ts`
Expected: FAIL (module `./bootstrap` does not exist).

- [ ] **Step 3: Implement `src/lib/server/admin/bootstrap.ts`**

```ts
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { env } from "$env/dynamic/private";
import * as schema from "$lib/server/db/schema";

export function isAdminEmail(email: string): boolean {
  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(adminEmail) && email.trim().toLowerCase() === adminEmail;
}

export async function promoteAdminByEmail(
  db: LibSQLDatabase<typeof schema>,
  email: string,
): Promise<boolean> {
  if (!isAdminEmail(email)) return false;
  const result = await db
    .update(schema.user)
    .set({ role: "admin" })
    .where(eq(schema.user.email, email.trim().toLowerCase()))
    .run();
  return result.rowsAffected > 0;
}
```

If the generated `user.email` column has a unique constraint (it does), the direct lowercase update is safe. If drizzle typing rejects `.run()` rowsAffected access, use the driver result shape actually returned and assert count accordingly.

- [ ] **Step 4: Wire into login action**

In `src/routes/login/+page.server.ts`, after the successful `await auth.api.signInEmail(...)` and BEFORE `redirect(302, "/account")`:

```ts
import { promoteAdminByEmail } from "$lib/server/admin/bootstrap";

await promoteAdminByEmail(db, email);
```

(`db` is already imported there.)

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm run test:unit -- --run src/lib/server/admin/bootstrap.spec.ts && pnpm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/admin/bootstrap.ts src/lib/server/admin/bootstrap.spec.ts src/routes/login/+page.server.ts
git commit -m "feat(admin): promote ADMIN_EMAIL user to admin on sign-in"
```

---

### Task 3: /admin guard layout + header link

**Files:**

- Create: `src/routes/admin/+layout.server.ts`
- Modify: `src/lib/components/Header.svelte` (both desktop ~line 130 and mobile menu ~line 242 blocks)

**Interfaces:**

- Consumes: `event.locals.user?.role` (Task 1), Header prop `user`.
- Produces: every route under `/admin` requires an admin session; `data.user.role` reaches the layout component.

- [ ] **Step 1: Guard layout**

`src/routes/admin/+layout.server.ts`:

```ts
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = (event) => {
  if (event.locals.user?.role !== "admin") redirect(302, "/login");
  return { user: event.locals.user };
};
```

- [ ] **Step 2: Placeholder dashboard page (replaced in Task 13)**

`src/routes/admin/+page.svelte`:

```svelte
<script lang="ts">
  let { data }: { data: { user: { name?: string | null } | null } } = $props();
</script>

<svelte:head><title>الأدمن</title></svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <h1 class="text-2xl font-bold text-cocoa-900">لوحة الأدمن</h1>
  <p class="mt-2 text-sm text-cocoa-700">مرحباً {data.user?.name}</p>
</section>
```

- [ ] **Step 3: Widen Header user prop + add admin links**

In `Header.svelte` change the prop type to:

```ts
user?: { name?: string | null; role?: string | null } | null;
```

Desktop block (inside `{#if user}` near line 130), add BEFORE the account anchor so it appears first:

```svelte
{#if user.role === "admin"}
  <a href="/admin" aria-label={t(lang, "nav.admin")} class="...same classes as the account link...">
    <span class="max-w-28 truncate text-sm font-semibold">{t(lang, "nav.admin")}</span>
  </a>
{/if}
```

Mobile block (inside `{#if user}` near line 242), same condition with the mobile link classes copied from the account link there, plus `onclick={closeMobile}`.

Add i18n keys to BOTH language objects in `src/lib/i18n/messages.ts`: `"nav.admin": "الأدمن"` (ar) / `"nav.admin": "Admin"` (en).

- [ ] **Step 4: E2E guard check**

Append to an existing Playwright spec file or create `tests/admin-guard.e2e.ts` following `playwright.config.ts` conventions used by `src/routes/store.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

test("non-admin is redirected from /admin to /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
```

Run: `pnpm run test:e2e -- --grep "redirected from /admin"`
Expected: PASS (unauthenticated request redirected).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm run check`

```bash
git add src/routes/admin src/lib/components/Header.svelte src/lib/i18n/messages.ts tests
git commit -m "feat(admin): guarded /admin layout + header entry link"
```

---

### Task 4: Admin orders service (transitions + cancel restock)

**Files:**

- Create: `src/lib/server/admin/orders.ts`
- Test: `src/lib/server/admin/orders.spec.ts`

**Interfaces:**

- Produces (consumed by Tasks 5–6):

```ts
export const ORDER_STATUSES = ["paid", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export function parseOrderStatus(value: string): OrderStatus | null;
export function allowedTransitions(status: OrderStatus): readonly OrderStatus[];
export interface AdminOrderRow {
  id: string;
  number: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  total: number;
  status: OrderStatus;
  createdAt: number;
}
export interface AdminOrderItemRow {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
}
export const ORDERS_PAGE_SIZE = 20;
export async function listOrders(
  db: LibSQLDatabase<typeof schema>,
  opts?: { status?: OrderStatus; page?: number },
): Promise<{ items: AdminOrderRow[]; total: number }>;
export async function getOrderWithItems(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<{ order: AdminOrderRow; items: AdminOrderItemRow[] } | null>;
export type TransitionResult =
  { ok: true } | { ok: false; reason: "not_found" | "invalid_transition" };
export async function transitionOrderStatus(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  next: OrderStatus,
): Promise<TransitionResult>;
```

Transition matrix (from spec): `paid → shipped|cancelled`; `shipped → delivered|cancelled`; `delivered` and `cancelled` terminal.

Cancel restock nuance (verified against `createOrder`): `order_item` rows carry `productId` + `variantName` but NOT the variant id. Restock resolves each item's variant through the unique index `store_product_variant(product_id, name)`; items whose variant no longer matches are skipped with `console.warn("[transitionOrderStatus] restock skipped", ...)`.

- [ ] **Step 1: Write the failing tests**

Build the test DB mirroring production DDL for `store_order`, `store_order_item`, `store_product`, `store_product_variant` (copy column lists from `drizzle/0007` era schema files / `src/lib/server/db/schema.ts`). Tests must cover:

1. `parseOrderStatus` accepts the four values, rejects others.
2. `allowedTransitions` returns exactly the matrix above (terminal statuses → empty).
3. `listOrders` returns newest-first, filters by status, paginates (seed 25 orders, page 2 has 5).
4. `getOrderWithItems` returns order + its items; null for unknown id.
5. `transitionOrderStatus` paid→shipped succeeds and persists.
6. paid→delivered rejected with `invalid_transition`; delivered→anything rejected; cancelled→anything rejected.
7. Unknown order id → `not_found`.
8. paid→cancelled restores stock: seed product P with variants V1(name "250g", stock 0) and V2(name "1kg", stock 3); order items (P,V1,q=4),(P,V2,q=2); after transition V1.stock===4, V2.stock===5.
9. Double cancel: cancelled→cancelled rejected `invalid_transition` and stock NOT restored twice.
10. Cancel with a missing variant (item references variantName that doesn't exist) still succeeds; remaining variant restocked; warn logged (assert via `vi.spyOn(console, "warn")`).

Key restock implementation sketch (adjust to compile):

```ts
if (next === "cancelled") {
  const items = await db
    .select()
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, orderId))
    .all();
  const variants = await db
    .select({
      id: schema.productVariant.id,
      productId: schema.productVariant.productId,
      name: schema.productVariant.name,
    })
    .from(schema.productVariant)
    .all();
  const byKey = new Map(variants.map((v) => [`${v.productId}::${v.name}`, v.id]));
  for (const item of items) {
    const variantId = byKey.get(`${item.productId}::${item.variantName}`);
    if (!variantId) {
      console.warn("[transitionOrderStatus] restock skipped", {
        productId: item.productId,
        variantName: item.variantName,
      });
      continue;
    }
    statements.push(
      db
        .update(schema.productVariant)
        .set({ stock: sql`${schema.productVariant.stock} + ${item.quantity}` })
        .where(eq(schema.productVariant.id, variantId)),
    );
  }
}
// Guarded status flip prevents double-cancel races even under concurrency:
statements.unshift(
  db
    .update(schema.order)
    .set({ status: next })
    .where(and(eq(schema.order.id, orderId), eq(schema.order.status, current))),
);
await retryBusy(() => db.batch(statements));
```

Reuse `isBusyError`/`sleep`/`SQLITE_BUSY_RETRIES` from `$lib/server/sqlite` for the retry wrapper (same loop shape as `compensateLostStockRace`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit -- --run src/lib/server/admin/orders.spec.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/server/admin/orders.ts`** per the interfaces above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- --run src/lib/server/admin/orders.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/admin/orders.ts src/lib/server/admin/orders.spec.ts
git commit -m "feat(admin): orders service with status transitions and cancel restock"
```

---

### Task 5: Orders list page

**Files:**

- Modify: `src/lib/i18n/messages.ts`
- Create: `src/routes/admin/orders/+page.server.ts`, `+page.svelte`

**Interfaces:**

- Consumes: `listOrders`, `ORDER_STATUSES`, `ORDERS_PAGE_SIZE`, `formatEGP`, `formatDate`.

- [ ] **Step 1: i18n keys (ar/en both)**

`"admin.orders.title": "إدارة الطلبات"/"Manage orders"`, `"admin.orders.all": "الكل"/"All"`,
`"admin.orders.paid": "مدفوع"/"Paid"`, `"admin.orders.shipped": "تم الشحن"/"Shipped"`,
`"admin.orders.delivered": "تم التسليم"/"Delivered"`, `"admin.orders.cancelled": "ملغي"/"Cancelled"`,
`"admin.orders.total": "الإجمالي"/"Total"`, `"admin.orders.customer": "العميل"/"Customer"`,
`"admin.orders.empty": "لا توجد طلبات."/""No orders."`, `"admin.orders.next": "التالي"/"Next"`,
`"admin.orders.prev": "السابق"/"Prev"`, reuse existing `"orders.unknown"`.

- [ ] **Step 2: Load function**

```ts
export const load: PageServerLoad = async (event) => {
  const statusParam = event.url.searchParams.get("status");
  const status = statusParam ? parseOrderStatus(statusParam) : undefined;
  const page = Math.max(1, Number(event.url.searchParams.get("page")) || 1);
  const lang = getLang(event);
  const { items, total } = await listOrders(db, { status, page });
  return { items, total, page, status: status ?? null, lang };
};
```

- [ ] **Step 3: Page markup**

Filter chips as GET links (`?status=paid` etc., active chip styled like existing category chips on the products listing). Table/list reusing the account orders list card style: order number, date via `formatDate(lang, row.createdAt)`, customer name+phone+city, total via `formatEGP(row.total, lang)`, status badge colored per status (paid=honey, shipped=blue-ish neutral, delivered=green tone, cancelled=muted red — match palette tokens already used in the project). Pagination prev/next links preserving the status param; hide prev on page 1, hide next when `page * ORDERS_PAGE_SIZE >= total`.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm run check`

```bash
git add src/routes/admin/orders src/lib/i18n/messages.ts
git commit -m "feat(admin): orders list with status filter and pagination"
```

---

### Task 6: Order detail + status actions

**Files:**

- Modify: `src/lib/i18n/messages.ts`
- Create: `src/routes/admin/orders/[id]/+page.server.ts`, `+page.svelte`

**Interfaces:**

- Consumes: `getOrderWithItems`, `transitionOrderStatus`, `allowedTransitions`.

- [ ] **Step 1: i18n keys**

`"admin.order.details": "تفاصيل الطلب"/"Order details"`,
`"admin.order.markShipped": "تعليم كمشحون"/"Mark shipped"`,
`"admin.order.markDelivered": "تعليم كمسلّم"/"Mark delivered"`,
`"admin.order.cancel": "إلغاء الطلب"/"Cancel order"`,
`"admin.order.invalidTransition": "لا يمكن تنفيذ هذا الانتقال"/"This transition is not allowed"`,
`"admin.order.updated": "تم تحديث حالة الطلب"/"Order updated"`, back-link label.

- [ ] **Step 2: Load + actions**

Load: `getOrderWithItems(db, params.id)` → `error(404)` when null; also pass `allowedTransitions(order.status)`.

Actions (single `?/update`):

```ts
export const actions: Actions = {
  update: async (event) => {
    if (event.locals.user?.role !== "admin")
      return fail(403, { message: t(getLang(event), "errors.unexpected") });
    const form = await event.request.formData();
    const id = String(form.get("id") ?? "");
    const nextRaw = String(form.get("status") ?? "");
    const next = parseOrderStatus(nextRaw);
    if (!next) return fail(400, { message: t(getLang(event), "errors.unexpected") });
    const result = await transitionOrderStatus(db, id, next);
    if (!result.ok)
      return fail(409, { message: t(getLang(event), "admin.order.invalidTransition") });
    return { success: t(getLang(event), "admin.order.updated") };
  },
};
```

(The explicit role re-check is defense-in-depth per the spec — layout guards do not cover POSTs.)

- [ ] **Step 3: Page markup**

Layout mirrors `/account/orders/[id]` (number + date, customer/shipping block, items table with `formatEGP`, total row) plus an actions bar rendering one mini-form per allowed transition (`<form method="POST" action="?/update">` with hidden `id` + `status` inputs). Cancel button styled destructive; delivered/cancelled terminal states render no buttons. Success/error surfaced via the project's alert pattern used on the profile page.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm run check`

```bash
git add src/routes/admin/orders/[id] src/lib/i18n/messages.ts
git commit -m "feat(admin): order detail with legal status transitions"
```

---

### Task 7: Categories service + page

**Files:**

- Create: `src/lib/server/admin/categories.ts`, `src/routes/admin/categories/+page.server.ts`, `+page.svelte`
- Test: `src/lib/server/admin/categories.spec.ts`
- Modify: `src/lib/i18n/messages.ts`, `src/routes/admin/+page.svelte` (nav links list added in Task 9 step 5 — skip here if not yet present)

**Interfaces:**

- Produces:

```ts
export const categoryInputSchema: z.ZodType<{ name: string; nameEn: string; slug: string }>;
// name: 1..120 chars; nameEn default ""; slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ max 120, auto-slugged from nameEn/name when blank
export async function listCategoriesWithCounts(
  db: LibSQLDatabase<typeof schema>,
): Promise<Array<{ id: string; name: string; nameEn: string; slug: string; productCount: number }>>;
export type CategoryWriteResult = { ok: true; id: string } | { ok: false; reason: "slug_taken" };
export async function upsertCategory(
  db: LibSQLDatabase<typeof schema>,
  input: { id?: string; name: string; nameEn: string; slug: string },
): Promise<CategoryWriteResult>;
export type CategoryDeleteResult =
  { ok: true } | { ok: false; reason: "not_found" | "has_products" };
export async function deleteCategory(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<CategoryDeleteResult>;
```

- [ ] **Step 1: Failing tests** — file DB with `store_category` + `store_product` DDL; cover: schema rejects bad slug/empty name; auto-slug generation (`"Sidr Honey!"` → `sidr-honey`); duplicate slug → `slug_taken`; update keeps own slug unique-check excluding self; delete blocked when productCount > 0; delete succeeds otherwise.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement** (slug helper local to this module; uniqueness via select-before-write).
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5: Page** — i18n keys `admin.categories.*` (title/new/edit/save/delete/count/slug/nameEn/confirmDelete/hasProductsError). List table with product counts; inline add/edit form posting `?/save` (zod-parse in action, `fail(400)` on error); delete posts `?/delete`, renders `fail(409)` message when `has_products`.
- [ ] **Step 6:** `pnpm run check`, then commit `feat(admin): categories management`.

---

### Task 8: Products service

**Files:**

- Create: `src/lib/server/admin/products.ts`
- Test: `src/lib/server/admin/products.spec.ts`

**Interfaces:**

- Produces:

```ts
export const productInputSchema: z.ZodType<ProductInput>;
export interface ProductInput {
  name: string; // 1..200
  nameEn: string; // default ""
  description: string; // 1..5000
  descriptionEn: string; // default ""
  price: number; // int > 0 (qirsh)
  categoryId: string;
  featured: boolean; // default false
}
export const variantInputSchema: z.ZodType<VariantInput>;
export interface VariantInput {
  name: string; // 1..80, unique per product (existing unique index)
  nameEn: string; // default ""
  price: number; // int > 0
  stock: number; // int >= 0
  image: string; // URL string, default ""
  sortOrder: number; // int, default 0
}
export const PRODUCTS_PAGE_SIZE = 20;
export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  price: number;
  featured: boolean;
  categoryName: string;
  totalStock: number;
  variantCount: number;
  createdAt: number;
}
export async function listAdminProducts(
  db: LibSQLDatabase<typeof schema>,
  opts?: { query?: string; page?: number },
): Promise<{ items: AdminProductRow[]; total: number }>; // query matches name/nameEn LIKE, escaped %_
export async function getProductForEdit(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<{
  product: AdminProductRow & { description: string; descriptionEn: string };
  variants: Array<VariantInput & { id: string }>;
} | null>;
export type ProductWriteResult =
  { ok: true; id: string } | { ok: false; reason: "slug_taken" | "category_missing" };
export function generateSlug(source: string): string; // lowercase ascii-fold fallback, non-[a-z0-9]+→"-", trim "-", "" → "product"; caller appends -2/-3 on conflict
export async function createProduct(
  db: LibSQLDatabase<typeof schema>,
  input: ProductInput,
  slug: string,
): Promise<ProductWriteResult>;
export async function updateProduct(
  db: LibSQLDatabase<typeof schema>,
  id: string,
  input: ProductInput,
  slug: string,
): Promise<ProductWriteResult>;
export type ProductDeleteResult =
  { ok: true } | { ok: false; reason: "not_found" | "referenced_by_orders" };
export async function deleteProduct(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<ProductDeleteResult>;
export type VariantWriteResult =
  { ok: true; id: string } | { ok: false; reason: "name_taken" | "product_missing" };
export async function upsertVariant(
  db: LibSQLDatabase<typeof schema>,
  productId: string,
  input: VariantInput & { id?: string },
): Promise<VariantWriteResult>;
export async function deleteVariant(
  db: LibSQLDatabase<typeof schema>,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }>;
```

Slug conflict resolution: on insert/update, probe `generateSlug(input)` then while taken append `-2`, `-3`… (max 20 probes) — EXCEPT update keeps the product's existing slug when the caller passes the same base.

- [ ] **Step 1: Failing tests** — file DB with `store_category`, `store_product`, `store_product_variant`, `store_order`, `store_order_item` DDL. Cover: schema bounds; `generateSlug` cases ("عسل السدر"→`product`, "Sidr Honey!"→`sidr-honey`, "Mixed--Nuts 500g"→`mixed-nuts-500g`); create assigns auto-slug with `-2` suffix on conflict; category_missing; update slug_taken; delete blocked when referenced by order_item; delete cascades variants otherwise; variant unique-name rejection per product but same name allowed across products; stock zero allowed, negative rejected; listAdminProducts search + pagination + totals.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement.** Total stock = `SUM(product_variant.stock)` grouped; featured stored via the existing integer column (`featured: input.featured ? 1 : 0`). Delete flow: check `orderItem` reference first, then batch-delete images → variants → product.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5: Commit** `feat(admin): products service with slugs, variants, delete guards`.

---

### Task 9: Upload validation + R2 binding

**Files:**

- Create: `src/lib/server/admin/upload.ts`
- Test: `src/lib/server/admin/upload.spec.ts`
- Modify: `wrangler.jsonc`, `src/app.d.ts`, `src/lib/i18n/messages.ts`

**Interfaces:**

- Produces:

```ts
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type DetectedImage = {
  ext: "jpg" | "png" | "webp";
  mime: "image/jpeg" | "image/png" | "image/webp";
};
export function detectImageType(bytes: Uint8Array): DetectedImage | null;
// jpeg: FF D8 FF; png: 89 50 4E 47 0D 0A 1A 0A; webp: "RIFF"???? "WEBP"
export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: "too_large" | "unsupported" | "storage_unavailable" };
export async function saveProductImage(
  bucket: { put(key: string, value: ReadableStream | ArrayBuffer): Promise<unknown> },
  publicBase: string | undefined,
  file: File,
): Promise<UploadResult>;
// key = `products/${crypto.randomUUID()}.${ext}`; url = `${publicBase}/${key}`
```

- [ ] **Step 1: Failing tests** — pure-function tests with hand-built byte arrays (valid jpeg/png/webp headers, truncated/garbage bytes); `saveProductImage` with a fake bucket capturing `put` calls and a fake 6-byte "file" via `new File([bytes], "x.png")`: oversize → `too_large` (construct File > MAX_UPLOAD_BYTES with valid header), wrong content declared as png → `unsupported`, missing `publicBase` → `storage_unavailable`, happy path asserts captured key prefix `products/` and full URL join.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement.** Size check FIRST (`file.size > MAX_UPLOAD_BYTES`), then read `new Uint8Array(await file.arrayBuffer())` and sniff magic bytes; extension derived ONLY from the verified signature (spec requirement).
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5: Binding wiring**

`wrangler.jsonc` — add sibling to `d1_databases`:

```jsonc
"r2_buckets": [
  {
    "binding": "MEDIA",
    "bucket_name": "beeking-media",
  },
],
```

`src/app.d.ts` — extend `Platform.env`:

```ts
interface R2LikeBucket {
  put(key: string, value: ReadableStream | ArrayBuffer): Promise<unknown>;
}
interface Platform {
  env: {
    DB: D1Database;
    MEDIA: R2LikeBucket;
  };
}
```

i18n: `errors.uploadTooLarge`, `errors.uploadUnsupported`, `errors.storageUnavailable` (ar/en).

Create the real bucket: `wrangler r2 bucket create beeking-media` (free tier). Set `MEDIA_PUBLIC_BASE_URL` in Pages project settings after enabling the bucket's public dev domain/route; locally add to `.dev.vars` if needed for manual testing.

- [ ] **Step 6:** `pnpm run check`, commit `feat(admin): magic-byte upload validation + MEDIA r2 binding`.

---

### Task 10: Products list page

**Files:**

- Modify: `src/lib/i18n/messages.ts`, `src/routes/admin/+page.svelte` (add section nav: الطلبات / المنتجات / الأصناف / الإحصائيات links)
- Create: `src/routes/admin/products/+page.server.ts`, `+page.svelte`

**Interfaces:**

- Consumes: `listAdminProducts`, `PRODUCTS_PAGE_SIZE`, `formatEGP`.

- [ ] **Step 1: i18n keys** — `admin.products.*`: title/new/search placeholder/edit/delete/featured/stock/category/confirmDelete/referencedByOrders/deleted/empty/next/prev/variantsCount.
- [ ] **Step 2: Load** — mirror Task 5 pattern: `query` + `page` search params into `listAdminProducts`.
- [ ] **Step 3: Markup** — search GET form; rows show thumbnail (`img` from product image or placeholder), name, category, price, total stock badge (red when 0), featured star, edit link `/admin/products/[id]`, delete mini-form `?/delete` with confirm dialog matching addresses-page dialog pattern; "منتج جديد" button → `/admin/products/new`.
- [ ] **Step 4: Delete action** — role re-check + `deleteProduct`; map reasons to i18n messages via `fail`.
- [ ] **Step 5:** `pnpm run check`, commit `feat(admin): products list with search and delete guard`.

---

### Task 11: Product create/edit pages + uploads

**Files:**

- Modify: `src/lib/i18n/messages.ts`
- Create: `src/routes/admin/products/new/+page.server.ts`, `+page.svelte`, `src/routes/admin/products/[id]/+page.server.ts`, `+page.svelte`
- Create: `src/lib/components/admin/ProductForm.svelte` (shared), `src/lib/components/admin/VariantEditor.svelte`

**Interfaces:**

- Consumes: `productInputSchema`, `createProduct`, `updateProduct`, `upsertVariant`, `deleteVariant`, `saveProductImage`, `detectImageType`, categories from `listCategoriesWithCounts`.

- [ ] **Step 1: Shared ProductForm.svelte** — Svelte 5 runes component, props: `categories: Array<{id,name}>`, `value?: ProductInput & { slug?: string }`, `action: string`, `submitLabel: string`. Fields bound with `$bindable` state: name, nameEn, slug (optional hint "يتولد تلقائياً"), description/descriptionEn textareas, price (number input in EGP converted ×100 to qirsh on submit — display divides by 100), category `<select>` from props, featured checkbox. POSTs `enctype="multipart/form-data"` so the image field rides along.
- [ ] **Step 2: Image field** — inside ProductForm: `<input type="file" name="image" accept="image/jpeg,image/png,image/webp">` + optional plain `imageUrl` text input (manual paste wins only when no file chosen).
- [ ] **Step 3: new/+page.server.ts** — load passes categories; `default` action: role re-check, zod-parse, resolve slug (`generateSlug(slug || nameEn || name)`), call `createProduct`; on `ok` upload file if present via `saveProductImage(event.platform!.env.MEDIA, env.MEDIA_PUBLIC_BASE_URL, file)` then persist returned URL onto `product.image` (single update); redirect(303, `/admin/products/${id}`). Map failure reasons to `fail`.
- [ ] **Step 4: [id]/+page.server.ts** — load `getProductForEdit` (404 when null); actions: `?/details` (same pipeline as create minus redirect, uses `updateProduct`), `?/uploadImage` (file-only action calling saveProductImage then updating `product.image`), `?/variantSave` (hidden `variantId` blank ⇒ insert else update; `upsertVariant`), `?/variantDelete`.
- [ ] **Step 5: [id]/+page.svelte** — ProductForm prefilled; below it VariantEditor listing variants (name, price, stock, sortOrder, image thumb) each with inline save/delete forms using the same dialog-free row-edit style as the addresses page cards.
- [ ] **Step 6:** `pnpm run check` + unit suites; commit `feat(admin): product create/edit with variants and r2 image uploads`.

---

### Task 12: Stats service

**Files:**

- Create: `src/lib/server/admin/stats.ts`
- Test: `src/lib/server/admin/stats.spec.ts`

**Interfaces:**

- Produces:

```ts
export interface DashboardStats {
  kpis: {
    revenue: number;
    orders: number;
    customers: number;
    byStatus: Record<OrderStatus, number>;
  };
  dailySeries: Array<{ day: string; revenue: number; orders: number }>; // last 30 days ascending, "YYYY-MM-DD" UTC
  topProducts: Array<{ name: string; quantity: number; revenue: number }>; // top 5 by quantity, cancelled excluded
  lowStock: Array<{ productId: string; productName: string; variantName: string; stock: number }>; // stock <= 5 asc
}
export const LOW_STOCK_THRESHOLD = 5;
export async function getDashboardStats(db: LibSQLDatabase<typeof schema>): Promise<DashboardStats>;
```

- [ ] **Step 1: Failing tests** — seeded DB covering: revenue excludes cancelled; customers counted distinct by email across guest + logged-in orders sharing an email; dailySeries buckets orders by `date(created_at/1000,'unixepoch')` including zero-days (seed gaps); topProducts aggregates quantities and excludes cancelled; lowStock ordering + threshold boundary (stock 5 included, 6 excluded).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3: Implement** — four aggregate queries via drizzle `sql` fragments; day bucketing in SQL: `date(created_at / 1000, 'unixepoch')`; fill missing days in TS over the 30-day window.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5: Commit** `feat(admin): dashboard stats aggregation service`.

---

### Task 13: Dashboard page (replaces Task 3 placeholder)

**Files:**

- Modify: `src/lib/i18n/messages.ts`, `src/routes/admin/+page.server.ts` (create if Task 3 shipped load-less), `src/routes/admin/+page.svelte`

**Interfaces:**

- Consumes: `getDashboardStats`, `formatEGP`, `formatDate`.

- [ ] **Step 1: i18n keys** — `admin.stats.revenue/orders/customers/byStatus/topProducts/lowStock/last30Days/noLowStock/quantity`.
- [ ] **Step 2: Load** — `return { stats: await getDashboardStats(db), lang: getLang(event) }`.
- [ ] **Step 3: Markup** — KPI card grid (reuse card tokens from home hero/stats sections), status distribution chips reusing Task 5 badge colors, 30-day table (day | orders | revenue) — deliberately no chart library per spec, top-products table, low-stock list linking to `/admin/products/[id]`.
- [ ] **Step 4: Full gate** — `pnpm run check && pnpm run test:unit -- --run` then `git commit -m "feat(admin): dashboard stats page"`.

---

## Self-Review Notes

- Spec coverage: roles/bootstrap/guard (Tasks 1–3), orders lifecycle + restock (Tasks 4–6), products/categories CRUD (Tasks 7–8, 10–11), R2 uploads with magic-byte rule (Task 9), stats (Tasks 12–13), security re-checks embedded in every mutating action, testing mapped per task. Email-change/payment/notification deferrals untouched.
- Type consistency: `db`-first signatures everywhere; `OrderStatus` shared between orders/stats modules (stats imports from `./orders`); `R2LikeBucket` kept structural so tests need no Cloudflare types.
- Known risk flagged: `order_item.variantName`→variant resolution relies on the `(product_id, name)` unique index; renamed variants after purchase are warned-and-skipped (test 10 covers).
