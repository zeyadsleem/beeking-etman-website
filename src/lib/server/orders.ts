import { and, eq, gte, sql } from "drizzle-orm";
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

function isOutOfStockError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("OUT_OF_STOCK:");
}

interface OrderUnit {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  stock: number;
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
        stock: item.stock,
      });
      for (const a of item.additives) {
        units.push({
          variantId: a.variantId,
          productId: a.productId,
          name: a.name,
          variantName: "",
          quantity: a.qty,
          unitPrice: a.price,
          stock: a.stock,
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
        stock: item.stock,
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

  const units = toOrderUnits(items);
  const outOfStock = [
    ...new Set(
      units.filter((u) => (requested.get(u.variantId) ?? u.quantity) > u.stock).map((u) => u.name),
    ),
  ];
  if (outOfStock.length > 0) {
    return {
      ok: false,
      message: t(lang, "orders.outOfStock"),
      outOfStock,
    };
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
    try {
      await db.transaction(async (tx) => {
        for (const unit of units) {
          const updated = await tx
            .update(schema.productVariant)
            .set({ stock: sql`${schema.productVariant.stock} - ${unit.quantity}` })
            .where(
              and(
                eq(schema.productVariant.id, unit.variantId),
                gte(schema.productVariant.stock, unit.quantity),
              ),
            )
            .returning({ id: schema.productVariant.id });
          if (updated.length === 0) throw new Error(`OUT_OF_STOCK:${unit.name}`);
        }
        await tx.insert(schema.order).values({
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
        });
        await tx.insert(schema.orderItem).values(
          units.map((u) => ({
            orderId,
            productId: u.productId,
            productName: u.name,
            variantName: u.variantName,
            quantity: u.quantity,
            unitPrice: u.unitPrice,
          })),
        );
      });
      return { ok: true, orderId, orderNumber, total: totals.total };
    } catch (error) {
      if (isOutOfStockError(error)) {
        return {
          ok: false,
          message: t(lang, "orders.outOfStock"),
          outOfStock: [error.message.slice("OUT_OF_STOCK:".length)],
        };
      }
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
      return { ok: false, message: t(lang, "orders.failed"), outOfStock: [] };
    }
  }

  return {
    ok: false,
    message: lastConflict ? t(lang, "orders.numberCollision") : t(lang, "orders.failed"),
    outOfStock: [],
  };
}
