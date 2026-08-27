<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t, formatDate } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  function pageHref(page: number): string {
    return `/admin/audit?page=${page}`;
  }

  const hasNextPage = $derived(data.page < data.totalPages);
  const hasPrevPage = $derived(data.page > 1);
</script>

<svelte:head>
  <title>{t(lang, "admin.audit.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <div>
    <Button variant="ghost" href="/admin" class="text-sm">
      {t(lang, "admin.audit.backToDashboard")}
    </Button>
  </div>

  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.audit.title")}</SectionTitle>

  <p class="mt-2 text-sm text-cocoa-500">
    {t(lang, "admin.audit.totalEntries")}: {data.total}
  </p>

  {#if data.items.length === 0}
    <div class="empty-state mt-8">
      <p class="text-lg font-semibold text-cocoa-600">{t(lang, "admin.audit.empty")}</p>
    </div>
  {:else}
    <div class="mt-6 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-cocoa-100 text-xs font-semibold uppercase text-cocoa-400">
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.audit.time")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.audit.admin")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.audit.action")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.audit.target")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.audit.details")}</th>
          </tr>
        </thead>
        <tbody>
          {#each data.items as log (log.id)}
            <tr class="border-b border-cocoa-50 last:border-b-0">
              <td class="px-4 py-3 text-cocoa-600 whitespace-nowrap">
                {formatDate(lang, log.createdAt)}
              </td>
              <td class="px-4 py-3 text-cocoa-600">
                {log.adminUserId ?? "—"}
              </td>
              <td class="px-4 py-3 font-medium text-cocoa-800">
                {log.action}
              </td>
              <td class="px-4 py-3 text-cocoa-600">
                <span class="inline-flex items-center gap-1">
                  <span class="text-xs font-semibold text-cocoa-400">{log.targetType}</span>
                  <span class="text-cocoa-500">{log.targetId.slice(0, 8)}…</span>
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-cocoa-500 max-w-[200px] truncate">
                {log.details ?? "—"}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if hasPrevPage || hasNextPage}
      <nav class="mt-10 flex items-center justify-center gap-4" aria-label={t(lang, "admin.audit.paginationAria")}>
        {#if hasPrevPage}
          <a href={pageHref(data.page - 1)} class="btn-outline text-sm">{t(lang, "admin.orders.prev")}</a>
        {/if}
        <span class="text-sm text-cocoa-500">
          {t(lang, "admin.audit.page")} {data.page} / {data.totalPages}
        </span>
        {#if hasNextPage}
          <a href={pageHref(data.page + 1)} class="btn-outline text-sm">{t(lang, "admin.orders.next")}</a>
        {/if}
      </nav>
    {/if}
  {/if}
</section>
