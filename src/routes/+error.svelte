<script lang="ts">
  import { page } from "$app/state";
  import { getDir, t } from "$lib/i18n/messages";
  import Button from "$lib/components/Button.svelte";
  import HoneycombIcon from "$lib/components/HoneycombIcon.svelte";

  // Layout data is absent when the root layout load itself failed.
  let {
    data,
  }: {
    data?: { lang?: import("$lib/i18n/messages").Lang } | null;
  } = $props();

  const lang = $derived(data?.lang ?? "ar");
  const status = $derived(page.status);
  const isNotFound = $derived(status === 404);
  const thrownMessage = $derived(page.error?.message ?? "");
</script>

<svelte:head>
  <title>{status} — {t(lang, "brand.name")}</title>
</svelte:head>

<section
  class="flex flex-col items-center justify-center gap-6 py-20 text-center sm:py-28"
  dir={getDir(lang)}
>
  <div class="relative select-none" aria-hidden="true">
    <HoneycombIcon size={150} class="absolute -top-9 start-1/2 -translate-x-1/2 text-honey-200 rtl:-scale-x-100" />
    <p
      data-testid="error-code"
      class="headline bg-gradient-to-br from-honey-300 via-honey-600 to-honey-800 bg-clip-text text-[7rem] leading-none font-bold text-transparent sm:text-[10rem]"
    >
      {status}
    </p>
  </div>

  <h1 data-testid="error-title" class="headline text-3xl text-cocoa-900 sm:text-4xl">
    {isNotFound ? t(lang, "error.notFoundTitle") : t(lang, "error.title")}
  </h1>

  <p data-testid="error-body" class="max-w-md text-cocoa-600">
    {thrownMessage || (isNotFound ? t(lang, "error.notFoundBody") : t(lang, "error.body"))}
  </p>

  <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
    <Button data-testid="error-home-link" href="/">{t(lang, "error.backHome")}</Button>
    <Button data-testid="error-store-link" variant="outline" href="/products">
      {t(lang, "cart.browse")}
    </Button>
  </div>
</section>
