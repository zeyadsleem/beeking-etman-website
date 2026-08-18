<script lang="ts">
  import { onMount } from "svelte";
  import Button from "$lib/components/Button.svelte";
  import Price from "$lib/components/Price.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import {
    clearCart,
    getTotals,
    loadCart,
    removeFromCart,
    setQuantity,
    state as cartState,
  } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import { isBlendItem, itemId, lineTotal } from "$lib/cart";
  import { blendLineDetail } from "$lib/blends";
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
      <svg width="56" height="62" viewBox="0 0 26 30" fill="none" aria-hidden="true">
        <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke="#dcd8d0" stroke-width="1.6" />
      </svg>
      <p class="mt-4 text-lg font-semibold text-cocoa-600">{t(lang, "cart.emptyPage")}</p>
      <Button variant="primary" href="/products" class="mt-5">{t(lang, "cart.browse")}</Button>
    </div>
  {:else}
    <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul class="space-y-4">
        {#each cartState.items as item (itemId(item))}
          <li class="flex gap-4 rounded-2xl border border-cocoa-100 bg-parchment p-4 shadow-warm-sm">
            <a
              href={isBlendItem(item) ? "/blends" : `/products/${item.slug}`}
              class="w-20 shrink-0 self-stretch overflow-hidden rounded-xl border border-cocoa-100 bg-cocoa-100 sm:w-24"
            >
              <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
            </a>
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <div class="flex items-start justify-between gap-3">
                <a
                  href={isBlendItem(item) ? "/blends" : `/products/${item.slug}`}
                  class="headline text-base leading-snug text-cocoa-900 hover:text-honey-700"
                >
                  {item.name}
                </a>
                <button
                  type="button"
                  class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-cocoa-400 transition-colors hover:bg-clay-50 hover:text-clay-600"
                  onclick={() => removeFromCart(itemId(item))}
                  aria-label={t(lang, "cart.remove")}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
              {#if isBlendItem(item)}
                <span class="line-clamp-2 text-sm font-medium text-cocoa-500">
                  {blendLineDetail(item.variantName, item.additives)}
                </span>
              {:else}
                <span class="text-sm font-medium text-cocoa-500">{t(lang, "cart.itemLine", { variantName: item.variantName, price: formatEGP(item.price, lang) })}</span>
              {/if}
              <div class="mt-auto flex items-center justify-between gap-3 pt-1.5">
                {#if isBlendItem(item)}
                  <span class="text-xs text-cocoa-500">× 1</span>
                {:else}
                  <QuantityPicker lang={lang} value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.variantId, q)} />
                {/if}
                <Price amount={lineTotal(item)} lang={lang} className="text-lg font-extrabold text-cocoa-900" />
              </div>
            </div>
          </li>
        {/each}
      </ul>

      <aside class="h-fit rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
        <h2 class="headline text-xl text-cocoa-900">{t(lang, "cart.summary")}</h2>
        <dl class="mt-4 space-y-2 text-sm text-cocoa-700">
          <div class="flex justify-between"><dt>{t(lang, "cart.itemCount")}</dt><dd class="font-semibold">{totals.itemCount}</dd></div>
          <div class="flex justify-between"><dt>{t(lang, "cart.subtotal")}</dt><dd class="font-semibold">{formatEGP(totals.subtotal, lang)}</dd></div>
          <div class="flex justify-between"><dt>{t(lang, "cart.shipping")}</dt><dd class="font-semibold">{totals.shipping === 0 ? t(lang, "cart.free") : formatEGP(totals.shipping, lang)}</dd></div>
          <div class="mt-3 flex justify-between border-t border-cocoa-100 pt-3 text-base font-extrabold text-cocoa-900"><dt>{t(lang, "cart.total")}</dt><dd>{formatEGP(totals.total, lang)}</dd></div>
        </dl>
        <Button variant="primary" href="/checkout" class="mt-5 w-full">{t(lang, "cart.checkout")}</Button>
        <a href="/products" class="mt-2 block text-center text-sm text-cocoa-500 transition hover:text-honey-700">{t(lang, "cart.continue")}</a>
        <button type="button" class="mt-2 block w-full text-center text-xs text-cocoa-400 transition hover:text-clay-600" onclick={clearCart}>{t(lang, "cart.clear")}</button>
      </aside>
    </div>
  {/if}
</div>