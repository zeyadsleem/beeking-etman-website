<script lang="ts">
  import Hero from "$lib/components/Hero.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import Button from "$lib/components/Button.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { organizationJsonLd, websiteJsonLd } from "$lib/seo";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);
  const featured = $derived(data.featured.slice(0, 4));
  const seal = $derived(data.lang === "en" ? "/images/etman-wax-en.png" : "/images/etman-wax-ar.png");

  const departments = $derived([
    {
      href: "/honey",
      title: t(lang, "nav.storeHoney"),
      desc: t(lang, "home.deptShopHoneyDesc"),
      image: "/images/Beeking Etman/برطمان السدر المصرى.jpg",
      icon: "M12 3v3M6.2 5.6l2 2M17.8 5.6l-2 2M4 12h3M17 12h3M6.2 18.4l2-2M17.8 18.4l-2-2M12 18v3",
    },
    {
      href: "/equipment",
      title: t(lang, "nav.storeEquipment"),
      desc: t(lang, "home.deptShopEquipmentDesc"),
      image: "/images/Beeking Etman/فراز كهربائي 4 برواز ستانلس.jpg",
      icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z",
    },
  ]);
</script>

<Seo
  title={t(lang, "home.title")}
  description={t(lang, "meta.home.description")}
  path="/"
  siteName={t(lang, "brand.name")}
  jsonLd={[organizationJsonLd(lang), websiteJsonLd(lang)]}
/>

<Hero lang={lang} productCount={data.products.length} />

<!-- Trust strip -->
<div class="border-y border-honey-100 bg-cream">
  <div class="mx-auto grid max-w-4xl grid-cols-1 gap-3 px-4 py-5 text-center sm:grid-cols-3 sm:gap-6 sm:px-6">
    <p class="flex items-center justify-center gap-2 text-xs font-semibold text-cocoa-700 sm:text-sm">
      <svg class="h-5 w-5 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M13 18h-4M15 8h2.5a1 1 0 0 1 .78.38l3.44 4.35a1 1 0 0 1 .22.62V17a1 1 0 0 1-1 1h-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="6.5" cy="18" r="2" stroke="currentColor" stroke-width="1.8" />
        <circle cx="17" cy="18" r="2" stroke="currentColor" stroke-width="1.8" />
      </svg>
      {t(lang, "home.benefitShipping")}
    </p>
    <p class="flex items-center justify-center gap-2 text-xs font-semibold text-cocoa-700 sm:text-sm">
      <svg class="h-5 w-5 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.8" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      </svg>
      {t(lang, "home.benefitSecurePayment")}
    </p>
    <p class="flex items-center justify-center gap-2 text-xs font-semibold text-cocoa-700 sm:text-sm">
      <svg class="h-5 w-5 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="8" width="18" height="4" rx="1" stroke="currentColor" stroke-width="1.8" />
        <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {t(lang, "home.benefitGift")}
    </p>
  </div>
</div>

