<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const localized = new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" });
</script>

<svelte:head><title>طلباتي — مملكة النحل</title></svelte:head>

<div class="mt-6">
  <SectionTitle as="h1" className="text-4xl">طلباتي</SectionTitle>
  {#if data.orders.length === 0}
    <div class="dot-bg mt-8 flex flex-col items-center rounded-[1.8rem] border border-dashed border-cocoa-200 bg-parchment p-14 text-center">
      <svg width="56" height="62" viewBox="0 0 26 30" fill="none" aria-hidden="true">
        <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke="#ddc5a8" stroke-width="1.6" />
      </svg>
      <p class="mt-4 text-lg font-semibold text-cocoa-600">لم تقم بأي طلبات بعد.</p>
      <a href="/products" class="btn-honey mt-5">تصفح المتجر</a>
    </div>
  {:else}
    <ul class="mt-6 space-y-4">
      {#each data.orders as order (order.id)}
        <li class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm transition hover:shadow-warm">
          <div>
            <a href={`/checkout/success/${order.id}`} class="headline text-lg text-honey-800 hover:underline" data-testid="order-link">{order.number}</a>
            <p class="mt-0.5 text-sm text-cocoa-500">{localized.format(order.createdAt)}</p>
          </div>
          <div class="text-start">
            <span class="text-sm text-cocoa-500">الحالة</span>
            <span class="ms-2 rounded-full border border-honey-300 bg-honey-50 px-3 py-0.5 text-xs font-bold text-honey-800">{#if order.status === "paid"}مؤكد ✓{:else}غير محدد{/if}</span>
          </div>
          <span class="font-extrabold text-cocoa-900">{formatEGP(order.total)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>