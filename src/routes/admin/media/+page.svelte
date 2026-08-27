<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(1)} ${units[i]}`;
  }

  const warnClass = $derived(
    data.usage?.warnLevel === "exceeded"
      ? "text-red-700 bg-red-50"
      : data.usage?.warnLevel === "approaching"
        ? "text-amber-700 bg-amber-50"
        : "text-green-700 bg-green-50",
  );
</script>

<svelte:head>
  <title>{t(lang, "admin.media.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-4xl px-4 py-10">
  <div>
    <Button variant="ghost" href="/admin" class="text-sm">
      {t(lang, "admin.media.backToDashboard")}
    </Button>
  </div>

  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.media.title")}</SectionTitle>

  {#if data.usage === null}
    <p class="mt-6 text-sm text-cocoa-600">{t(lang, "admin.media.unavailable")}</p>
  {:else}
    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <div class="rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
        <p class="text-xs font-semibold text-cocoa-400">{t(lang, "admin.media.imageCount")}</p>
        <p class="mt-1 text-2xl font-extrabold text-cocoa-900">{data.usage.imageCount}</p>
      </div>
      <div class="rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
        <p class="text-xs font-semibold text-cocoa-400">{t(lang, "admin.media.estimatedSize")}</p>
        <p class="mt-1 text-2xl font-extrabold text-cocoa-900">
          {formatBytes(data.usage.estimatedBytes)}
        </p>
        <p class="mt-0.5 text-xs text-cocoa-500">
          / {formatBytes(data.maxStorage)} {t(lang, "admin.media.freeTierCap")}
        </p>
      </div>
      <div class="rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm">
        <p class="text-xs font-semibold text-cocoa-400">{t(lang, "admin.media.status")}</p>
        <p class="mt-1 inline-block rounded-full px-3 py-1 text-sm font-bold {warnClass}">
          {data.usage.warnLevel === "exceeded"
            ? t(lang, "admin.media.statusExceeded")
            : data.usage.warnLevel === "approaching"
              ? t(lang, "admin.media.statusApproaching")
              : t(lang, "admin.media.statusOk")}
        </p>
      </div>
    </div>
  {/if}
</section>
