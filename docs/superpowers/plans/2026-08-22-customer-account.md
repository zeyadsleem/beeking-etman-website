# Customer Account Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give registered customers a profile page, saved-address CRUD that prefills checkout, and an owned-order detail page.

**Architecture:** One new D1 table (`store_address`) behind a single server module (`src/lib/server/addresses.ts`); three guarded route groups under `/account`; checkout gains a saved-address picker whose form stays the source of truth. Auth operations go through better-auth's server API (`auth.api.*`) exactly like the existing login/register pages.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Drizzle ORM on D1 (libsql locally), better-auth ^1.7.1, zod 4, bits-ui 2, Vitest (`vite-plus/test`), Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-customer-account-design.md`

## Global Constraints

- TypeScript strict; no `any`; explicit return types on exported/shared functions.
- No thrown control flow in the service layer — typed result unions `{ ok: true; value } | { ok: false; error }`.
- All input validated with zod; phone regex must match checkout: `/^(\+?20|0)?1[0-9]{9}$/`.
- Limits (verbatim from spec): label ≤ 40, name ≤ 80, phone ≤ 20, address ≤ 200, city ≤ 60 chars; max **10** addresses/user; exactly one `isDefault`.
- Every address query filters by `userId` in the WHERE clause — never by id alone.
- Saving an address after checkout must never fail the order.
- UI strings via `t(lang, key)` from `$lib/i18n/messages`; Arabic-first; existing مملكة النحل tokens (`cocoa-*`, `honey-*`, `parchment`), bits-ui dialogs like CartDrawer, RTL.
- Route guard: no `event.locals.user` → `redirect(302, "/login")`.
- Rate-limit mutating actions with `createDbRateLimiter(db, {...})` from `$lib/server/rate-limit`.
- Conventional commits (`feat(account): ...`). Work happens on branch `feat/customer-account` created in Task 1; CI deploys only `main`, so nothing ships until merge.
- Unit tests import from `"vite-plus/test"`; colocated `*.spec.ts`.

---

### Task 1: Schema + Migration 0007

**Files:**

- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/0007_*.sql` (generated)
- Test: compile-level (`pnpm run check`)

**Interfaces:**

- Produces: `address` table export used by Task 2 (`typeof address.$inferSelect` = `SavedAddress` shape with `id, userId, label, name, phone, address, city, isDefault, createdAt, updatedAt`).
- Produces: git branch `feat/customer-account`.

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/customer-account
```

- [ ] **Step 2: Verify the better-auth user table export name**

Run: `grep -n "export const user" src/lib/server/db/auth.schema.ts`
Expected: `export const user = sqliteTable("user", ...)` (adjust the import below if the export differs).

- [ ] **Step 3: Add the address table to `src/lib/server/db/schema.ts`**

Add to the top import from `./auth.schema` (file lives in the same directory):

```ts
import { user } from "./auth.schema";
```

Append after the `rateLimit` table:

```ts
export const address = sqliteTable(
  "store_address",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    label: text("label").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    isDefault: integer("is_default").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [index("store_address_userId_idx").on(table.userId)],
);
```

- [ ] **Step 4: Generate and apply the migration**

```bash
pnpm run db:generate && pnpm run d1:migrate
```

Expected: `drizzle/0007_<name>.sql` created containing `CREATE TABLE store_address`; local migrate reports applying it.

- [ ] **Step 5: Typecheck**

```bash
pnpm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/
git commit -m "feat(account): store_address table + migration 0007"
```

---

### Task 2: Addresses Service (TDD)

**Files:**

- Create: `src/lib/server/addresses.spec.ts`
- Create: `src/lib/server/addresses.ts`
- Test: `src/lib/server/addresses.spec.ts`

**Interfaces:**

- Consumes: `db` (drizzle instance), `schema.address` from Task 1.
- Produces (used by Tasks 3–6):

```ts
export const MAX_ADDRESSES = 10;
export interface AddressInput {
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
}
export type SavedAddress = typeof address.$inferSelect;
export type AddressError = "invalid_input" | "limit_reached" | "not_found";
export function addressSchema(lang?: Lang): z.ZodType<AddressInput>;
export function formatZodErrors(error: z.ZodError): Record<string, string>; // reuse checkout-schema's — re-export
export function listAddresses(db: Db, userId: string): Promise<SavedAddress[]>; // newest last, default first not guaranteed — ordered by createdAt asc
export function getDefaultAddress(db: Db, userId: string): Promise<SavedAddress | null>;
export async function createAddress(
  db: Db,
  userId: string,
  input: AddressInput,
): Promise<{ ok: true; value: SavedAddress } | { ok: false; error: AddressError }>;
// first-ever address becomes default; 11th returns limit_reached
export async function updateAddress(
  db: Db,
  userId: string,
  id: string,
  input: AddressInput,
): Promise<{ ok: true; value: SavedAddress } | { ok: false; error: AddressError }>; // unknown id → not_found
export async function setDefaultAddress(
  db: Db,
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: AddressError }>; // clears previous default atomically via db.batch
export async function deleteAddress(
  db: Db,
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: AddressError }>; // deleting the default promotes most-recent remaining
type Db = LibSQLDatabase<typeof schema>; // same alias style as orders.ts
```

