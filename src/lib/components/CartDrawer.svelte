<script lang="ts">
  import { onMount } from "svelte";
  import { Dialog } from "bits-ui";
  import { formatEGP } from "$lib/currency";
  import { closeDrawer, getTotals, loadCart, state as cartState } from "$lib/cart-store.svelte";
  import { itemId } from "$lib/cart";
  import Button from "./Button.svelte";
  import CartLineItem from "./CartLineItem.svelte";
  import HoneycombIcon from "./HoneycombIcon.svelte";
  import Price from "./Price.svelte";
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
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </Dialog.Close>
      </header>

      {#if cartState.items.length === 0}
        <div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <HoneycombIcon size={40} class="text-cocoa-300" />
          <p class="text-cocoa-500">{t(lang, "cart.emptyDrawer")}</p>
          <Button variant="outline" href="/products" class="mt-2 text-sm" onclick={closeDrawer}>{t(lang, "cart.browse")}</Button>
        </div>
      {:else}
        <ul class="flex-1 space-y-4 overflow-y-auto p-4">
          {#each cartState.items as item (itemId(item))}
            <CartLineItem {item} {lang} size="drawer" />
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