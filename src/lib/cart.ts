import type { AdditiveKey, JarSize } from "./blends";

export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface BlendLineAdditive {
  key: AdditiveKey;
  variantId: string;
  qty: number;
}

export interface BlendLine {
  kind: "blend";
  id: string;
  baseVariantId: string;
  jarSize: JarSize;
  additives: BlendLineAdditive[];
}

export type CartEntry = CartLine | BlendLine;

export function isBlendEntry(line: CartEntry): line is BlendLine {
  return (line as BlendLine).kind === "blend";
}

export interface RegularCartItem extends CartLine {
  productId: string;
  name: string;
  variantName: string;
  slug: string;
  image: string;
  price: number;
  stock: number;
}

export interface BlendAdditive {
  key: AdditiveKey;
  variantId: string;
  productId: string;
  name: string;
  image: string;
  qty: number;
  price: number;
  stock: number;
}

export interface BlendCartItem {
  kind: "blend";
  id: string;
  baseVariantId: string;
  productId: string;
  name: string;
  variantName: string;
  image: string;
  jarSize: JarSize;
  basePrice: number;
  stock: number;
  quantity: 1;
  additives: BlendAdditive[];
}

export type CartItem = RegularCartItem | BlendCartItem;

export function isBlendItem(item: CartItem): item is BlendCartItem {
  return (item as BlendCartItem).kind === "blend";
}

export function itemId(item: CartItem): string {
  return isBlendItem(item) ? item.id : item.variantId;
}

export interface AddableProduct {
  id: string;
  name: string;
  slug: string;
}

export interface AddableVariant {
  id: string;
  name: string;
  image: string;
  price: number;
  stock: number;
}

export function regularItemPayload(
  product: AddableProduct,
  variant: AddableVariant,
): Omit<RegularCartItem, "quantity"> {
  return {
    variantId: variant.id,
    productId: product.id,
    name: product.name,
    variantName: variant.name,
    slug: product.slug,
    image: variant.image,
    price: variant.price,
    stock: variant.stock,
  };
}

export function blendTotal(item: BlendCartItem): number {
  return item.basePrice + item.additives.reduce((sum, a) => sum + a.price * a.qty, 0);
}

export function lineTotal(item: CartItem): number {
  return isBlendItem(item) ? blendTotal(item) : item.price * item.quantity;
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
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  return { itemCount, subtotal, shipping, total: subtotal + shipping };
}

export function addItem(
  items: CartItem[],
  product: Omit<RegularCartItem, "quantity">,
  quantity: number,
): CartItem[] {
  if (quantity <= 0 || product.stock <= 0) return items;
  const existing = items.find((i) => !isBlendItem(i) && i.variantId === product.variantId);
  const merged = existing ? existing.quantity + quantity : quantity;
  const next = Math.min(merged, product.stock);
  if (!existing) return [...items, { ...product, quantity: next }];
  return items.map((i) =>
    !isBlendItem(i) && i.variantId === product.variantId ? { ...i, quantity: next } : i,
  );
}

export function addBlendItem(
  items: CartItem[],
  blend: Omit<BlendCartItem, "kind" | "id">,
): CartItem[] {
  const item: BlendCartItem = { ...blend, kind: "blend", id: `blend-${crypto.randomUUID()}` };
  return [...items, item];
}

export function adjustQuantity(items: CartItem[], variantId: string, delta: number): CartItem[] {
  return items
    .map((i) =>
      !isBlendItem(i) && i.variantId === variantId ? { ...i, quantity: i.quantity + delta } : i,
    )
    .filter((i) => i.quantity > 0)
    .map((i) => (!isBlendItem(i) ? { ...i, quantity: Math.min(i.quantity, i.stock) } : i));
}

export function removeItem(items: CartItem[], variantId: string): CartItem[] {
  return items.filter((i) => isBlendItem(i) || i.variantId !== variantId);
}

export function removeById(items: CartItem[], id: string): CartItem[] {
  return items.filter((i) => itemId(i) !== id);
}
