import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { computeTotals } from "$lib/cart";
import type { CartEntry, CartItem } from "$lib/cart";
import { isBlendEntry, isBlendItem } from "$lib/cart";
import { t, type Lang } from "$lib/i18n/messages";
import { resolveCartItems } from "$lib/server/store";
import { isBusyError, sleep, SQLITE_BUSY_RETRIES } from "$lib/server/sqlite";
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

const MAX_ORDER_ATTEMPTS = SQLITE_BUSY_RETRIES + 5;

export function generateOrderNumber(): string {
  return `HNY-${String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6)}`;
}

export function isNonceConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("store_order.nonce");
}

export function isOrderNumberConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("store_order.number");
}

interface OrderUnit {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
}

// Batch write results differ per driver: libsql reports `rowsAffected`,
// D1 reports `meta.changes`. A guarded UPDATE matching 0 rows is not an
// error inside a batch, so affected counts must be verified explicitly.
interface BatchWriteResult {
  rowsAffected?: number;
  meta?: { changes?: number };
}

function affectedRowCount(result: unknown): number {
  if (typeof result !== "object" || result === null) return 0;
  const { rowsAffected, meta } = result as BatchWriteResult;
  if (typeof rowsAffected === "number") return rowsAffected;
  return typeof meta?.changes === "number" ? meta.changes : 0;
}

function toOrderUnits(items: CartItem[]): OrderUnit[] {
  const units: OrderUnit[] = [];
  for (const item of items) {
    if (isBlendItem(item)) {
      units.push({
        variantId: item.baseVariantId,
        productId: item.productId,
        name: item.name,
        variantName: item.variantName,
        quantity: 1,
        unitPrice: item.basePrice,
      });
      for (const a of item.additives) {
        units.push({
          variantId: a.variantId,
          productId: a.productId,
          name: a.name,
          variantName: "",
          quantity: a.qty,
          unitPrice: a.price,
        });
      }
    } else {
      units.push({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.price,
      });
    }
  }
  return units;
}

async function findOrderByNonce(
  db: LibSQLDatabase<typeof schema>,
  nonce: string,
): Promise<{ id: string; number: string; total: number } | undefined> {
  return db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      total: schema.order.total,
    })
    .from(schema.order)
    .where(eq(schema.order.nonce, nonce))
    .get();
}

// Undo a committed batch whose guarded decrement lost a stock race: delete
// the order we just wrote and add back exactly what was taken (restoring
// only the decrements that applied is safe under concurrency). Returns
// false when compensation itself fails even after busy retries — the caller
// must then treat the outcome as unknown rather than report stock state.
async function compensateLostStockRace(
  db: LibSQLDatabase<typeof schema>,
  orderId: string,
  appliedVariantIds: string[],
  demandByVariant: Map<string, number>,
): Promise<boolean> {
  const restockEntries = appliedVariantIds.flatMap((variantId) => {
    const quantity = demandByVariant.get(variantId);
    return quantity === undefined ? [] : [[variantId, quantity] as const];
  });
  for (let attempt = 0; attempt <= SQLITE_BUSY_RETRIES; attempt++) {
    try {
      await db.batch([
        db.delete(schema.orderItem).where(eq(schema.orderItem.orderId, orderId)),
        db.delete(schema.order).where(eq(schema.order.id, orderId)),
        ...restockEntries.map(([variantId, quantity]) =>
          db
            .update(schema.productVariant)
            .set({ stock: sql`${schema.productVariant.stock} + ${quantity}` })
            .where(eq(schema.productVariant.id, variantId)),
        ),
      ]);
      return true;
    } catch (error) {
      if (isBusyError(error) && attempt < SQLITE_BUSY_RETRIES) {
        await sleep((attempt + 1) * 50);
        continue;
      }
      console.error("[createOrder] compensation after lost stock race failed", { orderId, error });
      return false;
    }
  }
  return false;
}

