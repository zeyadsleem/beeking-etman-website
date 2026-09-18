<script lang="ts">
  import { scrollable } from "$lib/actions/scrollable";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import EmptyState from "$lib/components/admin/EmptyState.svelte";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  const KIND_LABELS: Record<string, "admin.alerts.type.lowVariant" | "admin.alerts.type.lowBatch" | "admin.alerts.type.expiringBatch" | "admin.alerts.type.lowMaterial"> = {
    low_variant: "admin.alerts.type.lowVariant",
    low_batch: "admin.alerts.type.lowBatch",
    expiring_batch: "admin.alerts.type.expiringBatch",
    low_material: "admin.alerts.type.lowMaterial",
  };
</script>

<svelte:head>
  <title>{t(lang, "admin.alerts.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.alerts.title")}</SectionTitle>
  <p class="mt-2 text-cocoa-600">{t(lang, "admin.alerts.description")}</p>

  <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
    <div class="rounded-2xl border border-cocoa-100 bg-parchment p-4 text-center shadow-warm-sm">
      <p class="text-2xl font-extrabold text-cocoa-900">{data.counts.lowVariant}</p>
      <p class="text-xs text-cocoa-500">{t(lang, "admin.alerts.type.lowVariant")}</p>
    </div>
    <div class="rounded-2xl border border-cocoa-100 bg-parchment p-4 text-center shadow-warm-sm">
      <p class="text-2xl font-extrabold text-cocoa-900">{data.counts.lowBatch}</p>
      <p class="text-xs text-cocoa-500">{t(lang, "admin.alerts.type.lowBatch")}</p>
    </div>
    <div class="rounded-2xl border border-cocoa-100 bg-parchment p-4 text-center shadow-warm-sm">
      <p class="text-2xl font-extrabold text-cocoa-900">{data.counts.expiringBatch}</p>
      <p class="text-xs text-cocoa-500">{t(lang, "admin.alerts.type.expiringBatch")}</p>
    </div>
    <div class="rounded-2xl border border-cocoa-100 bg-parchment p-4 text-center shadow-warm-sm">
      <p class="text-2xl font-extrabold text-cocoa-900">{data.counts.lowMaterial}</p>
      <p class="text-xs text-cocoa-500">{t(lang, "admin.alerts.type.lowMaterial")}</p>
    </div>
  </div>

  {#if data.alerts.length === 0}
    <div class="empty-state mt-8">
      <p class="text-lg">{t(lang, "admin.alerts.empty")}</p>
    </div>
  {:else}
    <div role="region" use:scrollable aria-label={t(lang, "admin.alerts.title")} class="mt-8 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
      <table class="w-full min-w-max text-sm" data-testid="admin-alerts-table">
        <thead class="uppercase text-xs text-cocoa-500">
          <tr>
            <th class="px-4 py-3 text-start">{t(lang, "admin.alerts.type")}</th>
            <th class="px-4 py-3 text-start">{t(lang, "admin.alerts.item")}</th>
            <th class="px-4 py-3 text-start">{t(lang, "admin.alerts.detail")}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-cocoa-100">
          {#each data.alerts as alert (alert.id + alert.kind)}
            <tr class="hover:bg-white" data-testid="admin-alert-row">
              <td class="px-4 py-3 text-cocoa-600">{t(lang, KIND_LABELS[alert.kind])}</td>
              <td class="px-4 py-3 font-medium text-cocoa-800">{alert.label}</td>
              <td class="px-4 py-3 text-cocoa-600">{alert.stockLabel} — {alert.detail}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
