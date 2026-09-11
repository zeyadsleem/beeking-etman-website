<script lang="ts">
  import Logo from "$lib/components/Logo.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let {
    lang = "ar",
    title,
    helper,
    children,
  }: {
    lang?: Lang;
    title: string;
    helper?: string;
    children: import("svelte").Snippet;
  } = $props();

  const seal = $derived(lang === "en" ? "/images/etman-wax-en.png" : "/images/etman-wax-ar.png");
</script>

<div class="mx-auto mt-12 max-w-4xl motion-safe:animate-fade-up">
  <div class="grid overflow-hidden rounded-3xl border border-honey-100 bg-parchment shadow-warm lg:grid-cols-2">
    <div class="relative hidden overflow-hidden bg-gradient-to-br from-honey-100 via-cream to-cream-deep p-10 lg:flex lg:flex-col">
      <div class="honeycomb pointer-events-none absolute inset-0"></div>
      <div class="relative flex flex-1 flex-col">
        <Logo alt={t(lang, "brand.name")} class="h-16 w-16" />
        <p class="mt-6 font-display text-2xl font-bold text-cocoa-900">{t(lang, "brand.name")}</p>
        <p class="mt-1 text-sm text-cocoa-500">{t(lang, "brand.tagline")}</p>
        <div class="mt-auto pt-10">
          <img src={seal} alt="" aria-hidden="true" class="seal h-24 w-24" />
          <p class="mt-3 text-sm font-semibold tracking-wide text-honey-700">{t(lang, "hero.since")}</p>
        </div>
      </div>
    </div>

    <div class="p-7 sm:p-10">
      <div class="mb-7 flex items-center gap-3 lg:hidden">
        <Logo alt={t(lang, "brand.name")} class="h-10 w-10 shrink-0" />
        <span class="font-display text-lg font-bold text-cocoa-900">{t(lang, "brand.name")}</span>
      </div>
      <h1 class="headline text-3xl text-cocoa-900">{title}</h1>
      {#if helper}
        <p class="mt-1 text-sm text-cocoa-500">{helper}</p>
      {/if}
      <div class="mt-6">
        {@render children()}
      </div>
    </div>
  </div>
</div>
