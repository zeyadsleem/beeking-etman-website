<script lang="ts">
  import {
    ADMIN_ORDER_STATUS_BADGE_CLASS,
    ADMIN_ORDER_STATUS_LABEL_KEY,
    STATUS_ORDER,
  } from "$lib/admin-order-status";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import CircleDollarSign from "@lucide/svelte/icons/circle-dollar-sign";
  import PackageSearch from "@lucide/svelte/icons/package-search";
  import ShoppingCart from "@lucide/svelte/icons/shopping-cart";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import TrendingUp from "@lucide/svelte/icons/trending-up";
  import Users from "@lucide/svelte/icons/users";
  import PageHeader from "$lib/components/admin/PageHeader.svelte";
  import StatCard from "$lib/components/admin/StatCard.svelte";
  import EmptyState from "$lib/components/admin/EmptyState.svelte";
  import { formatEGP } from "$lib/currency";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  // The route's merged PageData also carries layout fields (user, categories);
  // this dashboard consumes only stats + lang, so the prop contract stays
  // narrowed to what is actually rendered.
  let { data }: { data: Pick<PageData, "stats" | "lang"> } = $props();
  const lang = $derived(data.lang);
  const stats = $derived(data.stats);

  // dailySeries days are Cairo calendar keys ("YYYY-MM-DD"); format them
  // using the browser locale so the display is always correct.
  function seriesDay(day: string): Date {
    // Cairo midnight in ISO — safe for date formatting without timezone drift.
    return new Date(`${day}T00:00:00+02:00`);
  }

  // Revenue change across the trailing 7 days versus the 7 before them; a
  // sparse or flat series returns null so the KPI hint can be hidden.
  const revenueTrend = $derived.by(() => {
    const entries = stats.dailySeries;
    if (entries.length < 2) return null;
    const recent = entries.slice(-7);
    const prior = entries.slice(-14, -7);
    const recentSum = recent.reduce((acc, e) => acc + e.revenue, 0);
    const priorSum = prior.reduce((acc, e) => acc + e.revenue, 0);
    if (priorSum === 0) {
      if (recentSum === 0) return null;
      return { pct: 100, up: true };
    }
    const pct = ((recentSum - priorSum) / priorSum) * 100;
    return { pct, up: pct >= 0 };
  });

  const trendLabel = $derived(
    revenueTrend
      ? `${t(lang, revenueTrend.up ? "admin.stats.trendUp" : "admin.stats.trendDown")} · ${Math.abs(revenueTrend.pct).toFixed(0)}%`
      : undefined,
  );

  const lowStockCount = $derived(stats.lowStock.length);
</script>

