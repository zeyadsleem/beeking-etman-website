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
  <div class="fixed inset-0 z-40 bg-cocoa-950/60 backdrop-blur-sm" role="presentation" onclick={closeDrawer}></div>
  <div
    bind:this={drawer}
    class="fixed inset-y-0 start-0 z-50 flex w-80 max-w-[85vw] flex-col bg-paper shadow-warm-lg"
    role="dialog"
    aria-modal="true"
    aria-label="سلة التسوق"
    data-testid="cart-drawer"
  >
    <header class="honeycomb-bg relative flex items-center justify-between border-b border-honey-200 bg-parchment px-4 py-3">
      <h2 class="headline flex items-center gap-2 text-xl text-cocoa-900">
        <svg width="20" height="22" viewBox="0 0 26 30" fill="none" aria-hidden="true">
          <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="#e5a82e" stroke="#a35110" stroke-width="1.4" />
          <path d="M13 6.5l7.5 4.4v8.7L13 24l-7.5-4.4v-8.7L13 6.5Z" fill="#fff7e6" />
        </svg>
        سلة التسوق
      </h2>
      <button
        type="button"
        bind:this={closeButton}
        class="grid h-9 w-9 place-items-center rounded-full text-cocoa-500 transition hover:bg-honey-100 hover:text-honey-800"
        onclick={closeDrawer}
        aria-label="إغلاق"
      >✕</button>
    </header>

    {#if cartState.items.length === 0}
      <div class="dot-bg flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <svg width="48" height="54" viewBox="0 0 26 30" fill="none" aria-hidden="true">
          <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke="#ddc5a8" stroke-width="1.6" />
        </svg>
        <p class="text-cocoa-500">سلتك فارغة — أضف بعض العسل!</p>
        <a href="/products" class="btn-outline mt-2 text-sm" onclick={closeDrawer}>تصفح المتجر</a>
      </div>
    {:else}
      <ul class="flex-1 space-y-4 overflow-y-auto p-4">
        {#each cartState.items as item (item.variantId)}
          <li class="flex gap-3 rounded-xl border border-cocoa-100 bg-parchment p-2.5 shadow-warm-sm">
            <a href={`/products/${item.slug}`} class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-honey-200 bg-honey-100">
              <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
            </a>
            <div class="flex flex-1 flex-col gap-1.5">
              <a href={`/products/${item.slug}`} class="line-clamp-1 text-sm font-semibold text-cocoa-800 hover:text-honey-700">{item.name}</a>
              <span class="text-[11px] font-medium text-cocoa-500">{item.variantName}</span>
              <QuantityPicker value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.variantId, q)} />
              <button type="button" class="w-fit text-xs text-cocoa-400 transition hover:text-clay-600" onclick={() => removeFromCart(item.variantId)}>إزالة</button>
            </div>
            <Price amount={item.price * item.quantity} className="ms-auto self-start text-sm font-bold text-honey-800" />
          </li>
        {/each}
      </ul>
    {/if}

    {#if cartState.items.length > 0}
      <footer class="border-t border-honey-200 bg-parchment p-4">
        <div class="mb-1 flex justify-between text-sm text-cocoa-700">
          <span>المجموع الفرعي</span>
          <Price amount={getTotals().subtotal} />
        </div>
        <p class="mb-3 text-xs text-honey-700">
          {#if getTotals().shipping === 0}توصيل مجاني ✓{:else}الشحن {formatEGP(getTotals().shipping)}{/if}
        </p>
        <a href="/cart" class="btn-dark w-full text-sm" onclick={closeDrawer}>عرض السلة</a>
        <a href="/checkout" class="btn-honey mt-2 w-full text-sm" onclick={closeDrawer}>إتمام الشراء</a>
      </footer>
    {/if}
  </div>
{/if}