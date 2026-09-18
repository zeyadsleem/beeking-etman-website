<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import { trackPurchase } from "$lib/analytics-events";
  import Button from "$lib/components/Button.svelte";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const lang = $derived(data.lang);

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
    <div class="relative">
      <div class="mx-auto grid h-20 w-20 place-items-center rounded-full border border-honey-200 bg-honey-50">
        <div class="grid h-12 w-12 place-items-center rounded-full bg-honey-600 text-2xl text-white">✓</div>
      </div>
      <h1 class="headline mt-5 text-4xl leading-tight text-cocoa-900">{t(lang, "success.heading")}</h1>
      <p class="mt-3 text-lg text-cocoa-600">
        {t(lang, "success.orderNumber")} <span class="badge-ok px-4 py-1 font-extrabold" data-testid="order-number">{data.order.number}</span>
      </p>
      <p class="mt-2 text-sm text-cocoa-400">{t(lang, "success.paymentPending")}</p>
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

  {#if data.claim.isTransfer}
    <section class="mt-4 rounded-2xl border border-honey-200 bg-honey-50/60 p-6 text-start text-sm text-cocoa-700 shadow-warm-sm">
      <h2 class="headline text-xl text-cocoa-900">{t(lang, "success.claim.transferTitle")}</h2>
      {#if data.claim.account && data.claim.claimable}
        <p class="mt-2">
          <span class="font-bold">{t(lang, "success.claim.account")}</span>
          <span class="font-extrabold" dir="ltr">{data.claim.account}</span>
        </p>
        <p>
          <span class="font-bold">{t(lang, "success.claim.amount")}</span>
          <span class="font-extrabold">{formatEGP(data.order.total, lang)}</span>
        </p>
      {/if}

      {#if data.claim.paid}
        <p class="mt-3 font-semibold text-olive-800">{t(lang, "success.claim.paid")}</p>
      {:else if data.claim.refunded}
        <p class="mt-3 font-semibold text-cocoa-700">{t(lang, "success.claim.refunded")}</p>
      {:else if data.claim.claimed}
        <p class="mt-3 font-semibold text-honey-800">{t(lang, "success.claim.alreadyClaimed")}</p>
        {#if data.claim.reference}<p class="mt-1 text-xs text-cocoa-500">{data.claim.reference}</p>{/if}
      {:else if data.claim.claimable && data.claim.account}
        <form method="POST" action="?/claim" class="mt-3 space-y-3">
          <label class="field-label block">
            {t(lang, "success.claim.reference")}
            <input name="reference" class="field mt-1" maxlength="120" autocomplete="off" />
          </label>
          <Button type="submit" variant="primary">{t(lang, "success.claim.submit")}</Button>
        </form>
      {:else if data.claim.claimable}
        <p class="mt-3 font-semibold text-clay-800">{t(lang, "success.claim.noAccount")}</p>
      {:else}
        <p class="mt-3 text-sm text-cocoa-500">{t(lang, "success.paymentPending")}</p>
      {/if}

      {#if form?.claimSubmitted && !data.claim.claimed}
        <p class="mt-3 font-semibold text-olive-800" role="status">{t(lang, "success.claim.submitted")}</p>
      {/if}
      {#if form?.claimError}
        <p class="mt-3 font-semibold text-clay-800" role="alert">{form.claimError}</p>
      {/if}
    </section>
  {/if}

  <div class="mt-8 text-center">
    <Button variant="primary" href="/products">{t(lang, "success.continue")}</Button>
  </div>
</div>