<!-- Departments -->
<section id="categories" class="mx-auto mt-16 max-w-7xl px-4 sm:mt-20 lg:px-6">
  <div class="text-center">
    <p class="eyebrow">{t(lang, "home.categoriesEyebrow")}</p>
    <SectionTitle className="mt-2 text-3xl text-cocoa-900 sm:text-4xl">{t(lang, "home.categoriesTitle")}</SectionTitle>
  </div>
  <div class="mt-10 grid gap-6 sm:grid-cols-2">
    {#each departments as d (d.href)}
      <a
        href={d.href}
        class="group relative overflow-hidden rounded-3xl border border-honey-100 bg-parchment shadow-warm-sm transition duration-300 hover:-translate-y-1 hover:shadow-warm-lg"
      >
        <div class="aspect-[16/10] overflow-hidden">
          <img src={d.image} alt={d.title} loading="lazy" class="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        </div>
        <div class="absolute inset-0 bg-gradient-to-t from-cocoa-950/80 via-cocoa-950/15 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 flex items-end gap-3 p-6 text-parchment">
          <span class="hex-frame grid h-12 w-12 shrink-0 place-items-center bg-honey-500 text-cocoa-950">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d={d.icon} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="min-w-0">
            <span class="headline block text-2xl">{d.title}</span>
            <span class="mt-1 block text-sm text-cocoa-100">{d.desc}</span>
          </span>
        </div>
        <span class="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full bg-parchment/90 px-3 py-1 text-xs font-bold text-cocoa-800">
          {t(lang, "home.shopNow")}
        </span>
      </a>
    {/each}
  </div>
</section>

<!-- Featured products -->
{#if featured.length > 0}
  <section class="mx-auto mt-20 max-w-7xl px-4 lg:px-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">{t(lang, "home.featuredEyebrow")}</p>
        <SectionTitle className="mt-2 text-3xl text-cocoa-900 sm:text-4xl">{t(lang, "home.featuredTitle")}</SectionTitle>
      </div>
      <a href="/products" class="inline-flex items-center gap-1.5 text-sm font-semibold text-honey-700 transition-colors hover:text-honey-800">
        {t(lang, "home.allProducts")}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </a>
    </div>
    <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {#each featured as product (product.id)}
        <ProductCard {lang} {product} />
      {/each}
    </div>
  </section>
{/if}

<!-- Why -->
<section class="mt-20 border-y border-honey-100 bg-cream">
  <div class="relative mx-auto max-w-5xl px-4 py-16 text-center lg:px-6">
    <div class="honeycomb pointer-events-none absolute inset-0 opacity-40" aria-hidden="true"></div>
    <div class="relative">
      <SectionTitle className="text-3xl text-cocoa-900 sm:text-4xl">{t(lang, "home.whyTitle")}</SectionTitle>
      <div class="mx-auto mt-10 grid gap-10 sm:grid-cols-3">
        <div>
          <div class="hex-frame mx-auto grid h-16 w-16 place-items-center bg-honey-100 text-honey-800">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v3M6.2 5.6l2 2M17.8 5.6l-2 2M4 12h3M17 12h3M6.2 18.4l2-2M17.8 18.4l-2-2M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.8" />
            </svg>
          </div>
          <h3 class="headline mt-4 text-lg text-cocoa-900">{t(lang, "home.whyTrusted")}</h3>
          <p class="mt-1 text-sm leading-relaxed text-cocoa-500">{t(lang, "home.whyTrustedBody")}</p>
        </div>
        <div>
          <div class="hex-frame mx-auto grid h-16 w-16 place-items-center bg-honey-100 text-honey-800">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 21c-4-3-7-6.2-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5c0 3.3-3 6.5-7 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
            </svg>
          </div>
          <h3 class="headline mt-4 text-lg text-cocoa-900">{t(lang, "home.whyFast")}</h3>
          <p class="mt-1 text-sm leading-relaxed text-cocoa-500">{t(lang, "home.whyFastBody")}</p>
        </div>
        <div>
          <div class="hex-frame mx-auto grid h-16 w-16 place-items-center bg-honey-100 text-honey-800">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3l-4.8 2.6.9-5.4L4.2 7.7l5.4-.8L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
            </svg>
          </div>
          <h3 class="headline mt-4 text-lg text-cocoa-900">{t(lang, "home.whyQuality")}</h3>
          <p class="mt-1 text-sm leading-relaxed text-cocoa-500">{t(lang, "home.whyQualityBody")}</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Heritage -->
<section class="mx-auto mt-20 max-w-7xl px-4 lg:px-6">
  <div class="relative overflow-hidden rounded-3xl border border-honey-200 bg-gradient-to-br from-honey-50 via-cream to-cream-deep p-8 sm:p-12">
    <div class="honeycomb pointer-events-none absolute inset-0 opacity-50" aria-hidden="true"></div>
    <div class="relative grid items-center gap-8 lg:grid-cols-[auto_1fr]">
      <img src={seal} alt={t(lang, "brand.tagline")} class="seal mx-auto h-32 w-32 lg:h-44 lg:w-44" />
      <div class="text-center lg:text-start">
        <p class="eyebrow">{t(lang, "about.heroEyebrow")}</p>
        <h2 class="headline mt-3 text-2xl text-cocoa-900 sm:text-3xl">{t(lang, "about.heroTitle")}</h2>
        <p class="mt-3 max-w-2xl text-cocoa-600">{t(lang, "about.heroSubtitle")}</p>
        <Button variant="outline" href="/about" class="mt-6">{t(lang, "footer.about")}</Button>
      </div>
    </div>
  </div>
</section>
