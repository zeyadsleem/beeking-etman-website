import { browser } from "$app/environment";
import { z } from "zod";
import {
  addBlendItem,
  addItem,
  adjustBlendQuantity,
  adjustQuantity,
  computeTotals,
  isBlendItem,
  itemId,
  removeById,
} from "./cart";
import { ADDITIVE_KEYS, JAR_SIZES, type AdditiveKey } from "./blends";
import type { BlendCartItem, CartEntry, CartItem, CartTotals, RegularCartItem } from "./cart";
import { trackAddToCart, trackRemoveFromCart } from "./analytics-events";

const STORAGE_KEY = "honey_cart_v2";

const AdditiveKeySchema = z.enum([...ADDITIVE_KEYS] as [AdditiveKey, ...AdditiveKey[]]);
const JarSizeSchema = z.enum(JAR_SIZES);

const RegularItemSchema = z.object({
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

const BlendAdditiveSchema = z.object({
  key: AdditiveKeySchema,
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
  jarSize: JarSizeSchema,
  basePrice: z.number(),
  stock: z.number(),
  quantity: z.number().positive().int(),
  additives: z.array(BlendAdditiveSchema),
});

const CartItemSchema = z.union([RegularItemSchema, BlendItemSchema]);

interface CartUiState {
  items: CartItem[];
  drawerOpen: boolean;
}

const state = $state<CartUiState>({ items: [], drawerOpen: false });

// ---- Optimistic rollback infrastructure ----

/** IDs of items with in-flight server sync — components can key off these for spinners. */
const syncing = $state<Set<string>>(new Set());

/** Last sync error message — clears on next successful sync. */
let syncError = $state<string | null>(null);

function toEntries(items: CartItem[]): CartEntry[] {
  return items.map((i) =>
    isBlendItem(i)
      ? {
          kind: "blend" as const,
          id: i.id,
          baseVariantId: i.baseVariantId,
          jarSize: i.jarSize,
          additives: i.additives.map((a) => ({ key: a.key, variantId: a.variantId, qty: a.qty })),
        }
      : { variantId: i.variantId, quantity: i.quantity },
  );
}

/** Snapshot current items before an optimistic mutation so we can rollback. */
function snapshot(): CartItem[] {
  return state.items.map((i) => ({ ...i }));
}

function persist(prev: CartItem[], next: CartItem[], opKey?: string): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable; the in-memory cart keeps the update.
  }

  if (opKey) syncing.add(opKey);
  syncPending = true;

  void fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: toEntries(next) }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`cart sync ${res.status}`);
      syncPending = false;
      syncError = null;
      if (opKey) syncing.delete(opKey);
    })
    .catch(() => {
      // Rollback: restore previous items
      state.items = prev;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
      } catch {
        // Storage unavailable; in-memory rollback already applied.
      }
      syncPending = false;
      syncError = "sync";
      if (opKey) syncing.delete(opKey);
    });
}

let syncBound = false;
let flushBound = false;
let syncPending = false;

// A hard navigation cancels an in-flight /api/cart fetch before the server
// can set the signed cart cookie, which would make the next document see an
// empty cart. Flush unsynced state via sendBeacon on pagehide.
function bindUnloadFlush(): void {
  if (flushBound || !browser) return;
  flushBound = true;
  window.addEventListener("pagehide", () => {
    if (!syncPending) return;
    syncPending = false;
    const body = JSON.stringify({ items: toEntries(state.items) });
    navigator.sendBeacon("/api/cart", new Blob([body], { type: "application/json" }));
  });
}

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
  bindUnloadFlush();
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
  const prev = snapshot();
  state.items = addItem(state.items, product, quantity);
  persist(prev, state.items, `add:${product.variantId}`);
  trackAddToCart({
    variantId: product.variantId,
    productId: product.productId,
    name: product.name,
    price: product.price,
    quantity,
  });
}

export function addBlend(blend: Omit<BlendCartItem, "kind" | "id">): void {
  const prev = snapshot();
  state.items = addBlendItem(state.items, blend);
  persist(prev, state.items, `blend:${blend.baseVariantId}`);
}

export function setQuantity(variantId: string, quantity: number): void {
  const current = state.items.find((i) => !isBlendItem(i) && i.variantId === variantId);
  if (!current) return;
  const prev = snapshot();
  state.items = adjustQuantity(state.items, variantId, quantity - current.quantity);
  persist(prev, state.items, `qty:${variantId}`);
}

export function setBlendQuantity(id: string, quantity: number): void {
  const current = state.items.find((i) => isBlendItem(i) && i.id === id);
  if (!current) return;
  const prev = snapshot();
  state.items = adjustBlendQuantity(state.items, id, quantity - current.quantity);
  persist(prev, state.items, `bqty:${id}`);
}

export function removeFromCart(id: string): void {
  const item = state.items.find((i) => itemId(i) === id);
  if (item) {
    trackRemoveFromCart({
      variantId: isBlendItem(item) ? item.baseVariantId : item.variantId,
      name: item.name,
    });
  }
  const prev = snapshot();
  state.items = removeById(state.items, id);
  persist(prev, state.items, `rm:${id}`);
}

export function clearCart(): void {
  const prev = snapshot();
  state.items = [];
  persist(prev, state.items, "clear");
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

/** Check if a specific item is currently syncing to the server. */
export function isSyncing(opKey: string): boolean {
  return syncing.has(opKey);
}

/** Check if any item is currently syncing. */
export function hasSyncPending(): boolean {
  return syncing.size > 0;
}

/** Last sync error message — clears on next successful sync. */
export function getSyncError(): string | null {
  return syncError;
}

export { state };
