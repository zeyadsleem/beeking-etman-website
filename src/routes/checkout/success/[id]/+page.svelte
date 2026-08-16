<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import Button from "$lib/components/Button.svelte";
  import { getLocale, t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);
  const localized = $derived(new Intl.DateTimeFormat(getLocale(lang), { dateStyle: "long", timeStyle: "short" }));
</script>

<svelte:head><title>{t(lang, "success.title")}</title></svelte:head>

<div class="mx-auto max-w-2xl pt-10 text-center motion-safe:animate-fade-up">
  <div class="mx-auto grid h-20 w-20 place-items-center rounded-full border border-honey-200 bg-honey-50">
    <div class="grid h-12 w-12 place-items-center rounded-full bg-honey-600 text-2xl text-white">✓</div>
  </div>
  <h1 class="headline mt-5 text-4xl leading-tight text-cocoa-900">{t(lang, "success.heading")}</h1>
  <p class="mt-3 text-lg text-cocoa-600">
    {t(lang, "success.orderNumber")} <span class="badge-ok px-4 py-1 font-extrabold" data-testid="order-number">{data.order.number}</span>
  </p>
  <p class="mt-2 text-sm text-cocoa-400">{t(lang, "success.simulated")}</p>

  <section class="mt-8 rounded-2xl border border-cocoa-100 bg-parchment p-6 text-start shadow-warm-sm">
    <h2 class="headline text-xl text-cocoa-900">{t(lang, "success.products")}</h2>
    <ul class="mt-3 space-y-2 text-sm text-cocoa-700">
      {#each data.items as item (item.id)}
        <li class="flex justify-between gap-2">
          <span>{item.productName}{item.variantName ? ` (${item.variantName})` : ""} × {item.quantity}</span>
          <span class="font-semibold">{formatEGP(item.unitPrice * item.quantity)}</span>
        </li>
      {/each}
    </ul>
    <dl class="mt-4 flex justify-between border-t border-cocoa-100 pt-3 text-base font-extrabold text-cocoa-900">
      <dt>{t(lang, "success.total")}</dt>
      <dd>{formatEGP(data.order.total)}</dd>
    </dl>
  </section>

  <section class="mt-4 rounded-2xl border border-cocoa-100 bg-parchment p-6 text-start text-sm text-cocoa-600 shadow-warm-sm">
    <p><span class="font-bold text-cocoa-900">{t(lang, "success.deliverTo")}</span> {data.order.address}، {data.order.city}</p>
    <p><span class="font-bold text-cocoa-900">{t(lang, "success.customer")}</span> {data.order.name} — {data.order.phone}</p>
    <p><span class="font-bold text-cocoa-900">{t(lang, "success.date")}</span> {localized.format(data.order.createdAt)}</p>
  </section>

  <Button variant="primary" href="/products" class="mt-8">{t(lang, "success.continue")}</Button>
</div>