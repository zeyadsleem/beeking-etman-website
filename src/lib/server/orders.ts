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
  const requested = new Map(lines.map((l) => [l.productId, l.quantity]));
  const outOfStock = products
    .filter((p) => (requested.get(p.id) ?? 0) > p.stock)
    .map((p) => p.name);
  if (outOfStock.length > 0) {
    return { ok: false, message: "نفدت الكمية لبعض المنتجات", outOfStock };
  }

  const items = linesToItems(lines, catalog);
  if (items.length === 0) return { ok: false, message: "لا توجد منتجات متاحة", outOfStock: [] };

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