<svelte:head>
  <title>{t(lang, "admin.stats.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<PageHeader
  title={t(lang, "admin.stats.title")}
  description={t(lang, "admin.stats.description")}
  titleTestId="admin-stats-title"
/>

<div class="mt-8 grid gap-4 sm:grid-cols-3">
  <StatCard
    label={t(lang, "admin.stats.revenue")}
    value={formatEGP(stats.kpis.revenue, lang)}
    hint={trendLabel}
    icon={CircleDollarSign}
    tone="honey"
    valueTestId="stat-revenue"
  />
  <StatCard
    label={t(lang, "admin.stats.orders")}
    value={String(stats.kpis.orders)}
    icon={ShoppingCart}
    tone="clay"
    valueTestId="stat-orders"
  />
  <StatCard
    label={t(lang, "admin.stats.customers")}
    value={String(stats.kpis.customers)}
    icon={Users}
    tone="olive"
    valueTestId="stat-customers"
  />
</div>

<section
  data-testid="status-breakdown"
  class="mt-8 rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm"
>
  <div class="flex items-center justify-between gap-3">
    <h2 class="text-sm font-bold text-cocoa-700">{t(lang, "admin.stats.byStatus")}</h2>
    <TrendingUp class="hidden h-4 w-4 text-cocoa-300" aria-hidden="true" />
  </div>
  <div class="mt-4 flex flex-wrap gap-2">
    {#each STATUS_ORDER as status (status)}
      <span
        data-testid={`status-chip-${status}`}
        class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold {ADMIN_ORDER_STATUS_BADGE_CLASS[status]}"
      >
        {t(lang, ADMIN_ORDER_STATUS_LABEL_KEY[status])}
        <span class="font-extrabold">{stats.kpis.byStatus[status]}</span>
      </span>
    {/each}
  </div>
</section>

<div class="mt-8 grid gap-6 lg:grid-cols-2">
  <section class="rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
    <div class="flex items-center justify-between border-b border-cocoa-100 px-5 py-4">
      <h2 class="text-sm font-bold text-cocoa-700" data-testid="series-heading">
        {t(lang, "admin.stats.last30Days")}
      </h2>
    </div>
    {#if stats.dailySeries.length === 0}
      <div class="p-5">
        <EmptyState
          title={t(lang, "admin.stats.noData")}
          description={t(lang, "admin.stats.noDataHint")}
          icon={PackageSearch}
        />
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="series-table">
          <thead>
            <tr class="text-xs font-semibold uppercase text-cocoa-400">
              <th scope="col" class="px-5 py-3 text-start">{t(lang, "admin.stats.day")}</th>
              <th scope="col" class="px-5 py-3 text-start">{t(lang, "admin.stats.orders")}</th>
              <th scope="col" class="px-5 py-3 text-start">{t(lang, "admin.stats.revenue")}</th>
            </tr>
          </thead>
          <tbody>
            {#each stats.dailySeries as entry (entry.day)}
              <tr class="border-t border-cocoa-100 transition-colors hover:bg-cocoa-50/40">
                <td class="px-5 py-2.5 text-cocoa-700">{formatDate(lang, seriesDay(entry.day))}</td>
                <td class="px-5 py-2.5 text-cocoa-700">{entry.orders}</td>
                <td class="px-5 py-2.5 font-medium text-cocoa-800">
                  {formatEGP(entry.revenue, lang)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section class="rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
    <div class="border-b border-cocoa-100 px-5 py-4">
      <h2 class="text-sm font-bold text-cocoa-700">{t(lang, "admin.stats.topProducts")}</h2>
    </div>
    {#if stats.topProducts.length === 0}
      <div class="p-5">
        <EmptyState
          title={t(lang, "admin.stats.noData")}
          description={t(lang, "admin.stats.noDataHint")}
          icon={PackageSearch}
        />
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="top-products-table">
          <thead>
            <tr class="text-xs font-semibold uppercase text-cocoa-400">
              <th scope="col" class="px-5 py-3 text-start">{t(lang, "admin.products.name")}</th>
              <th scope="col" class="px-5 py-3 text-start">{t(lang, "admin.stats.quantity")}</th>
              <th scope="col" class="px-5 py-3 text-start">{t(lang, "admin.stats.revenue")}</th>
            </tr>
          </thead>
          <tbody>
            {#each stats.topProducts as row (row.name)}
              <tr class="border-t border-cocoa-100 transition-colors hover:bg-cocoa-50/40">
                <td class="px-5 py-2.5 font-medium text-cocoa-800">{row.name}</td>
                <td class="px-5 py-2.5 text-cocoa-700">{row.quantity}</td>
                <td class="px-5 py-2.5 font-medium text-cocoa-800">
                  {formatEGP(row.revenue, lang)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>

<section class="mt-8 mb-8 rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
  <div class="flex items-center justify-between border-b border-cocoa-100 px-5 py-4">
    <h2 class="flex items-center gap-2 text-sm font-bold text-cocoa-700">
      <AlertTriangle
        class="h-4 w-4 text-clay-500 {lowStockCount > 0 ? '' : 'text-olive-500'}"
        aria-hidden="true"
      />
      {t(lang, "admin.stats.lowStock")}
      {#if lowStockCount > 0}
        <span class="rounded-full bg-clay-100 px-2 py-0.5 text-xs font-bold text-clay-700">
          {lowStockCount}
        </span>
      {/if}
    </h2>
  </div>
  {#if stats.lowStock.length === 0}
    <div class="px-5 py-8 text-center">
      <p class="text-sm font-medium text-olive-600" data-testid="low-stock-empty">
        {t(lang, "admin.stats.noLowStock")}
      </p>
    </div>
  {:else}
    <ul class="divide-y divide-cocoa-100">
      {#each stats.lowStock as row (row.productId + ":" + row.variantName)}
        <li>
          <a
            href={`/admin/products/${row.productId}`}
            data-testid="low-stock-link"
            class="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-clay-50/40"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-clay-50 text-clay-600">
                <AlertTriangle class="h-4 w-4" aria-hidden="true" />
              </span>
              <span class="truncate font-medium text-cocoa-800">
                {row.productName} · {row.variantName}
              </span>
            </span>
            <span class="flex items-center gap-2 text-sm">
              <span class="text-cocoa-500">{t(lang, "admin.stats.quantity")}:</span>
              <span class="rounded-full bg-clay-100 px-2 py-0.5 font-bold text-clay-700">
                {row.stock}
              </span>
              <ChevronLeft class="h-4 w-4 text-cocoa-300 rtl:rotate-180" aria-hidden="true" />
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
