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
  import { isBlendItem, itemId, lineTotal } from "$lib/cart";
  import { blendLineDetail } from "$lib/blends";
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
          {#each cartState.items as item (itemId(item))}
            <li class="flex gap-3 rounded-xl border border-cocoa-100 bg-paper p-3">
              <a
                href={isBlendItem(item) ? "/blends" : `/products/${item.slug}`}
                class="w-16 shrink-0 self-stretch overflow-hidden rounded-xl border border-cocoa-200 bg-cocoa-100"
              >
                <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
              </a>
              <div class="flex min-w-0 flex-1 flex-col">
                <div class="flex items-start justify-between gap-2">
                  <a
                    href={isBlendItem(item) ? "/blends" : `/products/${item.slug}`}
                    class="line-clamp-1 text-sm font-semibold text-cocoa-800 transition-colors hover:text-honey-700"
                  >
                    {item.name}
                  </a>
                  <button
                    type="button"
                    class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-cocoa-400 transition-colors hover:bg-clay-50 hover:text-clay-600"
                    onclick={() => removeFromCart(itemId(item))}
                    aria-label={t(lang, "cart.remove")}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
                {#if isBlendItem(item)}
                  <span class="mt-0.5 line-clamp-2 text-[11px] font-medium text-cocoa-500">
                    {blendLineDetail(item.variantName, item.additives)}
                  </span>
                {:else}
                  <span class="mt-0.5 text-[11px] font-medium text-cocoa-500">{item.variantName}</span>
                {/if}
                <div class="mt-auto flex items-center justify-between gap-2 pt-2">
                  {#if isBlendItem(item)}
                    <span class="text-xs text-cocoa-500">× 1</span>
                  {:else}
                    <QuantityPicker lang={lang} value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.variantId, q)} />
                  {/if}
                  <Price amount={lineTotal(item)} lang={lang} className="text-sm font-bold text-cocoa-900" />
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      {#if cartState.items.length > 0}
        <footer class="border-t border-cocoa-200 bg-paper p-4">
          <div class="mb-1 flex justify-between text-sm text-cocoa-700">
            <span>{t(lang, "cart.subtotal")}</span>
            <Price amount={getTotals().subtotal} lang={lang} />
          </div>
          <p class="mb-3 text-xs text-honey-700">
            {#if getTotals().shipping === 0}{t(lang, "cart.freeShipping")}{:else}{t(lang, "cart.shipping")} {formatEGP(getTotals().shipping, lang)}{/if}
          </p>
          <Button variant="outline" href="/cart" class="w-full text-sm" onclick={closeDrawer}>{t(lang, "cart.viewCart")}</Button>
          <Button variant="primary" href="/checkout" class="mt-2 w-full text-sm" onclick={closeDrawer}>{t(lang, "cart.checkout")}</Button>
        </footer>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>