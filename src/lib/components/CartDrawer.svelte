<script lang="ts">
  import { onMount } from "svelte";
  import { formatEGP } from "$lib/currency";
  import {
    closeDrawer,
    getTotals,
    loadCart,
    removeFromCart,
    setQuantity,
    state as cartState,
  } from "$lib/cart-store.svelte";
  import QuantityPicker from "./QuantityPicker.svelte";
  import Price from "./Price.svelte";

  let closeButton = $state<HTMLButtonElement>();
  let drawer = $state<HTMLElement>();
  let lastFocused: HTMLElement | null = null;

  function onKey(event: KeyboardEvent) {
    if (!cartState.drawerOpen) return;
    if (event.key === "Escape") {
      closeDrawer();
      return;
    }
    if (event.key !== "Tab" || !drawer) return;
    const focusable = drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    loadCart();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  $effect(() => {
    if (cartState.drawerOpen) {
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeButton?.focus();
    } else if (lastFocused) {
      lastFocused.focus();
      lastFocused = null;
    }
  });
</script>

{#if cartState.drawerOpen}
  <div class="fixed inset-0 z-40 bg-stone-900/50" role="presentation" onclick={closeDrawer}></div>
  <div
    bind:this={drawer}
    class="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col bg-white shadow-xl"
    role="dialog"
    aria-modal="true"
    aria-label="سلة التسوق"
    data-testid="cart-drawer"
  >
    <header class="flex items-center justify-between border-b border-stone-200 px-4 py-3">
      <h2 class="text-lg font-bold">سلة التسوق</h2>
      <button type="button" bind:this={closeButton} class="text-stone-500 hover:text-stone-800" onclick={closeDrawer} aria-label="إغلاق">✕</button>
    </header>

    {#if cartState.items.length === 0}
      <div class="flex flex-1 items-center justify-center p-8 text-center text-stone-500">
        سلتك فارغة — أضف بعض العسل!
      </div>
    {:else}
      <ul class="flex-1 space-y-4 overflow-y-auto p-4">
        {#each cartState.items as item (item.productId)}
          <li class="flex gap-3">
            <a href={`/products/${item.slug}`} class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-honey-100">
              <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
            </a>
            <div class="flex flex-1 flex-col gap-1">
              <a href={`/products/${item.slug}`} class="line-clamp-1 text-sm font-semibold">{item.name}</a>
              <QuantityPicker value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.productId, q)} />
              <button type="button" class="w-fit text-xs text-stone-400 hover:text-red-600" onclick={() => removeFromCart(item.productId)}>إزالة</button>
            </div>
            <Price amount={item.price * item.quantity} className="ms-auto self-start text-sm font-bold text-honey-800" />
          </li>
        {/each}
      </ul>
    {/if}

    {#if cartState.items.length > 0}
      <footer class="border-t border-stone-200 p-4">
        <div class="mb-1 flex justify-between text-sm text-stone-600">
          <span>المجموع الفرعي</span>
          <Price amount={getTotals().subtotal} />
        </div>
        <p class="mb-3 text-xs text-honey-700">
          {#if getTotals().shipping === 0}توصيل مجاني ✓{:else}الشحن {formatEGP(getTotals().shipping)}{/if}
        </p>
        <a href="/cart" class="block rounded-full bg-stone-900 py-2.5 text-center font-semibold text-white hover:bg-stone-800" onclick={closeDrawer}>عرض السلة</a>
        <a href="/checkout" class="mt-2 block rounded-full bg-honey-600 py-2.5 text-center font-semibold text-white hover:bg-honey-700" onclick={closeDrawer}>إتمام الشراء</a>
      </footer>
    {/if}
  </div>
{/if}