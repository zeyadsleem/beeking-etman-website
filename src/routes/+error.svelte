<script lang="ts">
  import { page } from "$app/state";
  import { getDir, t } from "$lib/i18n/messages";
  import Button from "$lib/components/Button.svelte";

  // Layout data is absent when the root layout load itself failed. Prefer the
  // reactive `page.data.lang`: invalidateAll() (language switch) patches it
  // live, while the `data` prop keeps the stale snapshot from the failed
  // navigation that rendered this error page.
  let {
    data,
  }: {
    data?: { lang?: import("$lib/i18n/messages").Lang } | null;
  } = $props();

  const lang = $derived((page.data as { lang?: import("$lib/i18n/messages").Lang }).lang ?? data?.lang ?? "ar");
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
  <div data-testid="error-frame" class="relative w-56 select-none sm:w-72" role="presentation">
    <svg viewBox="0 0 260 300" fill="none" aria-hidden="true" class="h-auto w-full">
      <defs>
        <linearGradient id="error-hexagon-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--color-honey-300)" />
          <stop offset="55%" stop-color="var(--color-honey-600)" />
          <stop offset="100%" stop-color="var(--color-honey-800)" />
        </linearGradient>
      </defs>
      <path
        data-testid="error-frame-shape"
        d="M130 6l118 68v152l-118 68-118-68V74L130 6Z"
        stroke="url(#error-hexagon-stroke)"
        stroke-width="5"
      />
    </svg>
    <p
      data-testid="error-code"
      class="headline absolute inset-0 flex items-center justify-center bg-gradient-to-br from-honey-300 via-honey-600 to-honey-800 bg-clip-text text-7xl font-bold text-transparent sm:text-8xl"
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
