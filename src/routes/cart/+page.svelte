<script lang="ts">
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import CartLineItem from "$lib/components/CartLineItem.svelte";
  import CartTotals from "$lib/components/CartTotals.svelte";
  import HoneycombIcon from "$lib/components/HoneycombIcon.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { clearCart, getTotals, loadCart, state as cartState } from "$lib/cart-store.svelte";
  import { itemId } from "$lib/cart";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  let totals = $state(getTotals());

  onMount(loadCart);
  $effect(() => {
    totals = getTotals();
  });
</script>

<svelte:head><title>{t(lang, "cart.pageTitle")}</title></svelte:head>

<div class="mt-6">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "cart.title")}</SectionTitle>

  {#if cartState.items.length === 0}
    <div class="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-cocoa-200 bg-parchment p-14 text-center">
      <HoneycombIcon size={56} stroke="#dcd8d0" />
      <p class="mt-4 text-lg font-semibold text-cocoa-600">{t(lang, "cart.emptyPage")}</p>
      <Button variant="primary" href="/products" class="mt-5">{t(lang, "cart.browse")}</Button>
    </div>
  {:else}
    <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul class="space-y-4">
        {#each cartState.items as item (itemId(item))}
          <CartLineItem {item} {lang} />
        {/each}
      </ul>

      <aside class="h-fit rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
        <h2 class="headline text-xl text-cocoa-900">{t(lang, "cart.summary")}</h2>
        <CartTotals {totals} {lang} itemCount={totals.itemCount} />
        <Button variant="primary" href="/checkout" class="mt-5 w-full">{t(lang, "cart.checkout")}</Button>
        <a href="/products" class="mt-2 block text-center text-sm text-cocoa-500 transition hover:text-honey-700">{t(lang, "cart.continue")}</a>
        <button type="button" class="mt-2 block w-full text-center text-xs text-cocoa-400 transition hover:text-clay-600" onclick={clearCart}>{t(lang, "cart.clear")}</button>
      </aside>
    </div>
  {/if}
</div>