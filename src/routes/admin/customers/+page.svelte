<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { formatDate, t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  const hasNextPage = $derived(data.page * data.pageSize < data.total);

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (data.q) params.set("q", data.q);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/admin/customers${query ? `?${query}` : ""}`;
  }
</script>

<svelte:head>
  <title>{t(lang, "admin.customers.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.customers.title")}</SectionTitle>
  <p class="mt-2 text-sm text-cocoa-500">{t(lang, "admin.customers.description")}</p>

  <form
    method="GET"
    action="/admin/customers"
    role="search"
    class="mt-6 flex max-w-md items-center gap-2"
  >
    <input
      type="search"
      name="q"
      value={data.q}
      placeholder={t(lang, "admin.customers.searchPlaceholder")}
      aria-label={t(lang, "admin.customers.searchPlaceholder")}
      class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
    />
    <Button type="submit" variant="outline">{t(lang, "products.searchSubmit")}</Button>
  </form>

  <p class="mt-4 text-sm text-cocoa-500" role="status">
    {t(lang, "admin.searchResultCount", { count: String(data.total) })}
  </p>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p class="text-lg font-semibold text-cocoa-600">{t(lang, "admin.customers.empty")}</p>
    </div>
  {:else}
    <div class="mt-8 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
      <table class="w-full min-w-max text-sm" data-testid="admin-customers-table">
        <thead>
          <tr class="border-b border-cocoa-100 text-left text-xs uppercase tracking-wide text-cocoa-500">
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.customers.columns.name")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.customers.columns.email")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.customers.columns.phone")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.customers.columns.city")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.customers.columns.orders")}</th>
            <th class="px-4 py-3 text-end font-semibold">{t(lang, "admin.customers.columns.totalSpend")}</th>
            <th class="px-4 py-3 font-semibold">{t(lang, "admin.customers.columns.lastOrderAt")}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-cocoa-100">
          {#each data.items as customer (customer.email)}
            <tr class="hover:bg-white" data-testid="admin-customer-row">
              <td class="px-4 py-3 font-medium text-cocoa-800">{customer.name}</td>
              <td class="px-4 py-3 text-cocoa-600">{customer.email}</td>
              <td class="px-4 py-3 text-cocoa-600">{customer.phone}</td>
              <td class="px-4 py-3 text-cocoa-600">{customer.city}</td>
              <td class="px-4 py-3 text-cocoa-800">{customer.orderCount}</td>
              <td class="px-4 py-3 text-end font-extrabold text-cocoa-900">
                {formatEGP(customer.totalSpend, lang)}
              </td>
              <td class="px-4 py-3 text-cocoa-600">{formatDate(lang, customer.lastOrderAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

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