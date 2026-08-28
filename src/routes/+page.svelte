<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import Hero from "$lib/components/Hero.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { organizationJsonLd, websiteJsonLd } from "$lib/seo";
  import { hasMessage, t } from "$lib/i18n/messages";
  import type { ProductSummary } from "$lib/server/store";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);

  const bySlug = (slugs: string[]): ProductSummary[] => {
    const wanted = new Set(slugs);
    return data.products.filter((p) => wanted.has(p.slug));
  };

  const hasStory = (slug: string): boolean => hasMessage(`category.story.${slug}`);

  const rails = [
    {
      slugs: [
        "honey-sidr-1kg",
        "royal-jelly-5g-local",
        "propolis-10g",
        "honey-blackseed-1kg",
        "blend-hexagonal-1kg-plastic",
        "ginseng-10g",
        "jar-palm-pollen",
        "pollen-clover-20g",
      ],
    },
    {
      slugs: [
        "honey-clover-1kg",
        "honey-citrus-1kg",
        "honey-marjoram-500g",
        "comb-honey-clover-500g",
        "comb-honey-per-kg-clover",
      ],
    },
    {
      slugs: [
        "nuts-honey-370ml-plastic",
        "hazelnut-100g",
        "pistachio-100g",
        "almond-100g",
        "cashew-100g",
        "mixed-nuts-100g",
        "nuts-honey-500g-can",
      ],
    },
  ];
</script>

<Seo
  title={t(lang, "home.title")}
  description={t(lang, "meta.home.description")}
  path="/"
  siteName={t(lang, "brand.name")}
  jsonLd={[organizationJsonLd(lang), websiteJsonLd(lang)]}
/>

<Hero lang={lang} featured={data.featured} productCount={data.products.length} />

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

<section class="mx-auto mt-12 max-w-4xl px-4 sm:mt-14 sm:px-6 lg:mt-16">
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <a
      href="/honey"
      class="group relative overflow-hidden rounded-2xl border border-honey-200 bg-gradient-to-br from-honey-50 to-parchment p-8 shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:border-honey-300 hover:shadow-warm"
    >
      <div class="paper-grain pointer-events-none absolute inset-0" aria-hidden="true"></div>
      <div class="relative flex items-start justify-between">
        <div>
          <p class="eyebrow text-honey-700">{t(lang, "brand.name")}</p>
          <h2 class="headline mt-2 text-2xl text-cocoa-900">{t(lang, "home.deptShopHoney")}</h2>
          <p class="mt-2 text-sm leading-relaxed text-cocoa-500">{t(lang, "home.deptShopHoneyDesc")}</p>
        </div>
        <span class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-honey-100 text-honey-700 ring-1 ring-inset ring-honey-200 transition-all duration-300 group-hover:scale-110">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3C8 3 4 6 4 10c0 5 8 11 8 11s8-6 8-11c0-4-4-7-8-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M9 10h.01M15 10h.01M9.5 13c.83 1.25 2.33 2 4 2s3.17-.75 4-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </div>
      <span class="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-honey-700 transition-all duration-300 group-hover:gap-3">
        {t(lang, "home.shopNow")}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </a>
    <a
      href="/equipment"
      class="group relative overflow-hidden rounded-2xl border border-cocoa-200 bg-gradient-to-br from-cocoa-50 to-parchment p-8 shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:border-cocoa-300 hover:shadow-warm"
    >
      <div class="paper-grain pointer-events-none absolute inset-0" aria-hidden="true"></div>
      <div class="relative flex items-start justify-between">
        <div>
          <p class="eyebrow text-cocoa-600">{t(lang, "brand.name")}</p>
          <h2 class="headline mt-2 text-2xl text-cocoa-900">{t(lang, "home.deptShopEquipment")}</h2>
          <p class="mt-2 text-sm leading-relaxed text-cocoa-500">{t(lang, "home.deptShopEquipmentDesc")}</p>
        </div>
        <span class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cocoa-100 text-cocoa-600 ring-1 ring-inset ring-cocoa-200 transition-all duration-300 group-hover:scale-110">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </div>
      <span class="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cocoa-700 transition-all duration-300 group-hover:gap-3">
        {t(lang, "home.shopNow")}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </a>
  </div>
</section>

<section class="mt-14 sm:mt-16 lg:mt-20">
  <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
    <div>
      <p class="eyebrow">{t(lang, "home.featuredEyebrow")}</p>
      <SectionTitle className="mt-2 text-3xl">{t(lang, "home.featuredTitle")}</SectionTitle>
    </div>
    <Button variant="outline" href="/honey" class="text-sm">{t(lang, "home.allProducts")}</Button>
  </div>
  <div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {#each data.featured as product (product.id)}
      <ProductCard lang={lang} {product} />
    {/each}
  </div>
</section>

<section id="categories" class="mt-14 scroll-mt-24 sm:mt-16 lg:mt-20">
  <div>
    <p class="eyebrow">{t(lang, "home.categoriesEyebrow")}</p>
    <SectionTitle className="mt-2 text-3xl">{t(lang, "home.categoriesTitle")}</SectionTitle>
  </div>
  <div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.categories as cat (cat.id)}
      <a
        href={`/products?category=${cat.slug}`}
        class="group relative overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:border-cocoa-200 hover:shadow-warm"
      >
        <span class="eyebrow">{t(lang, "brand.name")}</span>
        <h3 class="headline mt-2 text-2xl text-cocoa-900">{cat.name}</h3>
        {#if hasStory(cat.slug)}
          <p class="mt-2 text-sm leading-relaxed text-cocoa-500">
            {t(lang, `category.story.${cat.slug}`)}
          </p>
        {/if}
        <span class="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-honey-700 transition-all duration-300 group-hover:gap-3">
          {t(lang, "home.shopNow")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </a>
    {/each}
  </div>
</section>

{#each rails as rail, r (r)}
  {#if bySlug(rail.slugs).length > 0}
    <section class="mt-14 sm:mt-16 lg:mt-20">
      <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <SectionTitle className="text-3xl">{t(lang, `home.rail${r + 1}.title`)}</SectionTitle>
          <p class="mt-1 text-sm text-cocoa-500">{t(lang, `home.rail${r + 1}.note`)}</p>
        </div>
        <Button variant="outline" href="/products" class="text-sm">{t(lang, "home.browseAll")}</Button>
      </div>
      <div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {#each bySlug(rail.slugs) as product (product.id)}
          <ProductCard lang={lang} {product} />
        {/each}
      </div>
    </section>
  {/if}
{/each}

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