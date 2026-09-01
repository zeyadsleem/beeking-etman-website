<script lang="ts">
  import Hero from "$lib/components/Hero.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { organizationJsonLd, websiteJsonLd } from "$lib/seo";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);
</script>

<Seo
  title={t(lang, "home.title")}
  description={t(lang, "meta.home.description")}
  path="/"
  siteName={t(lang, "brand.name")}
  jsonLd={[organizationJsonLd(lang), websiteJsonLd(lang)]}
/>

<Hero lang={lang} productCount={data.products.length} />

<div class="border-y border-cocoa-100 bg-parchment/70">
  <div class="mx-auto grid max-w-3xl grid-cols-3 px-4 py-4 text-center sm:px-6 sm:py-5">
    <p class="flex flex-col items-center gap-1.5 text-xs font-semibold text-cocoa-700 sm:flex-row sm:justify-center sm:gap-2 sm:text-sm">
      <svg class="h-5 w-5 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M13 18h-4M15 8h2.5a1 1 0 0 1 .78.38l3.44 4.35a1 1 0 0 1 .22.62V17a1 1 0 0 1-1 1h-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="6.5" cy="18" r="2" stroke="currentColor" stroke-width="1.8" />
        <circle cx="17" cy="18" r="2" stroke="currentColor" stroke-width="1.8" />
      </svg>
      {t(lang, "home.benefitShipping")}
    </p>
    <p class="flex flex-col items-center gap-1.5 text-xs font-semibold text-cocoa-700 sm:flex-row sm:justify-center sm:gap-2 sm:text-sm">
      <svg class="h-5 w-5 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="1.8" />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.8" />
        <path d="M6 12h.01M18 12h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      {t(lang, "home.benefitCod")}
    </p>
    <p class="flex flex-col items-center gap-1.5 text-xs font-semibold text-cocoa-700 sm:flex-row sm:justify-center sm:gap-2 sm:text-sm">
      <svg class="h-5 w-5 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="8" width="18" height="4" rx="1" stroke="currentColor" stroke-width="1.8" />
        <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {t(lang, "home.benefitGift")}
    </p>
  </div>
</div>

<section class="paper-panel mt-14 px-6 py-12 text-center sm:mt-16 sm:px-10 lg:mt-20">
  <SectionTitle className="mx-auto text-3xl">{t(lang, "home.whyTitle")}</SectionTitle>
  <div class="mx-auto mt-10 grid max-w-4xl gap-10 sm:grid-cols-3">
    <div>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-honey-50 text-honey-700 ring-1 ring-inset ring-honey-200">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v3M6.2 5.6l2 2M17.8 5.6l-2 2M4 12h3M17 12h3M6.2 18.4l2-2M17.8 18.4l-2-2M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.8" />
        </svg>
      </div>
      <h3 class="headline mt-4 text-lg text-cocoa-900">{t(lang, "home.whyTrusted")}</h3>
      <p class="mt-1 text-sm leading-relaxed text-cocoa-500">{t(lang, "home.whyTrustedBody")}</p>
    </div>
    <div>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-honey-50 text-honey-700 ring-1 ring-inset ring-honey-200">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21c-4-3-7-6.2-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5c0 3.3-3 6.5-7 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 class="headline mt-4 text-lg text-cocoa-900">{t(lang, "home.whyFast")}</h3>
      <p class="mt-1 text-sm leading-relaxed text-cocoa-500">{t(lang, "home.whyFastBody")}</p>
    </div>
    <div>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-honey-50 text-honey-700 ring-1 ring-inset ring-honey-200">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3l-4.8 2.6.9-5.4L4.2 7.7l5.4-.8L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 class="headline mt-4 text-lg text-cocoa-900">{t(lang, "home.whyQuality")}</h3>
      <p class="mt-1 text-sm leading-relaxed text-cocoa-500">{t(lang, "home.whyQualityBody")}</p>
    </div>
  </div>
</section>