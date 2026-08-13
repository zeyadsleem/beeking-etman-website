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

<svelte:head><title>سلة التسوق — بيت العسل</title></svelte:head>

<div class="mt-6">
  <h1 class="text-3xl font-extrabold">سلة التسوق</h1>

  {#if cartState.items.length === 0}
    <div class="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-500">
      <p class="text-lg">سلتك فارغة.</p>
      <a href="/products" class="mt-4 inline-block rounded-full bg-honey-600 px-6 py-3 font-semibold text-white hover:bg-honey-700">تصفح المتجر</a>
    </div>
  {:else}
    <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <ul class="space-y-4">
        {#each cartState.items as item (item.productId)}
          <li class="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center">
            <a href={`/products/${item.slug}`} class="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-honey-100">
              <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
            </a>
            <div class="flex flex-1 flex-col gap-1">
              <a href={`/products/${item.slug}`} class="font-semibold hover:text-honey-700">{item.name}</a>
              <span class="text-sm text-stone-500">{formatEGP(item.price)}</span>
              <QuantityPicker value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.productId, q)} />
              <button type="button" class="w-fit text-xs text-stone-400 hover:text-red-600" onclick={() => removeFromCart(item.productId)}>إزالة</button>
            </div>
            <Price amount={item.price * item.quantity} className="font-extrabold text-honey-800 sm:ms-auto" />
          </li>
        {/each}
      </ul>

      <aside class="h-fit rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-lg font-bold">ملخص الطلب</h2>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between"><dt>عدد القطع</dt><dd>{totals.itemCount}</dd></div>
          <div class="flex justify-between"><dt>المجموع الفرعي</dt><dd>{formatEGP(totals.subtotal)}</dd></div>
          <div class="flex justify-between"><dt>الشحن</dt><dd>{totals.shipping === 0 ? "مجاني" : formatEGP(totals.shipping)}</dd></div>
          <div class="mt-3 flex justify-between border-t border-stone-200 pt-3 text-base font-extrabold"><dt>الإجمالي</dt><dd>{formatEGP(totals.total)}</dd></div>
        </dl>
        <a href="/checkout" class="mt-5 block rounded-full bg-honey-600 py-3 text-center font-bold text-white transition hover:bg-honey-700">إتمام الشراء</a>
        <a href="/products" class="mt-2 block text-center text-sm text-stone-500 hover:text-honey-700">مواصلة التسوق</a>
        <button type="button" class="mt-2 block w-full text-center text-xs text-stone-400 hover:text-red-600" onclick={clearCart}>تفريغ السلة</button>
      </aside>
    </div>
  {/if}
</div>