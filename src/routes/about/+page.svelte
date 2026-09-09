<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);

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
</script>

<Seo
  title={t(lang, "about.pageTitle")}
  description={t(lang, "about.heroSubtitle")}
  path="/about"
  siteName={t(lang, "brand.name")}
/>

<div class="relative overflow-hidden">
  <div
    class="pointer-events-none absolute inset-x-0 -top-24 h-96 bg-[radial-gradient(60%_100%_at_50%_0%,#fef3c7_0%,#fde68a_30%,transparent_75%)] opacity-60"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(40%_100%_at_85%_20%,#fde68a_0%,transparent_70%)] opacity-40"
    aria-hidden="true"
  ></div>

  <div class="relative mx-auto max-w-7xl px-4 pt-6 sm:px-6">
    <Breadcrumb
      lang={lang}
      items={[
        { label: t(lang, "nav.home"), href: "/" },
        { label: t(lang, "footer.about") },
      ]}
      className="mb-10"
    />
  </div>

  <!-- Hero -->
  <section class="relative mx-auto max-w-3xl px-4 pb-14 text-center sm:pb-20">
    <p class="eyebrow motion-safe:animate-fade-up">{t(lang, "about.heroEyebrow")}</p>
    <h1 class="headline mt-5 text-4xl leading-tight text-cocoa-900 motion-safe:animate-fade-up sm:text-5xl">
      {t(lang, "about.heroTitle")}
    </h1>
    <div
      class="mx-auto mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-honey-300 via-honey-600 to-honey-800 motion-safe:animate-fade-up"
      aria-hidden="true"
    ></div>
    <p class="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-cocoa-500 motion-safe:animate-fade-up">
      {t(lang, "about.heroSubtitle")}
    </p>
  </section>
</div>

<!-- Stat strip -->
<div class="relative border-y border-honey-100 bg-gradient-to-b from-paper-deep to-paper">
  <div class="mx-auto grid max-w-4xl grid-cols-3 px-4 py-6 text-center sm:px-6 sm:py-8">
    <div class="rounded-2xl p-3 sm:p-4">
      <svg class="mx-auto h-6 w-6 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" stroke="currentColor" stroke-width="1.8" />
        <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <p class="mt-2 text-sm font-bold text-cocoa-900 sm:text-lg">{t(lang, "hero.since")}</p>
    </div>
    <div class="rounded-2xl p-3 sm:p-4">
      <svg class="mx-auto h-6 w-6 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <p class="mt-2 text-sm font-bold text-cocoa-900 sm:text-lg">{t(lang, "hero.statCustomers")}</p>
    </div>
    <div class="rounded-2xl p-3 sm:p-4">
      <svg class="mx-auto h-6 w-6 shrink-0 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.8" />
        <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.8" />
      </svg>
      <p class="mt-2 text-sm font-bold text-cocoa-900 sm:text-lg">{t(lang, "hero.statGovernorates")}</p>
    </div>
  </div>
</div>

<!-- Heritage Timeline -->
<section class="relative mx-auto mt-16 max-w-4xl px-4 sm:mt-24 sm:px-6">
  <div
    class="pointer-events-none absolute start-1/2 top-0 hidden h-full w-px bg-gradient-to-b from-honey-200 via-honey-400 to-honey-200 opacity-40 sm:block"
    aria-hidden="true"
  ></div>

  <SectionTitle as="h2" className="text-center text-3xl">
    {t(lang, "about.timelineEyebrow")}
  </SectionTitle>

  <div class="relative mt-12 sm:mt-14">
    <div
      class="absolute start-4 top-0 h-full w-px bg-gradient-to-b from-honey-200 via-honey-400 to-honey-200 opacity-50 sm:start-1/2 sm:-ms-px"
      aria-hidden="true"
    ></div>

    <div class="space-y-10 sm:space-y-14">
      {#each timeline as item, i (item.year)}
        {@const isEven = i % 2 === 0}
        <div
          class="relative flex gap-6 sm:gap-0 {isEven
            ? 'sm:flex-row'
            : 'sm:flex-row-reverse'}"
        >
          <div
            class="absolute start-4 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-honey-400 to-honey-700 text-parchment shadow-warm-sm ring-4 ring-paper sm:start-1/2 motion-safe:animate-fade-up"
            aria-hidden="true"
          >
            <span class="block h-2 w-2 rounded-full bg-parchment"></span>
          </div>

          <div class="ms-10 flex-1 sm:ms-0 {isEven ? 'sm:pe-12' : 'sm:ps-12'} motion-safe:animate-fade-up">
            <div class="group rounded-2xl border border-honey-100 bg-parchment p-6 shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-warm sm:p-7">
              <span class="text-xs font-bold uppercase tracking-[0.18em] text-honey-700">{item.year}</span>
              <h3 class="headline mt-2 text-xl text-cocoa-900">{item.title}</h3>
              <p class="mt-2.5 text-sm leading-relaxed text-cocoa-500">
                {item.body}
              </p>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Shibshir Ecosystem -->
<section class="relative mx-auto mt-16 max-w-5xl px-4 sm:mt-24 sm:px-6">
  <div
    class="pointer-events-none absolute inset-x-0 top-10 mx-auto h-72 max-w-2xl rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,#fef3c7_0%,transparent_70%)] opacity-50"
    aria-hidden="true"
  ></div>

  <SectionTitle as="h2" className="relative text-center text-3xl">
    {t(lang, "about.ecosystemEyebrow")}
  </SectionTitle>

  <div class="relative mt-12 grid gap-6 sm:grid-cols-3">
    {#each ecosystem as card, i (card.title)}
      <div
        class="group relative overflow-hidden rounded-3xl border border-honey-100 bg-parchment p-7 text-center shadow-warm-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-warm motion-safe:animate-fade-up"
        style={`animation-delay: ${i * 0.08}s`}
      >
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-honey-50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden="true"
        ></div>
        <div
          class="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-honey-100 to-honey-200 text-honey-700 shadow-warm-sm ring-1 ring-inset ring-honey-200 transition-colors group-hover:text-honey-800"
        >
          <svg
            class="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d={card.icon} />
          </svg>
        </div>
        <h3 class="headline relative mt-5 text-lg text-cocoa-900">{card.title}</h3>
        <p class="relative mt-2.5 text-sm leading-relaxed text-cocoa-500">{card.body}</p>
      </div>
    {/each}
  </div>
</section>

<!-- Vision & Values -->
<section class="relative mx-auto mt-16 max-w-4xl px-4 sm:mt-24 sm:px-6">
  <SectionTitle as="h2" className="text-center text-3xl">
    {t(lang, "about.visionEyebrow")}
  </SectionTitle>

  <div class="relative mt-12 overflow-hidden rounded-3xl border border-honey-100 bg-parchment p-7 shadow-warm-sm sm:p-10 motion-safe:animate-fade-up">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-honey-300 via-honey-600 to-honey-800"
      aria-hidden="true"
    ></div>
    <div
      class="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,#fef3c7_0%,transparent_70%)]"
      aria-hidden="true"
    ></div>
    <h3 class="headline relative text-2xl text-cocoa-900">
      {t(lang, "about.visionTitle")}
    </h3>
    <p class="relative mt-4 text-base leading-relaxed text-cocoa-500">
      {t(lang, "about.visionBody")}
    </p>
  </div>

  <h3 class="headline mt-14 text-center text-2xl text-cocoa-900">
    {t(lang, "about.valuesTitle")}
  </h3>

  <div class="mt-8 grid gap-5 sm:grid-cols-2">
    {#each values as value (value.title)}
      <div class="group flex gap-4 rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:border-honey-200 hover:shadow-warm">
        <div class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-honey-50 text-honey-700 ring-1 ring-inset ring-honey-100 transition-colors group-hover:bg-honey-100">
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d={value.icon} />
          </svg>
        </div>
        <div>
          <h4 class="headline text-base text-cocoa-900">{value.title}</h4>
          <p class="mt-1.5 text-sm leading-relaxed text-cocoa-500">
            {value.body}
          </p>
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- Contact CTA -->
<section class="relative mx-auto mt-16 max-w-4xl px-4 pb-16 sm:mt-24 sm:px-6 sm:pb-24">
  <div class="relative overflow-hidden rounded-3xl bg-ink-950 px-6 py-12 text-center text-parchment shadow-warm-lg sm:px-12 sm:py-16 motion-safe:animate-fade-up">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-honey-300 via-honey-500 to-honey-800"
      aria-hidden="true"
    ></div>
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(70%_80%_at_50%_-10%,#b45309_0%,transparent_60%)] opacity-50"
      aria-hidden="true"
    ></div>
    <div
      class="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(60%_60%_at_50%_50%,#f59e0b_0%,transparent_70%)] opacity-30"
      aria-hidden="true"
    ></div>

    <div class="relative">
      <p class="eyebrow text-honey-400">{t(lang, "about.ctaEyebrow")}</p>
      <h2 class="headline mt-4 text-2xl text-parchment sm:text-3xl">
        {t(lang, "about.ctaTitle")}
      </h2>
      <p class="mx-auto mt-4 max-w-xl text-base leading-relaxed text-cocoa-200">
        {t(lang, "about.ctaBody")}
      </p>
      <Button variant="outline" href="/contact" class="mt-8 inline-flex">
        {t(lang, "about.ctaButton")}
      </Button>
    </div>
  </div>
</section>
