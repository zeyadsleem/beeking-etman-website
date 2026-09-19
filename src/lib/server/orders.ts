import { eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { cartItemPayload, computeTotals } from "$lib/cart";
import { DEFAULT_GOVERNORATE, type GovernorateCode } from "$lib/shipping";
import type { CartItem, CartLine } from "$lib/cart";
import { localized, t, type Lang } from "$lib/i18n/messages";
import type { PaymentMethod } from "$lib/settlement/types";
import * as schema from "$lib/server/db/schema";
import { isBusyError, sleep, SQLITE_BUSY_RETRIES } from "$lib/server/sqlite";

export interface Customer {
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  governorate?: GovernorateCode;
}

export type CreateOrderResult =
  | {
      ok: true;
      outcome: "created" | "replayed";
      orderId: string;
      orderNumber: string;
      total: number;
    }
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

function isOutOfStockError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("OUT_OF_STOCK");
}

function formatUnitName(unit: OrderUnit): string {
  return `${unit.name} - ${unit.variantName}`;
}

interface OrderUnit {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
}

interface VariantSnapshot {
  id: string;
  productId: string;
  name: string;
  nameEn: string;
  price: number;
  stock: number;
  image: string;
  department: string;
  productName: string;
  productNameEn: string;
  published: boolean;
}

async function loadVariantSnapshots(
  db: LibSQLDatabase<typeof schema>,
  variantIds: string[],
): Promise<Map<string, VariantSnapshot>> {
  if (variantIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: schema.productVariant.id,
      productId: schema.productVariant.productId,
      name: schema.productVariant.name,
      nameEn: schema.productVariant.nameEn,
      price: schema.productVariant.price,
      stock: schema.productVariant.stock,
      image: schema.productVariant.image,
      department: schema.product.department,
      productName: schema.product.name,
      productNameEn: schema.product.nameEn,
      published: schema.product.published,
    })
    .from(schema.productVariant)
    .innerJoin(schema.product, eq(schema.product.id, schema.productVariant.productId))
    .where(inArray(schema.productVariant.id, variantIds));
  return new Map(rows.map((row) => [row.id, row]));
}

function validateCart(
  lines: CartLine[],
  snapshots: Map<string, VariantSnapshot>,
  lang: Lang,
): { ok: true; items: CartItem[]; units: OrderUnit[] } | { ok: false; outOfStock: string[] } {
  const items: CartItem[] = [];
  const units: OrderUnit[] = [];
  const outOfStock = new Set<string>();

  for (const line of lines) {
    const v = snapshots.get(line.variantId);
    if (!v || !v.published) {
      outOfStock.add(
        v ? localized(v.productName, v.productNameEn, lang) : t(lang, "orders.unknownProduct"),
      );
      continue;
    }
    units.push({
      variantId: v.id,
      productId: v.productId,
      name: localized(v.productName, v.productNameEn, lang),
      variantName: localized(v.name, v.nameEn, lang),
      quantity: line.quantity,
      unitPrice: v.price,
    });
    items.push({
      ...cartItemPayload(
        {
          id: v.productId,
          name: localized(v.productName, v.productNameEn, lang),
          slug: "",
          categorySlug: "",
          department:
            v.department === "honey" || v.department === "equipment" ? v.department : "honey",
        },
        {
          id: v.id,
          name: localized(v.name, v.nameEn, lang),
          image: v.image,
          price: v.price,
          stock: v.stock,
        },
      ),
      quantity: line.quantity,
    });
  }

  const demand = new Map<string, { name: string; variantName: string; quantity: number }>();
  for (const u of units) {
    const existing = demand.get(u.variantId);
    if (existing) {
      existing.quantity += u.quantity;
    } else {
      demand.set(u.variantId, { name: u.name, variantName: u.variantName, quantity: u.quantity });
    }
  }
  for (const [variantId, d] of demand) {
    const v = snapshots.get(variantId);
    if (v && d.quantity > v.stock) {
      outOfStock.add(`${d.name} - ${d.variantName}`);
    }
  }

  if (items.length !== lines.length) {
    outOfStock.add(t(lang, "orders.outOfStock"));
  }
  if (outOfStock.size > 0) {
    return { ok: false, outOfStock: [...outOfStock] };
  }
  return { ok: true, items, units };
}

