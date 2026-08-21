<script lang="ts">
  import { goto } from "$app/navigation";
  import { formatEGP } from "$lib/currency";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  function goToPage(page: number): void {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    void goto(`/account/orders${params.size ? `?${params}` : ""}`);
  }
</script>

<svelte:head><title>{t(lang, "orders.title")} — مملكة النحل</title></svelte:head>

<div class="mt-8">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "orders.title")}</SectionTitle>
  {#if data.orders.length === 0}
    <div class="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-cocoa-200 bg-parchment p-14 text-center">
      <p class="text-lg font-semibold text-cocoa-600">{t(lang, "orders.empty")}</p>
      <Button variant="primary" href="/products" class="mt-5">{t(lang, "orders.browse")}</Button>
    </div>
  {:else}
    <ul class="mt-8 space-y-4">
      {#each data.orders as order (order.id)}
        <li class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm transition hover:border-cocoa-200">
          <div>
            <a href={`/checkout/success/${order.id}`} class="headline text-lg text-honey-700 hover:underline" data-testid="order-link">{order.number}</a>
            <p class="mt-0.5 text-sm text-cocoa-500">{formatDate(lang, order.createdAt)}</p>
          </div>
          <div class="text-start">
            <span class="text-sm text-cocoa-500">{t(lang, "orders.status")}</span>
            <span class="ms-2 badge-ok">{#if order.status === "paid"}{t(lang, "orders.paid")}{:else}{t(lang, "orders.unknown")}{/if}</span>
          </div>
          <span class="font-extrabold text-cocoa-900">{formatEGP(order.total, lang)}</span>
        </li>
      {/each}
    </ul>

    {#if data.totalPages > 1}
      <nav class="mt-10 flex items-center justify-center gap-4" aria-label={t(lang, "products.paginationAria")}>
        <Button
          variant="outline"
          type="button"
          class="text-sm"
          disabled={data.page <= 1}
          onclick={() => goToPage(data.page - 1)}
        >
          {t(lang, "products.prev")}
        </Button>
        <span class="text-sm text-cocoa-600" aria-label={t(lang, "products.pageAria", { page: data.page })}>
          {t(lang, "products.page")} {data.page} {t(lang, "products.of")} {data.totalPages}
        </span>
        <Button
          variant="outline"
          type="button"
          class="text-sm"
          disabled={data.page >= data.totalPages}
          onclick={() => goToPage(data.page + 1)}
        >
          {t(lang, "products.next")}
        </Button>
      </nav>
    {/if}
  {/if}
</div>
