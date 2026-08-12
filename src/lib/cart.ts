export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CartItem extends CartLine {
  name: string;
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
  const existing = items.find((i) => i.productId === product.productId);
  const merged = existing ? existing.quantity + quantity : quantity;
  const next = Math.min(merged, product.stock);
  if (!existing) return [...items, { ...product, quantity: next }];
  return items.map((i) => (i.productId === product.productId ? { ...i, quantity: next } : i));
}

export function adjustQuantity(items: CartItem[], productId: string, delta: number): CartItem[] {
  return items
    .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + delta } : i))
    .filter((i) => i.quantity > 0)
    .map((i) => ({ ...i, quantity: Math.min(i.quantity, i.stock) }));
}

export function removeItem(items: CartItem[], productId: string): CartItem[] {
  return items.filter((i) => i.productId !== productId);
}

export function linesToItems(lines: CartLine[], catalog: Omit<CartItem, "quantity">[]): CartItem[] {
  return lines.flatMap((line) => {
    const product = catalog.find((p) => p.productId === line.productId);
    if (!product) return [];
    return [{ ...product, quantity: Math.min(line.quantity, product.stock) }];
  });
}
