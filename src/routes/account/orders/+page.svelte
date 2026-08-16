<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { getLocale, t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);
  const localized = $derived(new Intl.DateTimeFormat(getLocale(lang), { dateStyle: "long" }));
</script>

<svelte:head><title>{t(lang, "orders.title")} — مملكة النحل</title></svelte:head>

<div class="mt-6">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "orders.title")}</SectionTitle>
  {#if data.orders.length === 0}
    <div class="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-cocoa-200 bg-parchment p-14 text-center">
      <p class="text-lg font-semibold text-cocoa-600">{t(lang, "orders.empty")}</p>
      <Button variant="primary" href="/products" class="mt-5">{t(lang, "orders.browse")}</Button>
    </div>
  {:else}
    <ul class="mt-6 space-y-4">
      {#each data.orders as order (order.id)}
        <li class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm transition hover:border-cocoa-200">
          <div>
            <a href={`/checkout/success/${order.id}`} class="headline text-lg text-honey-700 hover:underline" data-testid="order-link">{order.number}</a>
            <p class="mt-0.5 text-sm text-cocoa-500">{localized.format(order.createdAt)}</p>
          </div>
          <div class="text-start">
            <span class="text-sm text-cocoa-500">{t(lang, "orders.status")}</span>
            <span class="ms-2 badge-ok">{#if order.status === "paid"}{t(lang, "orders.paid")}{:else}{t(lang, "orders.unknown")}{/if}</span>
          </div>
          <span class="font-extrabold text-cocoa-900">{formatEGP(order.total)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>