async function findOrderByNonce(
  db: LibSQLDatabase<typeof schema>,
  nonce: string,
): Promise<{ id: string; number: string; total: number; userId: string | null } | undefined> {
  return db
    .select({
      id: schema.order.id,
      number: schema.order.number,
      total: schema.order.total,
      userId: schema.order.userId,
    })
    .from(schema.order)
    .where(eq(schema.order.nonce, nonce))
    .get();
}

export interface SettlementInput {
  method: PaymentMethod;
  /** Stock reservation deadline; null for legacy callers that do not hold. */
  holdExpiresAt: number | null;
}

export async function createOrder(
  db: LibSQLDatabase<typeof schema>,
  lines: CartLine[],
  customer: Customer,
  nonce: string,
  userId?: string,
  lang: Lang = "ar",
  settlement: SettlementInput = { method: "simulated", holdExpiresAt: null },
): Promise<CreateOrderResult> {
  const existing = await findOrderByNonce(db, nonce);
  if (existing) {
    if (existing.userId !== (userId ?? null)) {
      return { ok: false, message: t(lang, "orders.failed"), outOfStock: [] };
    }
    return {
      ok: true,
      outcome: "replayed",
      orderId: existing.id,
      orderNumber: existing.number,
      total: existing.total,
    };
  }

  if (lines.length === 0) {
    return { ok: false, message: t(lang, "orders.cartEmpty"), outOfStock: [] };
  }

  const variantIds = lines.map((line) => line.variantId);
  const snapshots = await loadVariantSnapshots(db, [...new Set(variantIds)]);
  const validation = validateCart(lines, snapshots, lang);
  if (!validation.ok) {
    return { ok: false, message: t(lang, "orders.outOfStock"), outOfStock: validation.outOfStock };
  }
  const { items, units } = validation;

  const governorate = customer.governorate ?? DEFAULT_GOVERNORATE;
  const totals = computeTotals(items, governorate);
  let lastConflict = false;

  for (let attempt = 0; attempt < MAX_ORDER_ATTEMPTS; attempt++) {
    const orderNumber = generateOrderNumber();
    const orderId = crypto.randomUUID();

    try {
      await db.batch([
        db.insert(schema.order).values({
          id: orderId,
          number: orderNumber,
          nonce,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          governorate,
          shippingCost: totals.shipping,
          total: totals.total,
          status: "pending_confirmation",
          paymentStatus: "unpaid",
          paymentMethod: settlement.method,
          holdExpiresAt: settlement.holdExpiresAt,
          stockVersion: "atomic",
          userId: userId ?? null,
          createdAt: Date.now(),
        }),
        db.insert(schema.orderItem).values(
          units.map((u) => ({
            orderId,
            productId: u.productId,
            variantId: u.variantId,
            productName: u.name,
            variantName: u.variantName,
            quantity: u.quantity,
            unitPrice: u.unitPrice,
          })),
        ),
      ]);
      return { ok: true, outcome: "created", orderId, orderNumber, total: totals.total };
    } catch (error) {
      if (isOutOfStockError(error)) {
        return {
          ok: false,
          message: t(lang, "orders.outOfStock"),
          outOfStock: units.map(formatUnitName),
        };
      }
      if (isNonceConflict(error)) {
        const replayed = await findOrderByNonce(db, nonce);
        if (replayed) {
          if (replayed.userId !== (userId ?? null)) {
            return { ok: false, message: t(lang, "orders.failed"), outOfStock: [] };
          }
          return {
            ok: true,
            outcome: "replayed",
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
      throw error;
    }
  }

  return {
    ok: false,
    message: lastConflict ? t(lang, "orders.numberCollision") : t(lang, "orders.failed"),
    outOfStock: [],
  };
}
