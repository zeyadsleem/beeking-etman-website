import { z } from "zod";
import { DEFAULT_GOVERNORATE, computeShipping, type GovernorateCode } from "./shipping";

export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface CartItem extends CartLine {
  productId: string;
  name: string;
  variantName: string;
  slug: string;
  categorySlug: string;
  department: string;
  image: string;
  price: number;
  stock: number;
}

const CartItemSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  name: z.string(),
  variantName: z.string(),
  slug: z.string(),
  categorySlug: z.string(),
  department: z.string(),
  image: z.string(),
  quantity: z.number(),
  price: z.number(),
  stock: z.number(),
});

/**
 * Parses a stored cart payload entry by entry so a single invalid entry (for
 * example a legacy blend line) drops alone instead of discarding the valid
 * regular lines around it.
 */
export function parseStoredCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = CartItemSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function itemId(item: CartItem): string {
  return item.variantId;
}

export interface AddableProduct {
  id: string;
  name: string;
  slug: string;
  categorySlug: string;
  department: string;
}

export interface AddableVariant {
  id: string;
  name: string;
  image: string;
  price: number;
  stock: number;
}

export function cartItemPayload(
  product: AddableProduct,
  variant: AddableVariant,
): Omit<CartItem, "quantity"> {
  return {
    variantId: variant.id,
    productId: product.id,
    name: product.name,
    variantName: variant.name,
    slug: product.slug,
    categorySlug: product.categorySlug,
    department: product.department,
    image: variant.image,
    price: variant.price,
    stock: variant.stock,
  };
}

export function lineTotal(item: CartItem): number {
  return item.price * item.quantity;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
}

export const FREE_SHIPPING_THRESHOLD = 600_00;

export function computeTotals(
  items: CartItem[],
  governorate: GovernorateCode = DEFAULT_GOVERNORATE,
): CartTotals {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const shipping = computeShipping(subtotal, governorate);
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

export function removeById(items: CartItem[], id: string): CartItem[] {
  return items.filter((i) => itemId(i) !== id);
}
