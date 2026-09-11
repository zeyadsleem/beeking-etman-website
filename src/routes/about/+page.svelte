<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);
  const seal = $derived(lang === "en" ? "/images/etman-wax-en.png" : "/images/etman-wax-ar.png");

  const timeline = $derived([
    {
      year: t(lang, "about.timeline.1940Year"),
      title: t(lang, "about.timeline.1940Title"),
      body: t(lang, "about.timeline.1940Body"),
      icon: "M12 3v3M6.2 5.6l2 2M17.8 5.6l-2 2M4 12h3M17 12h3M6.2 18.4l2-2M17.8 18.4l-2-2M12 18v3",
    },
    {
      year: t(lang, "about.timeline.1970Year"),
      title: t(lang, "about.timeline.1970Title"),
      body: t(lang, "about.timeline.1970Body"),
      icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z",
    },
    {
      year: t(lang, "about.timeline.2010Year"),
      title: t(lang, "about.timeline.2010Title"),
      body: t(lang, "about.timeline.2010Body"),
      icon: "M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3M10 7H7a5 5 0 0 0-5 5 5 5 0 0 0 5 5h3M8 12h8",
    },
    {
      year: t(lang, "about.timeline.presentYear"),
      title: t(lang, "about.timeline.presentTitle"),
      body: t(lang, "about.timeline.presentBody"),
      icon: "M8 3v4M16 3v4M3 15h18M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z",
    },
  ]);

  const ecosystem = $derived([
    {
      title: t(lang, "about.ecoHoneyTitle"),
      body: t(lang, "about.ecoHoneyBody"),
      icon: "M12 3v3M6.2 5.6l2 2M17.8 5.6l-2 2M4 12h3M17 12h3M6.2 18.4l2-2M17.8 18.4l-2-2M12 18v3",
    },
    {
      title: t(lang, "about.ecoEquipmentTitle"),
      body: t(lang, "about.ecoEquipmentBody"),
      icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z",
    },
    {
      title: t(lang, "about.ecoWaxTitle"),
      body: t(lang, "about.ecoWaxBody"),
      icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z",
    },
  ]);

  const values = $derived([
    {
      title: t(lang, "about.valuesAuth"),
      body: t(lang, "about.valuesAuthBody"),
      icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2",
    },
    {
      title: t(lang, "about.valuesQuality"),
      body: t(lang, "about.valuesQualityBody"),
      icon: "M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8Z",
    },
    {
      title: t(lang, "about.valuesTransparent"),
      body: t(lang, "about.valuesTransparentBody"),
      icon: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    },
    {
      title: t(lang, "about.valuesCommunity"),
      body: t(lang, "about.valuesCommunityBody"),
      icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    },
  ]);

  const stats = $derived([
    { label: t(lang, "hero.since"), icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z M12 6v6l4 2" },
    { label: t(lang, "hero.statCustomers"), icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
    { label: t(lang, "hero.statGovernorates"), icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
  ]);
</script>

<Seo
  title={t(lang, "about.pageTitle")}
  description={t(lang, "about.heroSubtitle")}
  path="/about"
  siteName={t(lang, "brand.name")}
/>

<div class="mx-auto max-w-7xl px-4 pt-6 lg:px-6">
  <Breadcrumb
    lang={lang}
    items={[
      { label: t(lang, "nav.home"), href: "/" },
      { label: t(lang, "footer.about") },
    ]}
  />
</div>

<!-- Hero -->
<section class="relative start-1/2 -ms-[50vw] w-screen overflow-x-clip bg-gradient-to-b from-paper via-paper to-cream">
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div class="honeycomb absolute inset-0 opacity-50"></div>
    <div class="absolute -top-32 end-[-6rem] h-[26rem] w-[26rem] rounded-full bg-honey-200/40 blur-3xl"></div>
    <div class="absolute bottom-[-8rem] start-[-6rem] h-[20rem] w-[20rem] rounded-full bg-clay-100/40 blur-3xl"></div>
  </div>

  <div class="relative mx-auto max-w-3xl px-4 pb-20 pt-12 text-center sm:pb-28 sm:pt-16">
    <p class="eyebrow">{t(lang, "about.heroEyebrow")}</p>
    <h1 class="headline mt-5 text-4xl leading-tight text-cocoa-900 sm:text-5xl lg:text-6xl">
      {t(lang, "about.heroTitle")}
    </h1>
    <div class="mx-auto mt-7 h-1 w-28 rounded-full bg-gradient-to-r from-honey-200 via-honey-500 to-honey-800" aria-hidden="true"></div>
    <p class="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-cocoa-600">
      {t(lang, "about.heroSubtitle")}
    </p>
    <img src={seal} alt={t(lang, "brand.tagline")} class="seal mx-auto mt-10 h-32 w-32 sm:h-40 sm:w-40" />
  </div>
</section>

<!-- Stat strip -->
<div class="border-y border-honey-100 bg-cream">
  <div class="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-4 py-8 text-center sm:grid-cols-3 sm:px-6">
    {#each stats as item (item.label)}
      <div class="flex items-center justify-center gap-3 sm:flex-col sm:gap-0">
        <span class="hex-frame grid h-12 w-12 shrink-0 place-items-center bg-honey-100 text-honey-800">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={item.icon} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <p class="text-sm font-bold text-cocoa-900 sm:mt-3 sm:text-lg">{item.label}</p>
      </div>
    {/each}
  </div>
</div>

<!-- Vision / story -->
<section class="mx-auto mt-20 max-w-7xl px-4 lg:px-6">
  <div class="grid items-center gap-10 lg:grid-cols-2">
    <div class="aspect-[4/3] overflow-hidden rounded-3xl border border-honey-100 bg-cream shadow-warm">
      <img src="/images/Beeking Etman/برواز البرسيم.png" alt={t(lang, "about.visionTitle")} class="h-full w-full object-cover" />
    </div>
    <div>
      <p class="eyebrow">{t(lang, "about.visionEyebrow")}</p>
      <SectionTitle className="mt-2 text-3xl text-cocoa-900 sm:text-4xl">{t(lang, "about.visionTitle")}</SectionTitle>
      <p class="mt-5 leading-relaxed text-cocoa-600">{t(lang, "about.visionBody")}</p>
    </div>
  </div>
</section>

<!-- Timeline -->
<section class="mx-auto mt-20 max-w-7xl px-4 lg:px-6">
  <div class="text-center">
    <SectionTitle className="text-3xl text-cocoa-900 sm:text-4xl">{t(lang, "about.timelineEyebrow")}</SectionTitle>
  </div>

  <div class="relative mx-auto mt-12 max-w-3xl">
    <div class="absolute bottom-4 start-6 top-4 w-px bg-gradient-to-b from-honey-200 via-honey-500 to-honey-200" aria-hidden="true"></div>
    <ol class="space-y-8">
      {#each timeline as item (item.year)}
        <li class="relative flex gap-5">
          <span class="hex-frame relative z-10 grid h-12 w-12 shrink-0 place-items-center bg-gradient-to-br from-honey-400 to-honey-700 text-[11px] font-bold text-cocoa-950">
            {item.year}
          </span>
          <div class="flex-1 rounded-2xl border border-honey-100 bg-parchment p-5 shadow-warm-sm">
            <h3 class="headline text-lg text-cocoa-900">{item.title}</h3>
            <p class="mt-1.5 text-sm leading-relaxed text-cocoa-500">{item.body}</p>
          </div>
        </li>
      {/each}
    </ol>
  </div>
</section>

<!-- Ecosystem -->
<section class="mx-auto mt-20 max-w-7xl px-4 lg:px-6">
  <div class="text-center">
    <SectionTitle className="text-3xl text-cocoa-900 sm:text-4xl">{t(lang, "about.ecosystemEyebrow")}</SectionTitle>
  </div>
  <div class="mt-10 grid gap-6 sm:grid-cols-3">
    {#each ecosystem as item (item.title)}
      <div class="rounded-3xl border border-honey-100 bg-parchment p-6 shadow-warm-sm">
        <span class="hex-frame grid h-12 w-12 place-items-center bg-honey-100 text-honey-800">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={item.icon} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <h3 class="headline mt-4 text-lg text-cocoa-900">{item.title}</h3>
        <p class="mt-1.5 text-sm leading-relaxed text-cocoa-500">{item.body}</p>
      </div>
    {/each}
  </div>
</section>

<!-- Values -->
<section class="mx-auto mt-20 max-w-7xl px-4 lg:px-6">
  <div class="text-center">
    <SectionTitle className="text-3xl text-cocoa-900 sm:text-4xl">{t(lang, "about.valuesTitle")}</SectionTitle>
  </div>
  <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
    {#each values as item (item.title)}
      <div class="rounded-3xl border border-honey-100 bg-parchment p-6 text-center shadow-warm-sm">
        <span class="hex-frame mx-auto grid h-14 w-14 place-items-center bg-honey-50 text-honey-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={item.icon} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <h3 class="headline mt-4 text-lg text-cocoa-900">{item.title}</h3>
        <p class="mt-1.5 text-sm leading-relaxed text-cocoa-500">{item.body}</p>
      </div>
    {/each}
  </div>
</section>

<!-- CTA -->
<section class="mx-auto mt-20 max-w-7xl px-4 lg:px-6">
  <div class="relative overflow-hidden rounded-3xl border border-honey-200 bg-gradient-to-br from-honey-100 via-cream to-cream-deep p-8 text-center sm:p-14">
    <div class="honeycomb pointer-events-none absolute inset-0 opacity-50" aria-hidden="true"></div>
    <div class="relative mx-auto max-w-2xl">
      <img src={seal} alt="" class="seal mx-auto h-24 w-24" />
      <p class="eyebrow mt-4">{t(lang, "about.ctaEyebrow")}</p>
      <h2 class="headline mt-3 text-3xl text-cocoa-900">{t(lang, "about.ctaTitle")}</h2>
      <p class="mt-3 text-cocoa-600">{t(lang, "about.ctaBody")}</p>
      <Button variant="primary" href="/contact" class="mt-6 px-7 py-3">{t(lang, "about.ctaButton")}</Button>
    </div>
  </div>
</section>
