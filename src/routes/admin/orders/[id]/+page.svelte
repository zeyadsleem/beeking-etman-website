<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import AdminOrderStatusBadge from "$lib/components/AdminOrderStatusBadge.svelte";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  // Mirrors the .btn-primary shape but with the clay danger tone — cancelling
  // is the one destructive transition in the lifecycle.
  const CANCEL_BUTTON_CLASS =
    "inline-flex items-center justify-center gap-2 rounded-full bg-clay-600 px-6 py-3 text-sm font-semibold text-white shadow-warm-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-clay-700 disabled:cursor-not-allowed disabled:opacity-40";
</script>

<svelte:head>
  <title>{t(lang, "admin.order.details")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-4xl px-4 py-10">
  <div>
    <Button variant="ghost" href="/admin/orders" class="text-sm">
      {t(lang, "admin.order.backToList")}
    </Button>
  </div>

  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.order.details")}</SectionTitle>

  {#if form?.success}
    <p class="mt-4 text-sm font-semibold text-honey-700">{form.success}</p>
  {/if}
  {#if form?.message}
    <p role="alert" class="mt-2 text-sm font-semibold text-red-700">{form.message}</p>
  {/if}

  <div
    class="mt-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm"
    data-testid="admin-order-detail"
  >
    <div>
      <p class="card-title text-lg text-honey-700">{data.order.number}</p>
      <p class="mt-0.5 text-sm text-cocoa-500">{formatDate(lang, data.order.createdAt)}</p>
    </div>
    <AdminOrderStatusBadge status={data.order.status} {lang} />
    <div class="text-end">
      <span class="block text-xs font-semibold text-cocoa-400">{t(lang, "admin.orders.total")}</span>
      <span class="font-extrabold text-cocoa-900">{formatEGP(data.order.total, lang)}</span>
    </div>
  </div>

  {#if data.transitions.length > 0}
    <div class="mt-4 flex flex-wrap items-center gap-3">
      {#each data.transitions as next (next)}
        <form method="POST" action="?/update">
          <input type="hidden" name="id" value={data.order.id} />
          <input type="hidden" name="status" value={next} />
          {#if next === "cancelled"}
            <button type="submit" class={CANCEL_BUTTON_CLASS}>
              {t(lang, "admin.order.cancel")}
            </button>
          {:else if next === "shipped"}
            <Button type="submit" variant="primary">{t(lang, "admin.order.markShipped")}</Button>
          {:else}
            <Button type="submit" variant="primary">{t(lang, "admin.order.markDelivered")}</Button>
          {/if}
        </form>
      {/each}
    </div>
  {/if}

  <section
    class="mt-6 space-y-2 rounded-2xl border border-cocoa-100 bg-parchment p-6 text-sm text-cocoa-600 shadow-warm-sm"
  >
    <p><span class="font-bold text-cocoa-900">{t(lang, "addresses.name")}: </span>{data.order.name}</p>
    <p>
      <span class="font-bold text-cocoa-900">{t(lang, "account.email")}: </span>{data.order.email}
    </p>
    <p>
      <span class="font-bold text-cocoa-900">{t(lang, "addresses.phone")}: </span>{data.order.phone}
    </p>
    <p>
      <span class="font-bold text-cocoa-900">{t(lang, "addresses.address")}: </span
      >{data.order.address}، {data.order.city}
    </p>
  </section>

  <section class="mt-6 overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-cocoa-100 text-xs font-semibold text-cocoa-500">
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "success.products")}</th>
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "admin.order.quantity")}</th>
          <th scope="col" class="px-6 py-3 text-start">{t(lang, "admin.order.unitPrice")}</th>
          <th scope="col" class="px-6 py-3 text-end">{t(lang, "admin.orders.total")}</th>
        </tr>
      </thead>
      <tbody>
        {#each data.items as item (item.id)}
          <tr class="border-b border-cocoa-50 last:border-b-0">
            <td class="px-6 py-3">
              <p class="font-medium text-cocoa-800">{item.productName}</p>
              {#if item.variantName}
                <p class="text-xs text-cocoa-500">{item.variantName}</p>
              {/if}
            </td>
            <td class="px-6 py-3 text-cocoa-600">{item.quantity}</td>
            <td class="px-6 py-3 text-cocoa-600">{formatEGP(item.unitPrice, lang)}</td>
            <td class="px-6 py-3 text-end font-semibold text-cocoa-900">
              {formatEGP(item.unitPrice * item.quantity, lang)}
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr class="border-t border-cocoa-200">
          <td colspan="3" class="px-6 py-4 text-end font-extrabold text-cocoa-900">
            {t(lang, "admin.orders.total")}
          </td>
          <td class="px-6 py-4 text-end font-extrabold text-cocoa-900">
            {formatEGP(data.order.total, lang)}
          </td>
        </tr>
      </tfoot>
    </table>
  </section>
</section>
