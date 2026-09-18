<script lang="ts">
  import { scrollable } from "$lib/actions/scrollable";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import EmptyState from "$lib/components/admin/EmptyState.svelte";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);
</script>

<svelte:head>
  <title>{t(lang, "admin.warehouses.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.warehouses.title")}</SectionTitle>
  <p class="mt-2 text-cocoa-600">{t(lang, "admin.warehouses.description")}</p>

  {#if data.warehouses.length === 0}
    <div class="empty-state">
      <p class="text-lg">{t(lang, "admin.warehouses.empty")}</p>
    </div>
  {:else}
    <div role="region" use:scrollable aria-label={t(lang, "admin.warehouses.title")} class="mt-8 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
      <table class="w-full min-w-max text-sm" data-testid="admin-warehouses-table">
        <thead class="uppercase text-xs text-cocoa-500">
          <tr>
            <th class="px-4 py-3 text-start">{t(lang, "admin.warehouses.columns.name")}</th>
            <th class="px-4 py-3 text-start">{t(lang, "admin.warehouses.columns.type")}</th>
            <th class="px-4 py-3 text-start">{t(lang, "admin.warehouses.columns.isDefault")}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-cocoa-100">
          {#each data.warehouses as w (w.id)}
            <tr class="hover:bg-white" data-testid="admin-warehouse-row">
              <td class="px-4 py-3 font-medium text-cocoa-800">{w.name}</td>
              <td class="px-4 py-3 text-cocoa-600">
                {t(lang, w.type === "bulk" ? "admin.warehouses.type.bulk" : "admin.warehouses.type.fulfillment")}
              </td>
              <td class="px-4 py-3 text-cocoa-600">{w.isDefault ? "✓" : "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
