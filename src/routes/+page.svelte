<script lang="ts">
  import Button from "$lib/components/Button.svelte";
  import Hero from "$lib/components/Hero.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { ProductSummary } from "$lib/server/store";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);

  const bySlug = (slugs: string[]): ProductSummary[] => {
    const wanted = new Set(slugs);
    return data.products.filter((p) => wanted.has(p.slug));
  };

  const rails = [
    {
      slugs: [
        "sidr-honey-1kg",
        "royal-jelly-5g",
        "propolis-box",
        "blackseed-honey-1kg",
        "six-blend-1kg-plastic",
        "ginseng-box",
        "palm-pollen-box",
        "bee-pollen-box",
      ],
    },
    {
      slugs: [
        "clover-honey-1kg-glass",
        "citrus-honey-1kg",
        "marjoram-honey-500g",
        "comb-honey-500g-clover",
        "comb-frame-clover",
      ],
    },
    {
      slugs: [
        "nuts-in-honey-370",
        "hazelnut-100g",
        "pistachio-100g",
        "almond-100g",
        "cashew-100g",
        "mixed-nuts-100g",
        "nuts-extra-can-500g",
      ],
    },
  ];
</script>

<svelte:head><title>{t(lang, "home.title")}</title></svelte:head>

<Hero lang={lang} featured={data.featured} productCount={data.products.length} />

<div class="border-y border-cocoa-100 bg-parchment/70">
  <div class="mx-auto grid max-w-3xl grid-cols-1 gap-y-2 px-6 py-5 text-center sm:grid-cols-3 sm:divide-x sm:divide-cocoa-100">
    <p class="text-sm font-semibold text-cocoa-700">{t(lang, "home.benefitShipping")}</p>
    <p class="text-sm font-semibold text-cocoa-700">{t(lang, "home.benefitCod")}</p>
    <p class="text-sm font-semibold text-cocoa-700">{t(lang, "home.benefitGift")}</p>
  </div>
</div>

<section class="mt-20">
  <div class="flex items-end justify-between gap-4">
    <div>
      <p class="eyebrow">{t(lang, "home.featuredEyebrow")}</p>
      <SectionTitle className="mt-2 text-3xl">{t(lang, "home.featuredTitle")}</SectionTitle>
    </div>
    <Button variant="outline" href="/products" class="text-sm">{t(lang, "home.allProducts")}</Button>
  </div>
  <div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {#each data.featured as product (product.id)}
      <ProductCard lang={lang} {product} />
    {/each}
  </div>
</section>

<section id="categories" class="mt-20 scroll-mt-24">
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
        <p class="mt-2 text-sm leading-relaxed text-cocoa-500">{t(lang, `category.story.${cat.slug}`)}</p>
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
    <section class="mt-20">
      <div class="flex items-end justify-between gap-4">
        <div>
          <SectionTitle className="text-3xl">{t(lang, `home.rail${r + 1}.title`)}</SectionTitle>
          <p class="mt-1 text-sm text-cocoa-500">{t(lang, `home.rail${r + 1}.note`)}</p>
        </div>
        <Button variant="outline" href="/products" class="text-sm">{t(lang, "home.browseAll")}</Button>
      </div>
      <div class="mt-8 grid grid-cols-2 gap-4 overflow-x-auto sm:grid-cols-3 lg:grid-cols-4">
        {#each bySlug(rail.slugs) as product (product.id)}
          <ProductCard lang={lang} {product} />
        {/each}
      </div>
    </section>
  {/if}
{/each}

<section class="paper-panel mt-20 px-6 py-12 text-center sm:px-10">
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