export async function createOrder(
  db: LibSQLDatabase<typeof schema>,
  lines: CartEntry[],
  customer: Customer,
  nonce: string,
  userId?: string,
  lang: Lang = "ar",
): Promise<CreateOrderResult> {
  if (lines.length === 0) {
    return { ok: false, message: t(lang, "orders.cartEmpty"), outOfStock: [] };
  }

  const { items } = await resolveCartItems(db, lines, lang);
  if (items.length === 0) {
    return { ok: false, message: t(lang, "orders.noProducts"), outOfStock: [] };
  }

  const units = toOrderUnits(items);
  // Aggregate demand per variant from the resolved units: several cart lines
  // (or blend base + additives) can target the same variant, and the guarded
  // decrement must reserve the combined amount in one statement.
  const demandByVariant = new Map<string, number>();
  for (const unit of units) {
    demandByVariant.set(unit.variantId, (demandByVariant.get(unit.variantId) ?? 0) + unit.quantity);
  }
  // resolveCartItems clamps line quantities to the stock snapshot, so raw
  // requested amounts are tracked separately to catch over-demand.
  const requested = new Map<string, number>();
  for (const line of lines) {
    if (isBlendEntry(line)) {
      requested.set(line.baseVariantId, (requested.get(line.baseVariantId) ?? 0) + 1);
      for (const a of line.additives) {
        requested.set(a.variantId, (requested.get(a.variantId) ?? 0) + a.qty);
      }
    } else {
      requested.set(line.variantId, (requested.get(line.variantId) ?? 0) + line.quantity);
    }
  }

  const existing = await findOrderByNonce(db, nonce);
  if (existing) {
    return { ok: true, orderId: existing.id, orderNumber: existing.number, total: existing.total };
  }

  const totals = computeTotals(items);
  let lastConflict = false;

  for (let attempt = 0; attempt < MAX_ORDER_ATTEMPTS; attempt++) {
    const orderNumber = generateOrderNumber();
    const orderId = crypto.randomUUID();

    // D1 does not support interactive transactions, but drizzle's libsql
    // driver runs db.batch([...]) as one implicit transaction: every write
    // below (stock decrements + order + items) commits or rolls back together.
    // Sufficiency is enforced against a fresh read before batching; because a
    // guarded UPDATE matching 0 rows is not an error, each decrement is
    // verified after the batch and the whole order is compensated if a
    // concurrent checkout won the stock race.
    const variantIds = [...demandByVariant.keys()];
    const stockRows = await db
      .select({ id: schema.productVariant.id, stock: schema.productVariant.stock })
      .from(schema.productVariant)
      .where(inArray(schema.productVariant.id, variantIds));
    const stockById = new Map(stockRows.map((row) => [row.id, row.stock]));
    const insufficient = units.filter((u) => {
      const current = stockById.get(u.variantId);
      return current === undefined || (requested.get(u.variantId) ?? u.quantity) > current;
    });
    if (insufficient.length > 0) {
      return {
        ok: false,
        message: t(lang, "orders.outOfStock"),
        outOfStock: [...new Set(insufficient.map((u) => u.name))],
      };
    }

    try {
      const decrementEntries = [...demandByVariant];
      const batchResult = await db.batch([
        db.insert(schema.order).values({
          id: orderId,
          number: orderNumber,
          nonce,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          total: totals.total,
          status: "paid",
          userId: userId ?? null,
          createdAt: Date.now(),
        }),
        db.insert(schema.orderItem).values(
          units.map((u) => ({
            orderId,
            productId: u.productId,
            productName: u.name,
            variantName: u.variantName,
            quantity: u.quantity,
            unitPrice: u.unitPrice,
          })),
        ),
        ...decrementEntries.map(([variantId, quantity]) =>
          db
            .update(schema.productVariant)
            .set({ stock: sql`${schema.productVariant.stock} - ${quantity}` })
            .where(
              and(
                eq(schema.productVariant.id, variantId),
                gte(schema.productVariant.stock, quantity),
              ),
            ),
        ),
      ]);
      const lostStock = decrementEntries.filter(
        (_, i) => affectedRowCount(batchResult[2 + i]) !== 1,
      );
      if (lostStock.length > 0) {
        const appliedIds = decrementEntries
          .filter(([variantId]) => !lostStock.some(([lostId]) => lostId === variantId))
          .map(([variantId]) => variantId);
        const compensated = await compensateLostStockRace(db, orderId, appliedIds, demandByVariant);
        if (!compensated) {
          return { ok: false, message: t(lang, "orders.failed"), outOfStock: [] };
        }
        return {
          ok: false,
          message: t(lang, "orders.outOfStock"),
          outOfStock: [
            ...new Set(
              units.filter((u) => lostStock.some(([id]) => id === u.variantId)).map((u) => u.name),
            ),
          ],
        };
      }
      return { ok: true, orderId, orderNumber, total: totals.total };
    } catch (error) {
      // The batch is atomic: nothing was written, so retries just re-run it.

      if (isNonceConflict(error)) {
        const replayed = await findOrderByNonce(db, nonce);
        if (replayed) {
          return {
            ok: true,
            orderId: replayed.id,
            orderNumber: replayed.number,
            total: replayed.total,
          };
        }
        continue;
      }
      if (isOrderNumberConflict(error)) {
        lastConflict = true;
        continue;
      }
      if (isBusyError(error) && attempt < SQLITE_BUSY_RETRIES) {
        await sleep((attempt + 1) * 50);
        continue;
      }
      console.error("[createOrder] attempt failed", error);
      return { ok: false, message: t(lang, "orders.failed"), outOfStock: [] };
    }
  }

  return {
    ok: false,
    message: lastConflict ? t(lang, "orders.numberCollision") : t(lang, "orders.failed"),
    outOfStock: [],
  };
}
