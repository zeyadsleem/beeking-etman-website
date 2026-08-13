<script lang="ts">
  import { onMount } from "svelte";
  import Price from "$lib/components/Price.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import {
    clearCart,
    getTotals,
    loadCart,
    removeFromCart,
    setQuantity,
    state as cartState,
  } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";

  let totals = $state(getTotals());

  onMount(loadCart);
  $effect(() => {
    totals = getTotals();
  });
</script>

<svelte:head><title>سلة التسوق — مملكة النحل</title></svelte:head>

<div class="mt-6">
  <h1 class="rule-flourish headline text-4xl text-cocoa-900">
    <i aria-hidden="true"></i>
    سلة التسوق
  </h1>

  {#if cartState.items.length === 0}
    <div class="dot-bg mt-10 flex flex-col items-center rounded-[1.8rem] border border-dashed border-cocoa-200 bg-parchment p-14 text-center">
      <svg width="56" height="62" viewBox="0 0 26 30" fill="none" aria-hidden="true">
        <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke="#ddc5a8" stroke-width="1.6" />
      </svg>
      <p class="mt-4 text-lg font-semibold text-cocoa-600">سلتك فارغة.</p>
      <a href="/products" class="btn-honey mt-5">تصفح المتجر</a>
    </div>
  {:else}
    <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul class="space-y-4">
        {#each cartState.items as item (item.variantId)}
          <li class="flex flex-col gap-3 rounded-2xl border border-cocoa-100 bg-parchment p-4 shadow-warm-sm sm:flex-row sm:items-center">
            <a href={`/products/${item.slug}`} class="arch-frame h-20 w-20 shrink-0 overflow-hidden border-2 border-honey-200 bg-honey-100">
              <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
            </a>
            <div class="flex flex-1 flex-col gap-1.5">
              <a href={`/products/${item.slug}`} class="headline text-base text-cocoa-900 hover:text-honey-700">{item.name}</a>
              <span class="text-sm font-medium text-cocoa-500">{item.variantName} — {formatEGP(item.price)}</span>
              <QuantityPicker value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.variantId, q)} />
              <button type="button" class="w-fit text-xs text-cocoa-400 transition hover:text-clay-600" onclick={() => removeFromCart(item.variantId)}>إزالة</button>
            </div>
            <Price amount={item.price * item.quantity} className="font-extrabold text-honey-800 sm:ms-auto" />
          </li>
        {/each}
      </ul>

      <aside class="h-fit rounded-2xl border border-honey-200 bg-gradient-to-b from-parchment to-honey-50 p-5 shadow-warm">
        <h2 class="headline text-xl text-cocoa-900">ملخص الطلب</h2>
        <dl class="mt-4 space-y-2 text-sm text-cocoa-700">
          <div class="flex justify-between"><dt>عدد القطع</dt><dd class="font-semibold">{totals.itemCount}</dd></div>
          <div class="flex justify-between"><dt>المجموع الفرعي</dt><dd class="font-semibold">{formatEGP(totals.subtotal)}</dd></div>
          <div class="flex justify-between"><dt>الشحن</dt><dd class="font-semibold">{totals.shipping === 0 ? "مجاني ✓" : formatEGP(totals.shipping)}</dd></div>
          <div class="mt-3 flex justify-between border-t border-honey-200 pt-3 text-base font-extrabold text-cocoa-900"><dt>الإجمالي</dt><dd>{formatEGP(totals.total)}</dd></div>
        </dl>
        <a href="/checkout" class="btn-honey mt-5 w-full">إتمام الشراء</a>
        <a href="/products" class="mt-2 block text-center text-sm text-cocoa-500 transition hover:text-honey-700">مواصلة التسوق</a>
        <button type="button" class="mt-2 block w-full text-center text-xs text-cocoa-400 transition hover:text-clay-600" onclick={clearCart}>تفريغ السلة</button>
      </aside>
    </div>
  {/if}
</div>