<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { formatDate, t, type MessageKey } from "$lib/i18n/messages";
  import type { OrderStatus } from "$lib/server/admin/orders";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  const FILTER_STATUSES: readonly OrderStatus[] = ["paid", "shipped", "delivered", "cancelled"];

  const STATUS_LABEL_KEY: Record<OrderStatus, MessageKey> = {
    paid: "admin.orders.paid",
    shipped: "admin.orders.shipped",
    delivered: "admin.orders.delivered",
    cancelled: "admin.orders.cancelled",
  };

  // Badge tones reuse the project palette tokens only (the theme has no blue):
  // paid=honey, shipped=neutral cocoa, delivered=olive green, cancelled=muted
  // clay red. The label text carries the meaning; color is a secondary cue.
  const BADGE_BASE_CLASS = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold";
  const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
    paid: "bg-honey-50 text-honey-800",
    shipped: "border border-cocoa-200 bg-parchment text-cocoa-700",
    delivered: "bg-olive-100 text-olive-800",
    cancelled: "bg-clay-100 text-clay-800",
  };

  function filterHref(status: OrderStatus): string {
    return `/admin/orders?status=${status}`;
  }

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (data.status) params.set("status", data.status);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/admin/orders${query ? `?${query}` : ""}`;
  }

  const hasNextPage = $derived(data.page * data.pageSize < data.total);
</script>

<svelte:head>
  <title>{t(lang, "admin.orders.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.orders.title")}</SectionTitle>

  <nav class="mt-6 flex flex-wrap gap-2" aria-label={t(lang, "admin.orders.filterAria")}>
    <a
      href="/admin/orders"
      class="chip {data.status === null ? 'chip-active' : ''}"
      aria-current={data.status === null ? "true" : undefined}
    >
      {t(lang, "admin.orders.all")}
    </a>
    {#each FILTER_STATUSES as status (status)}
      <a
        href={filterHref(status)}
        class="chip {data.status === status ? 'chip-active' : ''}"
        aria-current={data.status === status ? "true" : undefined}
      >
        {t(lang, STATUS_LABEL_KEY[status])}
      </a>
    {/each}
  </nav>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p class="text-lg font-semibold text-cocoa-600">{t(lang, "admin.orders.empty")}</p>
    </div>
  {:else}
    <ul class="mt-8 space-y-4">
      {#each data.items as order (order.id)}
        <li
          class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm transition hover:border-cocoa-200"
          data-testid="admin-order-row"
        >
          <div>
            <p class="card-title text-lg text-honey-700">{order.number}</p>
            <p class="mt-0.5 text-sm text-cocoa-500">{formatDate(lang, order.createdAt)}</p>
          </div>
          <div class="text-sm">
            <span class="text-xs font-semibold text-cocoa-400">{t(lang, "admin.orders.customer")}</span>
            <p class="mt-1 font-medium text-cocoa-800">{order.name}</p>
            <p class="text-cocoa-600">{order.phone} · {order.city}</p>
          </div>
          <span class="{BADGE_BASE_CLASS} {STATUS_BADGE_CLASS[order.status]}">
            {t(lang, STATUS_LABEL_KEY[order.status])}
          </span>
          <div class="text-end">
            <span class="block text-xs font-semibold text-cocoa-400">{t(lang, "admin.orders.total")}</span>
            <span class="font-extrabold text-cocoa-900">{formatEGP(order.total, lang)}</span>
          </div>
        </li>
      {/each}
    </ul>

    {#if data.page > 1 || hasNextPage}
      <nav class="mt-10 flex items-center justify-center gap-4" aria-label={t(lang, "products.paginationAria")}>
        {#if data.page > 1}
          <a href={pageHref(data.page - 1)} class="btn-outline text-sm">{t(lang, "admin.orders.prev")}</a>
        {/if}
        {#if hasNextPage}
          <a href={pageHref(data.page + 1)} class="btn-outline text-sm">{t(lang, "admin.orders.next")}</a>
        {/if}
      </nav>
    {/if}
  {/if}
</section>
