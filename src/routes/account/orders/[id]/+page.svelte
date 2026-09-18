<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { customerOrderStatusLabelKey } from "$lib/settlement/types";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);
</script>

<svelte:head><title>{data.order.number} — {t(lang, "brand.name")}</title></svelte:head>

<div class="mx-auto mt-8 w-full max-w-2xl px-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <SectionTitle as="h1" className="text-4xl">{data.order.number}</SectionTitle>
    <span class="badge-ok">
      {t(lang, customerOrderStatusLabelKey(data.order.status))}
    </span>
  </div>
  <p class="mt-1 text-sm text-cocoa-500">
    {t(lang, "orderDetail.placedOn")}:
    {formatDate(lang, data.order.createdAt, { dateStyle: "long", timeStyle: "short" })}
  </p>

  <section class="mt-6 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm">
    <h2 class="headline text-xl text-cocoa-900">{t(lang, "orderDetail.shippingTo")}</h2>
    <p class="mt-3 text-sm text-cocoa-600">
      <span class="font-bold text-cocoa-900">{t(lang, "account.name")}: </span>{data.order.name}
    </p>
    <p class="mt-1 text-sm text-cocoa-600">
      <span class="font-bold text-cocoa-900">{t(lang, "addresses.phone")}: </span>{data.order.phone}
    </p>
    <p class="mt-1 text-sm text-cocoa-600">
      <span class="font-bold text-cocoa-900">{t(lang, "addresses.city")}: </span>{data.order.city}
    </p>
    <p class="mt-1 text-sm text-cocoa-600">
      <span class="font-bold text-cocoa-900">{t(lang, "addresses.address")}: </span>{data.order.address}
    </p>
  </section>

  <section class="mt-4 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm">
    <h2 class="headline text-xl text-cocoa-900">{t(lang, "orderDetail.payment")}</h2>
    {#if data.payment.methodLabelKey}
      <p class="mt-3 text-sm text-cocoa-600">{t(lang, data.payment.methodLabelKey)}</p>
    {/if}
    {#if data.payment.account && data.payment.claimable}
      <p class="mt-1 text-sm text-cocoa-600">
        <span class="font-bold text-cocoa-900">{t(lang, "orderDetail.transferTo")}</span>
        <span class="font-extrabold" dir="ltr">{data.payment.account}</span>
      </p>
      <p class="mt-1 text-xs text-cocoa-500">{t(lang, "orderDetail.transferHint")}</p>
    {/if}
    {#if data.whatsappUrl}
      <Button variant="outline" href={data.whatsappUrl} class="mt-4" data-testid="whatsapp-cta">
        {t(lang, "orderDetail.whatsapp")}
      </Button>
    {/if}
  </section>

  <section class="mt-4 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm">
    <h2 class="headline text-xl text-cocoa-900">{t(lang, "orderDetail.items")}</h2>
    <table class="mt-4 w-full text-sm">
      <tbody class="divide-y divide-cocoa-100">
        {#each data.items as item (item.id)}
          <tr class="text-cocoa-700">
            <th scope="row" class="py-2.5 text-start font-normal">
              {item.productName}{item.variantName ? ` (${item.variantName})` : ""}
            </th>
            <td class="whitespace-nowrap py-2.5 text-end font-semibold">
              {item.quantity} × {formatEGP(item.unitPrice, lang)}
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr class="border-t border-cocoa-200 text-base font-extrabold text-cocoa-900">
          <th scope="row" class="pt-3 text-start">{t(lang, "orderDetail.total")}</th>
          <td class="pt-3 text-end">{formatEGP(data.order.total, lang)}</td>
        </tr>
      </tfoot>
    </table>
  </section>

  <Button variant="outline" href="/account/orders" class="mb-16 mt-6">
    {t(lang, "orderDetail.backToOrders")}
  </Button>
</div>