- [ ] **Step 1: Write the failing tests** — `src/lib/server/addresses.spec.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { unlinkSync, existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "$lib/server/db/schema";
import {
  MAX_ADDRESSES,
  addressSchema,
  createAddress,
  deleteAddress,
  getDefaultAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "./addresses";

const DB_FILE = "addresses-test.db";

async function buildDb() {
  const client = createClient({ url: `file:${DB_FILE}` });
  const db = drizzle(client, { schema });
  await db.run(`DROP TABLE IF EXISTS store_address`);
  await db.run(`CREATE TABLE store_address (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id),
    label TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
    address TEXT NOT NULL, city TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  await db.run(`CREATE INDEX IF NOT EXISTS store_address_userId_idx ON store_address(user_id)`);
  return db;
}

const USER = "u1";
const base = {
  label: "البيت",
  name: "سارة",
  phone: "01012345678",
  address: "12 شارع النيل",
  city: "القاهرة",
};

function addr(overrides: Partial<typeof base> = {}) {
  return { ...base, ...overrides };
}

afterAll(() => {
  if (existsSync(DB_FILE)) unlinkSync(DB_FILE);
});

describe("addressSchema", () => {
  it("rejects bad phone, empty label, overlong fields", () => {
    expect(addressSchema().safeParse(addr({ phone: "123" })).success).toBe(false);
    expect(addressSchema().safeParse(addr({ label: "" })).success).toBe(false);
    expect(addressSchema().safeParse(addr({ label: "x".repeat(41) })).success).toBe(false);
    expect(addressSchema().safeParse(addr({ address: "x".repeat(201) })).success).toBe(false);
    expect(addressSchema().safeParse(addr()).success).toBe(true);
  });
});

describe("createAddress", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("creates and makes the first address the default", async () => {
    const r = await createAddress(db, USER, addr());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.isDefault).toBe(1);
    const def = await getDefaultAddress(db, USER);
    expect(def?.id).toBe(r.value.id);
  });

  it("second address is not default; swapping moves default", async () => {
    await createAddress(db, USER, addr());
    const second = await createAddress(db, USER, addr({ label: "الشغل" }));
    expect(second.ok).toBe(true);
    if (!second.ok || !second.value) return;
    expect(second.value.isDefault).toBe(0);
    const swap = await setDefaultAddress(db, USER, second.value.id);
    expect(swap.ok).toBe(true);
    const def = await getDefaultAddress(db, USER);
    expect(def?.id).toBe(second.value.id);
    const all = await listAddresses(db, USER);
    expect(all.filter((a) => a.isDefault === 1)).toHaveLength(1);
  });

  it("enforces the 10-address cap", async () => {
    for (let i = 0; i < MAX_ADDRESSES; i++) {
      const r = await createAddress(db, USER, addr({ label: `عنوان ${i}` }));
      expect(r.ok).toBe(true);
    }
    const extra = await createAddress(db, USER, addr({ label: "زائد" }));
    expect(extra).toEqual({ ok: false, error: "limit_reached" });
  });
});

