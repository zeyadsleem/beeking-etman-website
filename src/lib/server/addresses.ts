import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { z } from "zod";
import { t, type Lang } from "$lib/i18n/messages";
import { formatZodErrors } from "$lib/server/checkout-schema";
import { nameSchema } from "$lib/server/name-schema";
import * as schema from "$lib/server/db/schema";

export { formatZodErrors };

export const MAX_ADDRESSES = 10;

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
    name: nameSchema(lang),
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

export async function listAddresses(db: Db, userId: string): Promise<SavedAddress[]> {
  return db
    .select()
    .from(schema.address)
    .where(eq(schema.address.userId, userId))
    .orderBy(asc(schema.address.createdAt));
}

export type AddressSummary = Pick<
  SavedAddress,
  "id" | "label" | "name" | "phone" | "address" | "city" | "isDefault"
>;

// Column projection for contexts that only display saved addresses (e.g. the
// checkout picker) so timestamps and ownership columns are never serialized
// into page data.
export async function listAddressSummaries(db: Db, userId: string): Promise<AddressSummary[]> {
  return db
    .select({
      id: schema.address.id,
      label: schema.address.label,
      name: schema.address.name,
      phone: schema.address.phone,
      address: schema.address.address,
      city: schema.address.city,
      isDefault: schema.address.isDefault,
    })
    .from(schema.address)
    .where(eq(schema.address.userId, userId))
    .orderBy(asc(schema.address.createdAt));
}

export async function getDefaultAddress(db: Db, userId: string): Promise<SavedAddress | null> {
  const rows = await db
    .select()
    .from(schema.address)
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

// D1 does not support interactive transactions; drizzle's batch runs both
// writes as one implicit transaction so the old default is cleared and the
// new one set together.
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

  const now = Date.now();
  const promoteTarget = db
    .update(schema.address)
    .set({ isDefault: 1, updatedAt: now })
    .where(eq(schema.address.id, id));
  await db.batch(
    current
      ? [
          db
            .update(schema.address)
            .set({ isDefault: 0, updatedAt: now })
            .where(eq(schema.address.id, current.id)),
          promoteTarget,
        ]
      : [promoteTarget],
  );
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

  // Pick the promotion candidate BEFORE deleting and commit both writes as
  // one batch: a DELETE that autocommits separately from the promotion could
  // otherwise leave the user with zero defaults persistently (same invariant
  // setDefaultAddress enforces via db.batch).
  const promotion =
    rows[0]!.isDefault === 1
      ? await db
          .select({ id: schema.address.id })
          .from(schema.address)
          .where(and(eq(schema.address.userId, userId), ne(schema.address.id, id)))
          .orderBy(desc(schema.address.createdAt))
          .limit(1)
      : [];

  const remove = db
    .delete(schema.address)
    .where(and(eq(schema.address.id, id), eq(schema.address.userId, userId)));
  await db.batch(
    promotion[0]
      ? [
          remove,
          db
            .update(schema.address)
            .set({ isDefault: 1, updatedAt: Date.now() })
            .where(eq(schema.address.id, promotion[0].id)),
        ]
      : [remove],
  );
  return { ok: true };
}
