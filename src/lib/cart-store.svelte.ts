import { browser } from "$app/environment";
import { z } from "zod";
import { addItem, adjustQuantity, computeTotals, removeItem } from "./cart";
import type { CartItem, CartTotals } from "./cart";

const STORAGE_KEY = "honey_cart_v2";

const CartItemSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  name: z.string(),
  variantName: z.string(),
  slug: z.string(),
  image: z.string(),
  quantity: z.number(),
  price: z.number(),
  stock: z.number(),
});

interface CartUiState {
  items: CartItem[];
  drawerOpen: boolean;
}

const state = $state<CartUiState>({ items: [], drawerOpen: false });

function persist(items: CartItem[]): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable (private mode / quota); the in-memory cart keeps the update.
  }
  void fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    }),
  }).catch(() => undefined);
}

let syncBound = false;

function bindCrossTabSync(): void {
  if (syncBound || !browser) return;
  syncBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return;
    const parsed = CartItemSchema.array().safeParse(JSON.parse(event.newValue));
    state.items = parsed.success ? parsed.data : [];
    void fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: state.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      }),
    }).catch(() => undefined);
  });
}

export function loadCart(): void {
  if (!browser) return;
  bindCrossTabSync();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = CartItemSchema.array().safeParse(JSON.parse(raw));
      state.items = parsed.success ? parsed.data : [];
    }
  } catch {
    state.items = [];
  }
}

export function addToCart(product: Omit<CartItem, "quantity">, quantity = 1): void {
  state.items = addItem(state.items, product, quantity);
  persist(state.items);
}

export function setQuantity(variantId: string, quantity: number): void {
  const current = state.items.find((i) => i.variantId === variantId);
  if (!current) return;
  state.items = adjustQuantity(state.items, variantId, quantity - current.quantity);
  persist(state.items);
}

export function removeFromCart(variantId: string): void {
  state.items = removeItem(state.items, variantId);
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
