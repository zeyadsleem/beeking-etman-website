<script lang="ts">
  import {
    ADMIN_ORDER_STATUS_BADGE_CLASS,
    ADMIN_ORDER_STATUS_LABEL_KEY,
  } from "$lib/admin-order-status";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { formatEGP } from "$lib/currency";
  import { formatDate, t, type MessageKey } from "$lib/i18n/messages";
  import type { OrderStatus } from "$lib/server/admin/orders";
  import type { PageData } from "./$types";

  // The route's merged PageData also carries layout fields (user, categories);
  // this dashboard consumes only stats + lang, so the prop contract stays
  // narrowed to what is actually rendered.
  let { data }: { data: Pick<PageData, "stats" | "lang"> } = $props();
  const lang = $derived(data.lang);
  const stats = $derived(data.stats);

  // Same client-side copy of the lifecycle vocabulary as the orders list
  // page: importing the server module's runtime value would bundle drizzle
  // into client code, so only the type crosses the boundary.
  const STATUS_ORDER: readonly OrderStatus[] = ["paid", "shipped", "delivered", "cancelled"];

  const SECTIONS: readonly { href: string; labelKey: MessageKey }[] = [
    { href: "/admin/orders", labelKey: "admin.orders.title" },
    { href: "/admin/products", labelKey: "admin.products.title" },
    { href: "/admin/categories", labelKey: "admin.categories.title" },
  ];

  // dailySeries days are UTC calendar keys ("YYYY-MM-DD"); anchor them to
  // midnight UTC so the label never shifts a day in positive-offset locales.
  function seriesDay(day: string): Date {
    return new Date(`${day}T00:00:00Z`);
  }
</script>

<svelte:head>
  <title>{t(lang, "admin.stats.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <SectionTitle as="h1" className="text-4xl">
    <span data-testid="admin-stats-title">{t(lang, "admin.stats.title")}</span>
  </SectionTitle>

  <nav class="mt-6 flex flex-wrap gap-2" aria-label={t(lang, "admin.stats.navAria")}>
    {#each SECTIONS as section (section.href)}
      <a href={section.href} class="chip">{t(lang, section.labelKey)}</a>
    {/each}
  </nav>

  <div class="mt-8 grid gap-4 sm:grid-cols-3">
    <div class="rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
      <p class="text-xs font-semibold text-cocoa-400">{t(lang, "admin.stats.revenue")}</p>
      <p class="mt-1 text-2xl font-extrabold text-cocoa-900" data-testid="stat-revenue">
        {formatEGP(stats.kpis.revenue, lang)}
      </p>
    </div>
    <div class="rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
      <p class="text-xs font-semibold text-cocoa-400">{t(lang, "admin.stats.orders")}</p>
      <p class="mt-1 text-2xl font-extrabold text-cocoa-900" data-testid="stat-orders">
        {stats.kpis.orders}
      </p>
    </div>
    <div class="rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
      <p class="text-xs font-semibold text-cocoa-400">{t(lang, "admin.stats.customers")}</p>
      <p class="mt-1 text-2xl font-extrabold text-cocoa-900" data-testid="stat-customers">
        {stats.kpis.customers}
      </p>
    </div>
  </div>

  <section class="mt-10" data-testid="status-breakdown">
    <h2 class="text-xl font-bold text-cocoa-800">{t(lang, "admin.stats.byStatus")}</h2>
    <div class="mt-3 flex flex-wrap gap-2">
      {#each STATUS_ORDER as status (status)}
        <span
          data-testid={`status-chip-${status}`}
          class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold {ADMIN_ORDER_STATUS_BADGE_CLASS[
            status
          ]}"
        >
          {t(lang, ADMIN_ORDER_STATUS_LABEL_KEY[status])}
          <span class="font-extrabold">{stats.kpis.byStatus[status]}</span>
        </span>
      {/each}
    </div>
  </section>

  <section class="mt-10">
    <h2 class="text-xl font-bold text-cocoa-800" data-testid="series-heading">
      {t(lang, "admin.stats.last30Days")}
    </h2>
    <div
      class="mt-3 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm"
    >
      <table class="w-full text-sm" data-testid="series-table">
        <thead>
          <tr class="text-xs font-semibold uppercase text-cocoa-400">
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.stats.day")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.stats.orders")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.stats.revenue")}</th>
          </tr>
        </thead>
        <tbody>
          {#each stats.dailySeries as entry (entry.day)}
            <tr class="border-t border-cocoa-100">
              <td class="px-4 py-2 text-cocoa-700">{formatDate(lang, seriesDay(entry.day))}</td>
              <td class="px-4 py-2 text-cocoa-700">{entry.orders}</td>
              <td class="px-4 py-2 text-cocoa-700">{formatEGP(entry.revenue, lang)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-10">
    <h2 class="text-xl font-bold text-cocoa-800">{t(lang, "admin.stats.topProducts")}</h2>
    <div
      class="mt-3 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm"
    >
      <table class="w-full text-sm" data-testid="top-products-table">
        <thead>
          <tr class="text-xs font-semibold uppercase text-cocoa-400">
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.products.name")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.stats.quantity")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.stats.revenue")}</th>
          </tr>
        </thead>
        <tbody>
          {#each stats.topProducts as row (row.name)}
            <tr class="border-t border-cocoa-100">
              <td class="px-4 py-2 font-medium text-cocoa-800">{row.name}</td>
              <td class="px-4 py-2 text-cocoa-700">{row.quantity}</td>
              <td class="px-4 py-2 text-cocoa-700">{formatEGP(row.revenue, lang)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-10 mb-8">
    <h2 class="text-xl font-bold text-cocoa-800">{t(lang, "admin.stats.lowStock")}</h2>
    {#if stats.lowStock.length === 0}
      <p class="mt-3 text-sm text-cocoa-600">{t(lang, "admin.stats.noLowStock")}</p>
    {:else}
      <ul class="mt-3 space-y-2">
        {#each stats.lowStock as row (row.productId + ":" + row.variantName)}
          <li>
            <a
              href={`/admin/products/${row.productId}`}
              data-testid="low-stock-link"
              class="flex items-center justify-between gap-4 rounded-xl border border-cocoa-100 bg-parchment px-4 py-3 transition hover:border-cocoa-200"
            >
              <span class="font-medium text-cocoa-800">{row.productName} · {row.variantName}</span>
              <span class="text-sm text-cocoa-600">{t(lang, "admin.stats.quantity")}: {row.stock}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</section>
