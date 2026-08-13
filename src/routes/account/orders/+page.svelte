<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const localized = new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" });
</script>

<svelte:head><title>طلباتي — بيت العسل</title></svelte:head>

<div class="mt-6">
  <h1 class="text-3xl font-extrabold">طلباتي</h1>
  {#if data.orders.length === 0}
    <div class="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center text-stone-500">
      <p>لم تقم بأي طلبات بعد.</p>
      <a href="/products" class="mt-4 inline-block rounded-full bg-honey-600 px-6 py-3 font-semibold text-white hover:bg-honey-700">تصفح المتجر</a>
    </div>
  {:else}
    <ul class="mt-6 space-y-4">
      {#each data.orders as order (order.id)}
        <li class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-5">
          <div>
            <a href={`/checkout/success/${order.id}`} class="font-bold text-honey-800 hover:underline" data-testid="order-link">{order.number}</a>
            <p class="text-sm text-stone-500">{localized.format(order.createdAt)}</p>
          </div>
          <div class="text-start">
            <span class="text-sm text-stone-500">الحالة</span>
            <span class="ms-2 rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">مؤكد</span>
          </div>
          <span class="font-extrabold">{formatEGP(order.total)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>