describe("updateAddress / deleteAddress", () => {
  let db: Awaited<ReturnType<typeof buildDb>>;
  beforeEach(async () => {
    db = await buildDb();
  });

  it("updates own address and rejects foreign/unknown ids", async () => {
    const mine = await createAddress(db, USER, addr());
    if (!mine.ok) throw new Error("seed failed");
    const upd = await updateAddress(db, USER, mine.value.id, addr({ name: "منى" }));
    expect(upd.ok).toBe(true);
    const foreign = await updateAddress(db, "u2", mine.value.id, addr());
    const unknown = await updateAddress(db, USER, "nope", addr());
    expect(foreign).toEqual({ ok: false, error: "not_found" });
    expect(unknown).toEqual({ ok: false, error: "not_found" });
  });

  it("deleting the default promotes the most recent remaining address", async () => {
    const a = await createAddress(db, USER, addr());
    const b = await createAddress(db, USER, addr({ label: "الثاني" }));
    if (!(a.ok && b.ok)) throw new Error("seed failed");
    const del = await deleteAddress(db, USER, a.value.id);
    expect(del.ok).toBe(true);
    const def = await getDefaultAddress(db, USER);
    expect(def?.id).toBe(b.value.id);
    expect(await listAddresses(db, USER)).toHaveLength(1);
  });

  it("deleting another user's address does nothing", async () => {
    const a = await createAddress(db, USER, addr());
    if (!a.ok) throw new Error("seed failed");
    await deleteAddress(db, "u9", a.value.id);
    expect(await listAddresses(db, USER)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit -- --run addresses.spec`
Expected: FAIL — cannot resolve `./addresses`.

- [ ] **Step 3: Implement `src/lib/server/addresses.ts`**

```ts
import { and, asc, desc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { z } from "zod";
import { t, type Lang } from "$lib/i18n/messages";
import * as schema from "$lib/server/db/schema";

export const MAX_ADDRESSES = 10;

const db_ = () => schema.address;

export interface AddressInput {
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
}

export type SavedAddress = typeof schema.address.$inferSelect;

export type AddressError = "invalid_input" | "limit_reached" | "not_found";

type Db = LibSQLDatabase<typeof schema>;

type Result<T> = { ok: true; value: T } | { ok: false; error: AddressError };

export function addressSchema(lang: Lang = "ar"): z.ZodType<AddressInput> {
  return z.object({
    label: z.string().trim().min(2, t(lang, "schema.label")).max(40, t(lang, "schema.label")),
    name: z.string().trim().min(2, t(lang, "schema.name")).max(80, t(lang, "schema.name")),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?20|0)?1[0-9]{9}$/, t(lang, "schema.phone"))
      .max(20),
    city: z.string().trim().min(2, t(lang, "schema.city")).max(60, t(lang, "schema.city")),
    address: z
      .string()
      .trim()
      .min(5, t(lang, "schema.address"))
      .max(200, t(lang, "schema.address")),
  });
}

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export async function listAddresses(db: Db, userId: string): Promise<SavedAddress[]> {
  return db
    .select()
    .from(db_())
    .where(eq(schema.address.userId, userId))
    .orderBy(asc(schema.address.createdAt));
}

export async function getDefaultAddress(db: Db, userId: string): Promise<SavedAddress | null> {
  const rows = await db
    .select()
    .from(db_())
    .where(and(eq(schema.address.userId, userId), eq(schema.address.isDefault, 1)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAddress(
  db: Db,
  userId: string,
  input: AddressInput,
): Promise<Result<SavedAddress>> {
  const parsed = addressSchema().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const existing = await listAddresses(db, userId);
  if (existing.length >= MAX_ADDRESSES) return { ok: false, error: "limit_reached" };
  const makeDefault = existing.length === 0;

  const inserted = await db
    .insert(schema.address)
    .values({ userId, ...parsed.data, isDefault: makeDefault ? 1 : 0 })
    .returning();
  return { ok: true, value: inserted[0]! };
}

export async function updateAddress(
  db: Db,
  userId: string,
  id: string,
  input: AddressInput,
): Promise<Result<SavedAddress>> {
  const parsed = addressSchema().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const updated = await db
    .update(schema.address)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(and(eq(schema.address.id, id), eq(schema.address.userId, userId)))
    .returning();
  if (updated.length === 0) return { ok: false, error: "not_found" };
  return { ok: true, value: updated[0]! };
}

export async function setDefaultAddress(
  db: Db,
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: AddressError }> {
  const target = await db
    .select({ id: schema.address.id })
    .from(schema.address)
    .where(and(eq(schema.address.id, id), eq(schema.address.userId, userId)))
    .limit(1);
  if (target.length === 0) return { ok: false, error: "not_found" };

  const current = await getDefaultAddress(db, userId);
  if (current?.id === id) return { ok: true };

  const statements: Parameters<typeof db.batch>[0] = [];
  if (current) {
    statements.push(
      db.update(schema.address).set({ isDefault: 0 }).where(eq(schema.address.id, current.id)),
    );
  }
  statements.push(db.update(schema.address).set({ isDefault: 1 }).where(eq(schema.address.id, id)));
  await db.batch(statements);
  return { ok: true };
}

export async function deleteAddress(
  db: Db,
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: AddressError }> {
  const rows = await db
    .select({ isDefault: schema.address.isDefault })
    .from(schema.address)
    .where(and(eq(schema.address.id, id), eq(schema.address.userId, userId)))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "not_found" };

  await db
    .delete(schema.address)
    .where(and(eq(schema.address.id, id), eq(schema.address.userId, userId)));

  if (rows[0]!.isDefault === 1) {
    const latest = await db
      .select({ id: schema.address.id })
      .from(schema.address)
      .where(eq(schema.address.userId, userId))
      .orderBy(desc(schema.address.createdAt))
      .limit(1);
    if (latest[0]) {
      await db
        .update(schema.address)
        .set({ isDefault: 1 })
        .where(eq(schema.address.id, latest[0].id));
    }
  }
  return { ok: true };
}
```

Note: if `db.batch` typing fights the array literal, call the two updates sequentially instead — correctness comes from the WHERE clauses, atomicity here is a nicety.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- --run addresses.spec`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/addresses.ts src/lib/server/addresses.spec.ts
git commit -m "feat(account): address service with default/cap rules"
```

---

### Task 3: Profile Page `/account` (+ auth actions)

**Files:**

- Create: `src/routes/account/+page.server.ts`
- Create: `src/routes/account/+page.svelte`
- Modify: `src/routes/login/+page.server.ts:11` and `src/routes/register/+page.server.ts` (redirect targets `/account/orders` → `/account`)
- Modify: `src/lib/i18n/messages.ts` (new `account.*` keys)
- Modify: `src/lib/components/Header.svelte:133` and `:243` (entry link → `/account`)
- Test: `pnpm run check` (types); behavior covered by Task 7 e2e

**Interfaces:**

- Consumes: `auth.api.updateUser / changePassword / signOut` (better-auth, headers passed through); `event.locals.user` set in `src/hooks.server.ts`.
- Produces: route `/account` (hub). Load data shape: `{ lang, user: { name, email } }`.

- [ ] **Step 1: Add i18n keys to `src/lib/i18n/messages.ts`** (follow the existing flat-key record structure):

```
account.title: "حسابي"
account.welcome: "بيانات حسابك وإعداداتك"
account.name: "الاسم"
account.email: "البريد الإلكتروني"
account.emailReadonly: "لتغيير البريد الإلكتروني تواصل مع الدعم"
account.saveName: "حفظ الاسم"
account.nameSaved: "تم تحديث الاسم"
account.changePassword: "تغيير كلمة المرور"
account.currentPassword: "كلمة المرور الحالية"
account.newPassword: "كلمة المرور الجديدة"
account.passwordChanged: "تم تغيير كلمة المرور"
account.signOut: "تسجيل الخروج"
account.myOrders: "طلباتي"
account.myAddresses: "عناويني المحفوظة"
errors.currentPasswordWrong: "كلمة المرور الحالية غير صحيحة"
```

- [ ] **Step 2: Create `src/routes/account/+page.server.ts`:**

```ts
import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { getLang } from "$lib/server/lang";
import { t } from "$lib/i18n/messages";
import type { Actions, PageServerLoad } from "./$types";

const accountLimiter = createDbRateLimiter(db, { windowMs: 60_000, max: 15 });

export const load: PageServerLoad = (event) => {
  if (!event.locals.user) redirect(302, "/login");
  return {
    lang: getLang(event),
    user: { name: event.locals.user.name, email: event.locals.user.email },
  };
};

export const actions: Actions = {
  updateName: async (event) => {
    const lang = getLang(event);
    const form = Object.fromEntries(await event.request.formData());
    const name = typeof form.name === "string" ? form.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return fail(400, { nameError: t(lang, "schema.name") });
    }
    try {
      await auth.api.updateUser({
        body: { name },
        headers: event.request.headers,
      });
    } catch (error) {
      if (error instanceof APIError) return fail(400, { nameError: t(lang, "errors.unexpected") });
      return fail(500, { nameError: t(lang, "errors.unexpected") });
    }
    return { nameSaved: true };
  },

  changePassword: async (event) => {
    const lang = getLang(event);
    if (!(await accountLimiter.allow(`acct:${clientAddressKey(event)}`))) {
      return fail(429, { passwordError: t(lang, "errors.tooManyAttempts") });
    }
    const form = Object.fromEntries(await event.request.formData());
    const currentPassword = typeof form.currentPassword === "string" ? form.currentPassword : "";
    const newPassword = typeof form.newPassword === "string" ? form.newPassword : "";
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: event.request.headers,
      });
    } catch (error) {
      if (error instanceof APIError)
        return fail(400, { passwordError: t(lang, "errors.currentPasswordWrong") });
      return fail(500, { passwordError: t(lang, "errors.unexpected") });
    }
    return { passwordChanged: true };
  },

  signOut: async (event) => {
    await auth.api.signOut({ headers: event.request.headers });
    redirect(302, "/");
  },
};
```

- [ ] **Step 3: Create `src/routes/account/+page.svelte`** — Svelte 5 runes, project styling:

```svelte
<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  let name = $state(data.user.name);
  let nameForm: HTMLFormElement | null = $state(null);
</script>

<svelte:head><title>{t(lang, "account.title")} — مملكة النحل</title></svelte:head>

<div class="mx-auto mt-8 w-full max-w-2xl px-4">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "account.title")}</SectionTitle>

  <div class="mt-6 grid gap-4 sm:grid-cols-2">
    <Button variant="primary" href="/account/orders">{t(lang, "account.myOrders")}</Button>
    <Button variant="secondary" href="/account/addresses">{t(lang, "account.myAddresses")}</Button>
  </div>

  <section class="mt-8 rounded-2xl border border-cocoa-200 bg-parchment p-6">
    <h2 class="text-xl font-bold text-cocoa-800">{t(lang, "account.name")}</h2>
    <form method="POST" action="?/updateName" class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <input
        class="w-full rounded-xl border border-cocoa-300 bg-white px-4 py-2.5"
        name="name" required minlength="2" maxlength="80" bind:value={name} bind:this={nameForm}
        aria-label={t(lang, "account.name")}
      />
      <Button type="submit" variant="primary">{t(lang, "account.saveName")}</Button>
    </form>
    {#if data.user.email !== undefined}
      <p class="mt-4 text-sm text-cocoa-600">
        {t(lang, "account.email")}: <span class="font-semibold">{data.user.email}</span>
        <span class="block text-xs">{t(lang, "account.emailReadonly")}</span>
      </p>
    {/if}
    {#if form?.nameSaved}<p class="mt-2 text-sm font-semibold text-honey-700">{t(lang, "account.nameSaved")}</p>{/if}
    {#if form?.nameError}<p class="mt-2 text-sm font-semibold text-red-700">{form.nameError}</p>{/if}
  </section>

  <section class="mt-6 rounded-2xl border border-cocoa-200 bg-parchment p-6">
    <h2 class="text-xl font-bold text-cocoa-800">{t(lang, "account.changePassword")}</h2>
    <form method="POST" action="?/changePassword" class="mt-4 grid gap-3">
      <input type="password" name="currentPassword" required autocomplete="current-password"
        placeholder={t(lang, "account.currentPassword")}
        class="rounded-xl border border-cocoa-300 bg-white px-4 py-2.5" />
      <input type="password" name="newPassword" required minlength="8" autocomplete="new-password"
        placeholder={t(lang, "account.newPassword")}
        class="rounded-xl border border-cocoa-300 bg-white px-4 py-2.5" />
      <Button type="submit" variant="primary">{t(lang, "account.changePassword")}</Button>
    </form>
    {#if form?.passwordChanged}<p class="mt-2 text-sm font-semibold text-honey-700">{t(lang, "account.passwordChanged")}</p>{/if}
    {#if form?.passwordError}<p class="mt-2 text-sm font-semibold text-red-700">{form.passwordError}</p>{/if}
  </section>

  <form method="POST" action="?/signOut" class="mt-8 mb-16">
    <Button type="submit" variant="ghost">{t(lang, "account.signOut")}</Button>
  </form>
</div>
```

Add `let form = $data()`-style access: declare `let form = $derived(data.form);` next to `lang` and use it in the conditional blocks above (replace bare `form?.` reads). Remove the unused `nameForm` binding if the final markup doesn't need it.

- [ ] **Step 4: Point login/register redirects at the hub**

In `src/routes/login/+page.server.ts` replace both occurrences of `"/account/orders"` with `"/account"`; same in `src/routes/register/+page.server.ts` (and its load-guard redirect if present).

- [ ] **Step 5: Header entry links** — in `src/lib/components/Header.svelte` change the two `href="/account/orders"` occurrences (lines ~133, ~243) to `href="/account"`.

- [ ] **Step 6: Typecheck + unit suite**

```bash
pnpm run check && pnpm run test:unit -- --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(account): profile hub with name/password/sign-out"
```

---

### Task 4: Addresses Page `/account/addresses`

**Files:**

- Create: `src/routes/account/addresses/+page.server.ts`
- Create: `src/routes/account/addresses/+page.svelte`
- Modify: `src/lib/i18n/messages.ts` (`addresses.*` keys)
- Test: `pnpm run check`; e2e in Task 7

**Interfaces:**

- Consumes: every function from Task 2's addresses service.
- Produces: none downstream (leaf page).

- [ ] **Step 1: Add i18n keys:**

```
addresses.title: "عناويني المحفوظة"
addresses.empty: "لا توجد عناوين محفوظة بعد"
addresses.add: "إضافة عنوان"
addresses.edit: "تعديل العنوان"
addresses.delete: "حذف"
addresses.setDefault: "اجعلها الافتراضية"
addresses.default: "افتراضي"
addresses.label: "اسم العنوان"
addresses.name: "اسم المستلم"
addresses.phone: "رقم الهاتف"
addresses.city: "المدينة"
addresses.address: "العنوان التفصيلي"
addresses.save: "حفظ"
addresses.cancel: "إلغاء"
addresses.limitReached: "وصلت للحد الأقصى (10 عناوين)"
addresses.notFound: "العنوان غير موجود"
```

- [ ] **Step 2: Create `+page.server.ts`:**

```ts
import { fail, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import {
  createAddress,
  deleteAddress,
  formatZodErrors,
  addressSchema,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "$lib/server/addresses";
import { clientAddressKey, createDbRateLimiter } from "$lib/server/rate-limit";
import { getLang } from "$lib/server/lang";
import { t } from "$lib/i18n/messages";
import type { Actions, PageServerLoad } from "./$types";

const mutationLimiter = createDbRateLimiter(db, { windowMs: 60_000, max: 30 });

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user) redirect(302, "/login");
  return {
    lang: getLang(event),
    addresses: await listAddresses(db, event.locals.user.id),
  };
};

type FieldErrors = Record<string, string>;

export const actions: Actions = {
  create: async (event) => {
    const lang = getLang(event);
    if (!event.locals.user) redirect(302, "/login");
    if (!(await mutationLimiter.allow(`addr:${clientAddressKey(event)}`))) {
      return fail(429, {
        errors: { label: t(lang, "errors.tooManyAttempts") },
        values: {} satisfies Record<string, string>,
      });
    }
    const form = Object.fromEntries(await event.request.formData());
    const parsed = addressSchema(lang).safeParse(form);
    if (!parsed.success) {
      return fail(400, { errors: formatZodErrors(parsed.error), values: form } satisfies {
        errors: FieldErrors;
        values: Record<string, FormDataEntryValue>;
      });
    }
    const result = await createAddress(db, event.locals.user.id, parsed.data);
    if (!result.ok) {
      return fail(result.error === "limit_reached" ? 409 : 400, {
        errors: {
          label: t(
            lang,
            result.error === "limit_reached" ? "addresses.limitReached" : "errors.unexpected",
          ),
        },
        values: form,
      } satisfies { errors: FieldErrors; values: Record<string, FormDataEntryValue> });
    }
    return { saved: true };
  },

  update: async (event) => {
    const lang = getLang(event);
    if (!event.locals.user) redirect(302, "/login");
    const form = Object.fromEntries(await event.request.formData());
    const id = typeof form.id === "string" ? form.id : "";
    const parsed = addressSchema(lang).safeParse(form);
    if (!parsed.success) {
      return fail(400, { errors: formatZodErrors(parsed.error), values: form } satisfies {
        errors: FieldErrors;
        values: Record<string, FormDataEntryValue>;
      });
    }
    const result = await updateAddress(db, event.locals.user.id, id, parsed.data);
    if (!result.ok)
      return fail(404, { errors: { label: t(lang, "addresses.notFound") }, values: form });
    return { saved: true };
  },

  setDefault: async (event) => {
    if (!event.locals.user) redirect(302, "/login");
    const form = Object.fromEntries(await event.request.formData());
    const id = typeof form.id === "string" ? form.id : "";
    const result = await setDefaultAddress(db, event.locals.user.id, id);
    if (!result.ok) return fail(404, { errors: { label: t(lang, "addresses.notFound") } });
    return { saved: true };
  },

  delete: async (event) => {
    if (!event.locals.user) redirect(302, "/login");
    const form = Object.fromEntries(await event.request.formData());
    const id = typeof form.id === "string" ? form.id : "";
    const result = await deleteAddress(db, event.locals.user.id, id);
    if (!result.ok) return fail(404, { errors: { label: t(lang, "addresses.notFound") } });
    return { saved: true };
  },
};
```

- [ ] **Step 3: Create `+page.svelte`** — card list; add/edit inside a bits-ui Dialog copied structurally from `CartDrawer.svelte` (Dialog.Root with `bind:open`, Portal, Overlay, Content, Title, Description, Close). One dialog component reused for add/edit with `let editing: SavedAddress | null = $state(null)`; the form posts to `?/create` when `editing === null` else `?/update` with hidden `id` input. Delete is a plain form posting `?/delete` with a `confirm()` guard via `onsubmit={(e) => editing === null && !confirm(t(lang, "addresses.delete")) && e.preventDefault()}` — actually use a dedicated small confirm dialog instead of `confirm()` to match project a11y style. Fields: label/name/phone/city/address text inputs mirroring checkout classes. Default badge shows `t(lang, "addresses.default")`; non-default cards get a `?/setDefault` mini-form button.

Keep the page under ~250 lines by extracting `AddressDialog.svelte` into `$lib/components/account/` if it exceeds that while writing.

- [ ] **Step 4: Typecheck + suites**

```bash
pnpm run check && pnpm run test:unit -- --run
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(account): saved-address CRUD page"
```

---

### Task 5: Order Detail `/account/orders/[id]`

**Files:**

- Create: `src/routes/account/orders/[id]/+page.server.ts`
- Create: `src/routes/account/orders/[id]/+page.svelte`
- Modify: `src/lib/i18n/messages.ts` (`orderDetail.*`)
- Modify: `src/routes/account/orders/+page.svelte` (wrap each list item in a link to the detail route)

**Interfaces:**

- Consumes: `schema.order`, `schema.orderItem`.
- Produces: none downstream.

- [ ] **Step 1: i18n keys:**

```
orderDetail.backToOrders: "رجوع لطلباتي"
orderDetail.placedOn: "تاريخ الطلب"
orderDetail.shippingTo: "بيانات الشحن"
orderDetail.items: "المنتجات"
orderDetail.total: "الإجمالي"
```

(Status names already exist in the orders list — reuse those keys.)

- [ ] **Step 2: Create `+page.server.ts`:**

```ts
import { error, redirect } from "@sveltejs/kit";
import { and, asc, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { getLang } from "$lib/server/lang";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user) redirect(302, "/login");
  const orderRows = await db
    .select()
    .from(schema.order)
    .where(and(eq(schema.order.id, event.params.id), eq(schema.order.userId, event.locals.user.id)))
    .limit(1);
  const order = orderRows[0];
  if (!order) error(404, "Not found");
  const items = await db
    .select()
    .from(schema.orderItem)
    .where(eq(schema.orderItem.orderId, order.id))
    .orderBy(asc(schema.orderItem.productName));
  return { lang: getLang(event), order, items };
};
```

- [ ] **Step 3: Create `+page.svelte`** — presentational layout: order number + date (`formatDate` from `$lib/i18n/messages`), status chip styled like the orders list, shipping block (name/phone/address/city), items table (`productName`, `variantName`, quantity × `formatEGP(unitPrice)` from `$lib/currency`), total row `formatEGP(order.total)`, back link `href="/account/orders"`.

- [ ] **Step 4: Link from the list** — in `src/routes/account/orders/+page.svelte`, wrap the clickable area of each `<li>` in `<a href={`/account/orders/${order.id}`}>` preserving current styles (or add an explicit "تفاصيل" anchor if the li isn't naturally clickable).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm run check
git add -A && git commit -m "feat(account): owned order detail page"
```

---

### Task 6: Checkout Saved-Address Picker

**Files:**

- Modify: `src/routes/checkout/+page.server.ts` (load + submit action)
- Modify: `src/routes/checkout/+page.svelte` (picker UI + save checkbox)
- Modify: `src/lib/i18n/messages.ts` (`checkout.savedAddresses`, `checkout.useNewAddress`, `checkout.saveThisAddress`)
- Test: `pnpm run check`; e2e in Task 7

**Interfaces:**

- Consumes: `getDefaultAddress`, `listAddresses`, `createAddress` from Task 2; `locals.user`.
- Produces: load now returns `savedAddresses: Array<Pick<SavedAddress, "id"|"label"|"name"|"phone"|"address"|"city"|"isDefault">>` (empty for guests).

- [ ] **Step 1: Extend the load function** in `+page.server.ts` — after the cart resolution:

```ts
let savedAddresses: Awaited<ReturnType<typeof listAddresses>> = [];
if (locals.user) {
  savedAddresses = await listAddresses(db, locals.user.id);
}
return { nonce, items, missingVariantIds: missing, totals: computeTotals(items), savedAddresses };
```

Import `listAddresses` from `$lib/server/addresses`.

- [ ] **Step 2: Handle "save this address" in the submit action** — after `clearCartCookie(cookies)` and BEFORE `redirect(303, ...)`:

```ts
if (locals.user && form.saveAddress === "on") {
  const saved = await createAddress(db, locals.user.id, {
    label: `${parsed.data.city} — ${parsed.data.name}`,
    name: parsed.data.name,
    phone: parsed.data.phone,
    address: parsed.data.address,
    city: parsed.data.city,
  });
  if (!saved.ok) console.error("post-checkout address save failed:", saved.error);
}
```

Never wrap the redirect in the try path of anything — SvelteKit redirects must propagate.

- [ ] **Step 3: Picker UI in `+page.svelte`** — read the current component first; integrate these pieces:

```svelte
<script lang="ts">
  // existing imports stay; add nothing external — data arrives via props
  let savedChoice = $state(data.savedAddresses.some((a) => a.isDefault) ? "default" : "new");
  // where "default" is the id of the default address resolved at init:
  const defaultId = data.savedAddresses.find((a) => a.isDefault)?.id ?? null;
  // savedChoice initial: defaultId ?? "new"

  const selectedSaved = $derived(
    savedChoice === "new" ? null : data.savedAddresses.find((a) => a.id === savedChoice) ?? null,
  );

  // whenever selection changes, fill the four shipping fields (they are $state-bound inputs):
  $effect(() => {
    const s = selectedSaved;
    if (s) {
      name = s.name; phone = s.phone; address = s.address; city = s.city;
    }
  });
</script>
```

Markup above the shipping form (only when `data.savedAddresses.length > 0`):

```svelte
<fieldset class="mt-6 rounded-2xl border border-cocoa-200 bg-parchment p-5">
  <legend class="px-2 text-sm font-bold text-cocoa-700">{t(lang, "checkout.savedAddresses")}</legend>
  <div role="radiogroup" aria-label={t(lang, "checkout.savedAddresses")} class="grid gap-2">
    {#each data.savedAddresses as addr (addr.id)}
      <label class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 has-checked:border-honey-500 has-checked:bg-honey-50">
        <input type="radio" name="savedAddress" value={addr.id} bind:group={savedChoice} class="accent-honey-600" />
        <span class="text-sm"><b>{addr.label}</b> — {addr.name}، {addr.city}، {addr.phone}</span>
      </label>
    {/each}
    <label class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 has-checked:border-honey-500 has-checked:bg-honey-50">
      <input type="radio" name="savedAddress" value="new" bind:group={savedChoice} class="accent-honey-600" />
      <span class="text-sm font-semibold">{t(lang, "checkout.useNewAddress")}</span>
    </label>
  </div>
</fieldset>
```

Checkbox, shown only when `savedChoice === "new"` AND `data.savedAddresses !== undefined && data.userLoggedIn` — since guests have empty arrays, gate on `data.savedAddresses.length >= 0 && savedChoice === "new"` plus a new load flag:

Return `isLoggedIn: Boolean(locals.user)` from the load in Step 1 and render the checkbox only when `data.isLoggedIn`:

```svelte
{#if data.isLoggedIn && savedChoice === "new"}
  <label class="mt-3 flex items-center gap-2 text-sm text-cocoa-700">
    <input type="checkbox" name="saveAddress" class="accent-honey-600" />
    {t(lang, "checkout.saveThisAddress")}
  </label>
{/if}
```

Adapt field variable names (`name`, `phone`, `address`, `city`) to whatever the existing component already binds — do not rename existing bindings; wire the `$effect` to those.

- [ ] **Step 4: Typecheck + suites**

```bash
pnpm run check && pnpm run test:unit -- --run
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(checkout): saved-address picker + optional address saving"
```

---

### Task 7: E2E Suite `src/routes/account.e2e.ts`

**Files:**

- Create: `src/routes/account.e2e.ts`
- Test: itself (Playwright, serialized workers per config)

**Interfaces:**

- Consumes: running preview webServer from `playwright.config.ts` (fresh seeded DB each run).
- Produces: regression coverage for Tasks 3–6.

- [ ] **Step 1: Write the suite** (register via real UI; unique email per run):

```ts
import { expect, test } from "@playwright/test";

const email = `acct-${Date.now()}@test.dev`;
const password = "password123";

async function registerAndLogin(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(/الاسم|Name/).fill("سارة محمد");
  await page.getByLabel(/البريد|Email/).fill(email);
  await page.getByLabel(/كلمة المرور|Password/).fill(password);
  await page.getByRole("button", { name: /إنشاء|Register|Sign up/ }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test.describe("customer account", () => {
  test("redirects logged-out visitors to login", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("full journey: profile → addresses → checkout prefill → order history", async ({ page }) => {
    await registerAndLogin(page);

    await page.goto("/account/addresses");
    await page.getByRole("button", { name: /إضافة عنوان/ }).click();
    await page.getByLabel(/اسم العنوان/).fill("البيت");
    await page.getByLabel(/اسم المستلم/).fill("سارة محمد");
    await page.getByLabel(/رقم الهاتف/).fill("01012345678");
    await page.getByLabel(/المدينة/).fill("القاهرة");
    await page.getByLabel(/العنوان التفصيلي/).fill("12 شارع النيل، المهندسين");
    await page.getByRole("button", { name: /^حفظ$/ }).click();
    await expect(page.getByText(/البيت/)).toBeVisible();

    await page.goto("/products");
    await page.getByRole("link").filter({ hasText: /.+/ }).first().click();
    await page
      .getByRole("button", { name: /أضف إلى السلة|أضف/ })
      .first()
      .click();
    await page.goto("/cart");
    await page.getByRole("link", { name: /إتمام الشراء|الدفع/ }).click();
    await expect(page).toHaveURL(/\/checkout/);

    await expect(page.getByText("البيت")).toBeVisible();
    await expect(page.getByLabel(/اسم المستلم|الاسم/)).toHaveValue("سارة محمد");

    await page.getByLabel(/البريد الإلكتروني|البريد/).fill(email);
    await page.getByRole("button", { name: /تأكيد|شراء|إتمام/ }).click();
    await expect(page).toHaveURL(/\/checkout\/success\//);

    await page.goto("/account/orders");
    await expect(page.getByText(/HNY-/).first()).toBeVisible();
    await page.getByText(/HNY-/).first().click();
    await expect(page).toHaveURL(/\/account\/orders\//);
    await expect(page.getByText("سارة محمد").first()).toBeVisible();
  });

  test("password change requires correct current password", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/account");
    await page.getByPlaceholder(/الحالية/).fill("wrongpass");
    await page.getByPlaceholder(/الجديدة/).fill("newpassword456");
    await page.getByRole("button", { name: /تغيير كلمة المرور/ }).click();
    await expect(page.getByText(/غير صحيحة/)).toBeVisible();
  });
});
```

Selectors may need adjustment to the actual Arabic labels — open `/register`, `/account/addresses` markup while fixing failures; keep assertions on user-visible text.

- [ ] **Step 2: Run the suite**

```bash
pnpm run test:e2e -- account.e2e.ts
```

Expected: PASS after selector fixes. (webServer cold-start can take minutes.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/account.e2e.ts
git commit -m "test(account): e2e journey for profile/addresses/checkout/history"
```

---

### Task 8: Quality Gate + Docs

**Files:**

- Modify: `docs/todo.md` (Roadmap item 1 → done with commit refs)
- Possibly: `docs/architecture.md` (one paragraph: store_address table + service boundary)

- [ ] **Step 1: Full gate**

```bash
vp check && pnpm run test:unit -- --run && pnpm run test:e2e
```

All green required. Fix anything found before proceeding.

- [ ] **Step 2: Update docs** — mark Roadmap item 1 `[x]` in `docs/todo.md` with the shipped-commit hashes; add `store_address` to any schema inventory in `docs/architecture.md`.

- [ ] **Step 3: Commit docs and finish**

```bash
git add docs/ && git commit -m "docs(todo): customer account area shipped"
```

Merge strategy (`feat/customer-account` → `main`) happens only after user reviews the deployed-preview or explicitly approves; merging to `main` triggers production deploy via CI.

---

## Self-Review Notes

- Spec coverage: schema/migration → T1; service rules (cap/default/promote/ownership/zod) → T2; profile+password+sign-out → T3; addresses CRUD → T4; order detail + IDOR 404 → T5; picker + save-checkbox + never-fail-order hook → T6; e2e incl. negative redirect → T7; gate/docs → T8. Email change intentionally absent (spec defers it).
- Known risk flagged in-task: Task 3's draft markup references `form` results — implementer must derive them from `data.form` (SvelteKit action data) rather than copying literally; Task 6 must adapt to existing bindings in `checkout/+page.svelte`.
