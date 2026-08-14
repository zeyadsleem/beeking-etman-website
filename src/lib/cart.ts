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
