import { browser } from "$app/environment";
import { addItem, adjustQuantity, computeTotals, removeItem } from "./cart";
import type { CartItem, CartTotals } from "./cart";

const STORAGE_KEY = "honey_cart_v1";

interface CartUiState {
  items: CartItem[];
  drawerOpen: boolean;
}

const state = $state<CartUiState>({ items: [], drawerOpen: false });

function persist(items: CartItem[]): void {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  void fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    }),
  }).catch(() => undefined);
}

export function loadCart(): void {
  if (!browser) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.items = JSON.parse(raw) as CartItem[];
  } catch {
    state.items = [];
  }
}

export function addToCart(product: Omit<CartItem, "quantity">, quantity = 1): void {
  state.items = addItem(state.items, product, quantity);
  persist(state.items);
}

export function setQuantity(productId: string, quantity: number): void {
  const current = state.items.find((i) => i.productId === productId);
  if (!current) return;
  state.items = adjustQuantity(state.items, productId, quantity - current.quantity);
  persist(state.items);
}

export function removeFromCart(productId: string): void {
  state.items = removeItem(state.items, productId);
  persist(state.items);
}

export function clearCart(): void {
  state.items = [];
  persist(state.items);
}

export function openDrawer(): void {
  state.drawerOpen = true;
}

export function closeDrawer(): void {
  state.drawerOpen = false;
}

export function getTotals(): CartTotals {
  return computeTotals(state.items);
}

export function cartCount(): number {
  return state.items.reduce((n, i) => n + i.quantity, 0);
}

export { state };
