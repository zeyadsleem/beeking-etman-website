<script lang="ts">
  import { onMount } from "svelte";
  import { Dialog } from "bits-ui";
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
  import Button from "./Button.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang = "ar" }: { lang?: Lang } = $props();

  onMount(loadCart);
</script>

<Dialog.Root bind:open={cartState.drawerOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-cocoa-950/40 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed inset-y-0 start-0 z-50 flex w-80 max-w-[85vw] flex-col border-e border-cocoa-100 bg-parchment shadow-warm-lg focus:outline-none"
      data-testid="cart-drawer"
    >
      <header class="flex items-center justify-between border-b border-cocoa-200 bg-parchment px-4 py-3">
        <Dialog.Title class="headline text-xl text-cocoa-900">{t(lang, "cart.title")}</Dialog.Title>
        <Dialog.Description class="sr-only">{t(lang, "cart.srDescription")}</Dialog.Description>
        <Dialog.Close
          class="grid h-9 w-9 place-items-center rounded-full text-cocoa-400 transition-colors hover:bg-cocoa-100 hover:text-cocoa-900"
          aria-label={t(lang, "cart.close")}
        >✕</Dialog.Close>
      </header>

      {#if cartState.items.length === 0}
        <div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <svg width="40" height="44" viewBox="0 0 26 30" fill="none" class="text-cocoa-300" aria-hidden="true">
            <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>
          <p class="text-cocoa-500">{t(lang, "cart.emptyDrawer")}</p>
          <Button variant="outline" href="/products" class="mt-2 text-sm" onclick={closeDrawer}>{t(lang, "cart.browse")}</Button>
        </div>
      {:else}
        <ul class="flex-1 space-y-4 overflow-y-auto p-4">
          {#each cartState.items as item (item.variantId)}
            <li class="flex gap-3 rounded-xl border border-cocoa-100 bg-paper p-2.5">
              <a href={`/products/${item.slug}`} class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-cocoa-200 bg-cocoa-100">
                <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
              </a>
              <div class="flex flex-1 flex-col gap-1.5">
                <a href={`/products/${item.slug}`} class="line-clamp-1 text-sm font-semibold text-cocoa-800 transition-colors hover:text-honey-700">{item.name}</a>
                <span class="text-[11px] font-medium text-cocoa-500">{item.variantName}</span>
                <QuantityPicker lang={lang} value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.variantId, q)} />
                <button type="button" class="w-fit text-xs text-cocoa-400 transition-colors hover:text-clay-600" onclick={() => removeFromCart(item.variantId)}>{t(lang, "cart.remove")}</button>
              </div>
              <Price amount={item.price * item.quantity} className="ms-auto self-start text-sm font-bold text-cocoa-900" />
            </li>
          {/each}
        </ul>
      {/if}

      {#if cartState.items.length > 0}
        <footer class="border-t border-cocoa-200 bg-paper p-4">
          <div class="mb-1 flex justify-between text-sm text-cocoa-700">
            <span>{t(lang, "cart.subtotal")}</span>
            <Price amount={getTotals().subtotal} />
          </div>
          <p class="mb-3 text-xs text-honey-700">
            {#if getTotals().shipping === 0}{t(lang, "cart.freeShipping")}{:else}{t(lang, "cart.shipping")} {formatEGP(getTotals().shipping)}{/if}
          </p>
          <Button variant="outline" href="/cart" class="w-full text-sm" onclick={closeDrawer}>{t(lang, "cart.viewCart")}</Button>
          <Button variant="primary" href="/checkout" class="mt-2 w-full text-sm" onclick={closeDrawer}>{t(lang, "cart.checkout")}</Button>
        </footer>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>