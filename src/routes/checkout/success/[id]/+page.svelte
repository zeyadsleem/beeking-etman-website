<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import { trackPurchase } from "$lib/analytics-events";
  import Button from "$lib/components/Button.svelte";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);
  const seal = $derived(lang === "en" ? "/images/etman-wax-en.png" : "/images/etman-wax-ar.png");

  $effect(() => {
    const itemCount = data.items.reduce((sum, i) => sum + i.quantity, 0);
    trackPurchase(data.order.id, data.order.number, data.order.total, itemCount);
  });
</script>

<svelte:head>
  <title>{t(lang, "success.title")}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-2xl pt-10 motion-safe:animate-fade-up">
  <div class="relative overflow-hidden rounded-3xl border border-honey-100 bg-gradient-to-br from-paper via-cream to-cream-deep px-6 py-10 text-center">
    <div class="honeycomb pointer-events-none absolute inset-0"></div>
    <div class="relative">
      <div class="mx-auto grid h-20 w-20 place-items-center rounded-full border border-honey-200 bg-honey-50">
        <div class="grid h-12 w-12 place-items-center rounded-full bg-honey-600 text-2xl text-white">✓</div>
      </div>
      <h1 class="headline mt-5 text-4xl leading-tight text-cocoa-900">{t(lang, "success.heading")}</h1>
      <p class="mt-3 text-lg text-cocoa-600">
        {t(lang, "success.orderNumber")} <span class="badge-ok px-4 py-1 font-extrabold" data-testid="order-number">{data.order.number}</span>
      </p>
      <p class="mt-2 text-sm text-cocoa-400">{t(lang, "success.simulated")}</p>
      <img src={seal} alt="" aria-hidden="true" class="seal mx-auto mt-4 h-20 w-20" />
    </div>
  </div>

  <section class="mt-8 rounded-2xl border border-cocoa-100 bg-parchment p-6 text-start shadow-warm-sm">
    <h2 class="headline text-xl text-cocoa-900">{t(lang, "success.products")}</h2>
    <ul class="mt-3 space-y-2 text-sm text-cocoa-700">
      {#each data.items as item (item.id)}
        <li class="flex justify-between gap-2">
          <span>{item.productName}{item.variantName ? ` (${item.variantName})` : ""} × {item.quantity}</span>
          <span class="font-semibold">{formatEGP(item.unitPrice * item.quantity, lang)}</span>
        </li>
      {/each}
    </ul>
    <dl class="mt-4 flex justify-between border-t border-cocoa-100 pt-3 text-base font-extrabold text-cocoa-900">
      <dt>{t(lang, "success.total")}</dt>
      <dd>{formatEGP(data.order.total, lang)}</dd>
    </dl>
  </section>

  <section class="mt-4 rounded-2xl border border-cocoa-100 bg-parchment p-6 text-start text-sm text-cocoa-600 shadow-warm-sm">
    <p><span class="font-bold text-cocoa-900">{t(lang, "success.deliverTo")}</span> {data.order.address}، {data.order.city}</p>
    <p><span class="font-bold text-cocoa-900">{t(lang, "success.customer")}</span> {data.order.name} — {data.order.phone}</p>
    <p><span class="font-bold text-cocoa-900">{t(lang, "success.date")}</span> {formatDate(lang, data.order.createdAt, { dateStyle: "long", timeStyle: "short" })}</p>
  </section>

  <div class="mt-8 text-center">
    <Button variant="primary" href="/products">{t(lang, "success.continue")}</Button>
  </div>
</div>