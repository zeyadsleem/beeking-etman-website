import { browser } from "$app/environment";
import { z } from "zod";
import {
  addBlendItem,
  addItem,
  adjustQuantity,
  computeTotals,
  isBlendItem,
  removeById,
} from "./cart";
import type { BlendCartItem, CartEntry, CartItem, CartTotals, RegularCartItem } from "./cart";
import type { JarSize } from "./blends";

const STORAGE_KEY = "honey_cart_v2";

const RegularItemSchema = z.object({
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

const BlendAdditiveSchema = z.object({
  key: z.enum(["royalJelly", "propolis", "ginseng", "palmPollen", "beePollen"]),
  variantId: z.string(),
  productId: z.string(),
  name: z.string(),
  image: z.string(),
  qty: z.number(),
  price: z.number(),
  stock: z.number(),
});

const BlendItemSchema = z.object({
  kind: z.literal("blend"),
  id: z.string(),
  baseVariantId: z.string(),
  productId: z.string(),
  name: z.string(),
  variantName: z.string(),
  image: z.string(),
  jarSize: z.enum(["half", "full"]),
  basePrice: z.number(),
  stock: z.number(),
  quantity: z.literal(1),
  additives: z.array(BlendAdditiveSchema),
});

const CartItemSchema = z.union([RegularItemSchema, BlendItemSchema]);

interface CartUiState {
  items: CartItem[];
  drawerOpen: boolean;
}

const state = $state<CartUiState>({ items: [], drawerOpen: false });

function toEntries(items: CartItem[]): CartEntry[] {
  return items.map((i) =>
    isBlendItem(i)
      ? {
          kind: "blend" as const,
          id: i.id,
          baseVariantId: i.baseVariantId,
          jarSize: i.jarSize as JarSize,
          additives: i.additives.map((a) => ({ key: a.key, variantId: a.variantId, qty: a.qty })),
        }
      : { variantId: i.variantId, quantity: i.quantity },
  );
}

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
    body: JSON.stringify({ items: toEntries(items) }),
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
      body: JSON.stringify({ items: toEntries(state.items) }),
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
  void refreshNamesFromServer();
}

interface CartNameRefreshItem {
  variantId: string;
  name: string;
  variantName: string;
}

async function refreshNamesFromServer(): Promise<void> {
  const regularItems = state.items.filter((i) => !isBlendItem(i));
  if (regularItems.length === 0) return;
  try {
    const res = await fetch("/api/cart");
    if (!res.ok) return;
    const data = (await res.json()) as { items: CartNameRefreshItem[] };
    const byVariant = new Map(data.items.map((i) => [i.variantId, i]));
    let changed = false;
    state.items = state.items.map((item) => {
      if (isBlendItem(item)) return item;
      const server = byVariant.get(item.variantId);
      if (!server || (server.name === item.name && server.variantName === item.variantName)) {
        return item;
      }
      changed = true;
      return { ...item, name: server.name, variantName: server.variantName };
    });
    if (changed) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
      } catch {
        // Storage unavailable; the in-memory names are already updated.
      }
    }
  } catch {
    // Server refresh is best-effort; keep the cached names.
  }
}

export function addToCart(product: Omit<RegularCartItem, "quantity">, quantity = 1): void {
  state.items = addItem(state.items, product, quantity);
  persist(state.items);
}

export function addBlend(blend: Omit<BlendCartItem, "kind" | "id">): void {
  state.items = addBlendItem(state.items, blend);
  persist(state.items);
}

export function setQuantity(variantId: string, quantity: number): void {
  const current = state.items.find((i) => !isBlendItem(i) && i.variantId === variantId);
  if (!current) return;
  state.items = adjustQuantity(state.items, variantId, quantity - current.quantity);
  persist(state.items);
}

export function removeFromCart(id: string): void {
  state.items = removeById(state.items, id);
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
