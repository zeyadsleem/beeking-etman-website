<script lang="ts">
  import Warehouse from "@lucide/svelte/icons/warehouse";
  import Layers from "@lucide/svelte/icons/layers";
  import Package from "@lucide/svelte/icons/package";
  import Coins from "@lucide/svelte/icons/coins";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import CalendarClock from "@lucide/svelte/icons/calendar-clock";
  import Boxes from "@lucide/svelte/icons/boxes";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import StatCard from "$lib/components/admin/StatCard.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived<Lang>(data.lang);
</script>

<svelte:head>
  <title>{t(lang, "admin.reports.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl">
  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.reports.title")}</SectionTitle>
  <p class="mt-2 text-cocoa-500">{t(lang, "admin.reports.description")}</p>

  <div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard
      label={t(lang, "admin.reports.totalValue")}
      value={formatEGP(data.materialValue, lang)}
      hint={t(lang, "admin.reports.materialCount") + ": " + String(data.materialCount)}
      icon={Coins}
      tone="honey"
      valueTestId="admin-report-material-value"
    />
    <StatCard
      label={t(lang, "admin.reports.totalKg")}
      value={data.totalKg.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 1 })}
      hint={t(lang, "admin.reports.batchCount") + ": " + String(data.batchCount)}
      icon={Boxes}
      tone="olive"
      valueTestId="admin-report-total-kg"
    />
    <StatCard
      label={t(lang, "admin.reports.lowVariantCount")}
      value={String(data.alerts.lowVariant)}
      icon={Package}
      tone="clay"
      valueTestId="admin-report-low-variant"
    />
    <StatCard
      label={t(lang, "admin.reports.warehouseCount")}
      value={String(data.warehouseCount)}
      icon={Warehouse}
      tone="cocoa"
      valueTestId="admin-report-warehouse-count"
    />
  </div>

  <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
    <StatCard
      label={t(lang, "admin.reports.lowBatch")}
      value={String(data.alerts.lowBatch)}
      icon={AlertTriangle}
      tone="clay"
      valueTestId="admin-report-low-batch"
    />
    <StatCard
      label={t(lang, "admin.reports.expiringBatchCount")}
      value={String(data.alerts.expiringBatch)}
      icon={CalendarClock}
      tone="clay"
      valueTestId="admin-report-expiring"
    />
    <StatCard
      label={t(lang, "admin.reports.lowMaterialCount")}
      value={String(data.alerts.lowMaterial)}
      icon={Layers}
      tone="clay"
      valueTestId="admin-report-low-material"
    />
  </div>
</section>
