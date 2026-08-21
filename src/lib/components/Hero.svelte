<script lang="ts">
  import { AspectRatio } from "bits-ui";
  import { countUp } from "$lib/actions/countup.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { ProductSummary } from "$lib/server/store";
  import Button from "./Button.svelte";

  let {
    lang = "ar",
    featured,
    productCount,
  }: { lang?: Lang; featured: ProductSummary[]; productCount: number } = $props();

  const main = $derived(featured[0]);
  const secondary = $derived(
    featured.find((p) => p.image !== main?.image && p.slug !== main?.slug) ?? featured[1],
  );

  const mainImage = $derived(main?.variants[0]?.image ?? main?.image);
  const secondaryImage = $derived(secondary?.variants[0]?.image ?? secondary?.image);

  const stars = [1, 2, 3, 4, 5];

  const heroIconSources = [
    "/images/hero-assets/2.png",
    "/images/hero-assets/3.png",
    "/images/hero-assets/4.png",
    "/images/hero-assets/5.png",
    "/images/hero-assets/6.png",
    "/images/hero-assets/7.png",
    "/images/hero-assets/8.png",
    "/images/hero-assets/9.png",
    "/images/hero-assets/10.png",
    "/images/hero-assets/11.png",
    "/images/hero-assets/12.png",
    "/images/hero-assets/13.png",
    "/images/hero-assets/14.png",
  ];

  interface DecorativeIcon {
    src: string;
    style: string;
    anim: string;
    align: string;
  }

  function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Seeded deterministic scatter (no Math.random) so server render and client
  // hydration produce the same hero. Icons sit on a 14x10 grid and are kept
  // to the top band only (rows 1-4), so nothing appears below the headline
  // over the subtitle, CTAs and stats. One icon per cell, so nothing overlaps
  // and every icon can reach the edges and corners. Density is biased toward
  // the top corner of the image side (end side) and the middle band (gap
  // between text and image); size and in-cell alignment vary for an organic
  // look. The .hero-decor mask fades them toward the center.
  const decorativeIcons: DecorativeIcon[] = (() => {
    const rand = mulberry32(20260818);
    const out: DecorativeIcon[] = [];
    const pick = () => heroIconSources[Math.floor(rand() * heroIconSources.length)];
    const aligns = [
      "justify-self-start self-start",
      "justify-self-center self-start",
      "justify-self-end self-start",
      "justify-self-start self-center",
      "justify-self-center self-center",
      "justify-self-end self-center",
      "justify-self-start self-end",
      "justify-self-center self-end",
      "justify-self-end self-end",
    ];
    const COLS = 14;
    for (let r = 1; r <= 4; r++) {
      for (let c = 1; c <= COLS; c++) {
        const topCorner = r <= 3 && c >= 11;
        const topNear = r <= 4 && c >= 8;
        const keep = topCorner ? 1 : topNear ? 0.95 : 0.7;
        if (rand() > keep) continue;
        const size = topCorner || topNear ? 40 + rand() * 44 : 28 + rand() * 52;
        out.push({
          src: pick(),
          style:
            `grid-column:${c};grid-row:${r};` +
            `width:${size.toFixed(0)}%;` +
            `animation-delay:${(rand() * 8).toFixed(2)}s`,
          anim: rand() > 0.5 ? "motion-safe:animate-float" : "motion-safe:animate-float-delay",
          align: aligns[Math.floor(rand() * aligns.length)],
        });
      }
    }
    return out;
  })();
</script>

<section class="relative start-1/2 -ms-[50vw] w-screen overflow-x-clip pt-8 pb-12 sm:pt-10 sm:pb-14 lg:pt-14 lg:pb-16">
  <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <div class="absolute -top-40 end-[-8rem] h-[30rem] w-[30rem] rounded-full bg-honey-100/60 blur-3xl"></div>
    <div class="absolute bottom-[-10rem] start-[-8rem] h-[26rem] w-[26rem] rounded-full bg-clay-100/50 blur-3xl"></div>
  </div>

  <div class="hero-decor pointer-events-none absolute inset-0 z-0 mx-auto max-w-7xl" aria-hidden="true">
    {#each decorativeIcons as icon}
      <img src={icon.src} alt="" draggable="false" style={icon.style} class={`aspect-square ${icon.anim} ${icon.align} select-none`} />
    {/each}
  </div>

  <div class="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
    <div class="relative motion-safe:animate-fade-up">
      <div
        data-testid="hero-brand-mobile"
        class="group absolute -top-6 end-0 h-32 w-32 transition-all duration-300 hover:-translate-y-1 motion-safe:animate-float lg:hidden"
        aria-hidden="true"
      >
        <img
          src={lang === "ar" ? "/images/etman-wax-ar.png" : "/images/etman-wax-en.png"}
          alt=""
          draggable="false"
          class="h-full w-full select-none"
        />
      </div>
      <p class="brand-wordmark flex items-center gap-2.5">
        <svg class="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient id="crown-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="var(--color-honey-500)" />
              <stop offset="100%" stop-color="var(--color-honey-700)" />
            </linearGradient>
          </defs>
          <path d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1Z" fill="url(#crown-gradient)" />
        </svg>
        {t(lang, "hero.eyebrow")}
      </p>

      <p class="mt-2 flex items-center gap-3 text-sm tracking-wider text-honey-700">
        <span class="h-px w-6 bg-honey-400"></span>
        {t(lang, "hero.since")}
        <span class="h-px w-6 bg-honey-400"></span>
      </p>

      <h1 class="headline mt-4 text-4xl leading-[1.15] text-cocoa-950 sm:text-6xl lg:mt-5 lg:text-7xl">
        {t(lang, "hero.titleA")}<br />
        <span class="relative inline-block text-honey-700">
          {t(lang, "hero.titleB")}
          <svg
            class="absolute -bottom-3 start-0 h-2.5 w-full text-honey-500"
            viewBox="0 0 200 10"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 8c50-5 130-6 194-2"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
        </span>
      </h1>

      <p class="mt-4 max-w-md text-lg leading-relaxed text-cocoa-500 lg:mt-6">
        {t(lang, "hero.subtitle")}
      </p>

      <div class="mt-6 flex flex-wrap items-center gap-4 lg:mt-8">
        <Button variant="primary" href="/products">
          {t(lang, "hero.ctaShop")}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19 12H5M11 6l-6 6 6 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </Button>
        <Button variant="outline" href="#categories">{t(lang, "hero.ctaDiscover")}</Button>
      </div>

      <dl class="mt-8 grid max-w-lg grid-cols-3 divide-x divide-cocoa-100 lg:mt-12">
        <div class="px-6 first:ps-0 last:pe-0">
          <dt class="flex h-10 items-end text-xs font-semibold text-cocoa-500">{t(lang, "hero.statProducts")}</dt>
          <dd class="headline mt-1 text-3xl text-cocoa-950" use:countUp={{ target: productCount, lang }}>0</dd>
        </div>
        <div class="px-6 first:ps-0 last:pe-0">
          <dt class="flex h-10 items-end text-xs font-semibold text-cocoa-500">{t(lang, "hero.statGovernorates")}</dt>
          <dd class="headline mt-1 text-3xl text-cocoa-950" use:countUp={{ target: 27, lang }}>0</dd>
        </div>
        <div class="px-6 first:ps-0 last:pe-0">
          <dt class="flex h-10 items-end text-xs font-semibold text-cocoa-500">{t(lang, "hero.statCustomers")}</dt>
          <dd class="headline mt-1 text-3xl text-cocoa-950" use:countUp={{ target: 12000, lang }}>0</dd>
        </div>
      </dl>
    </div>

    <div class="relative hidden lg:block motion-safe:animate-fade-up" style="animation-delay: 120ms">
      <div class="hex-texture absolute inset-0 rounded-[2rem] opacity-30" aria-hidden="true"></div>

      <div class="relative mx-auto w-[85%] max-w-md">
        <div
          data-testid="hero-brand"
          class="group absolute -top-10 end-0 z-10 h-36 w-36 transition-all duration-300 hover:-translate-y-1 motion-safe:animate-float lg:h-40 lg:w-40"
          aria-hidden="true"
        >
          <img
            data-testid="hero-brand-img"
            src={lang === "ar" ? "/images/etman-wax-ar.png" : "/images/etman-wax-en.png"}
            alt=""
            draggable="false"
            class="h-full w-full select-none"
          />
        </div>
        <figure class="group relative">
          <div class="absolute inset-0 -z-10 rounded-full bg-honey-100/70 blur-2xl" aria-hidden="true"></div>
          <div class="relative overflow-hidden rounded-t-full rounded-b-[1.5rem] border border-honey-200 bg-parchment shadow-warm-lg">
            {#if mainImage}
              <AspectRatio.Root ratio={4 / 5} class="transition-transform duration-700 ease-out group-hover:scale-105">
                <img
                  src={mainImage}
                  alt={main?.name ?? t(lang, "hero.imgAlt")}
                  class="h-full w-full object-cover"
                />
              </AspectRatio.Root>
            {/if}
            <div
              class="pointer-events-none absolute inset-3 rounded-t-full rounded-b-[1.2rem] ring-1 ring-inset ring-parchment/70"
              aria-hidden="true"
            ></div>
          </div>
        </figure>

        {#if secondary}
          <figure class="absolute -bottom-4 -end-10 w-56 overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment shadow-warm motion-safe:animate-float">
            {#if secondaryImage}
              <AspectRatio.Root ratio={1}>
                <img src={secondaryImage} alt={secondary.name} class="h-full w-full object-cover" />
              </AspectRatio.Root>
            {/if}
          </figure>
        {/if}

        <div class="absolute -top-6 -start-8 rounded-2xl border border-cocoa-100 bg-parchment px-4 py-3 shadow-warm motion-safe:animate-float-delay">
<div class="flex items-center gap-1 text-honey-600" role="img" aria-label={t(lang, "hero.ratingAria")}>
            {#each stars as _}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.3 6.1 20.1l1.2-6.6L2.5 8.9 9.1 8z" />
              </svg>
            {/each}
          </div>
          <p class="mt-1 text-sm font-bold text-cocoa-900">{t(lang, "hero.rating")}</p>
        </div>

        <div class="absolute -bottom-5 start-0 flex items-center gap-2 rounded-full border border-honey-200 bg-honey-50 px-4 py-2 shadow-warm-sm motion-safe:animate-float">
          <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-honey-600 text-parchment" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="m5 13 4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <span class="text-xs font-bold text-honey-800">{t(lang, "hero.badge")}</span>
        </div>
      </div>
    </div>

    <div class="relative mx-auto mt-8 w-full max-w-[16rem] motion-safe:animate-fade-up lg:hidden" style="animation-delay: 120ms">
      <div class="absolute inset-0 -z-10 rounded-full bg-honey-100/60 blur-2xl" aria-hidden="true"></div>
      <figure class="relative overflow-hidden rounded-t-full rounded-b-2xl border border-honey-200 bg-parchment shadow-warm-lg">
        <div class="relative">
          {#if mainImage}
            <AspectRatio.Root ratio={4 / 5}>
              <img
                src={mainImage}
                alt={main?.name ?? t(lang, "hero.imgAlt")}
                class="h-full w-full object-cover"
              />
            </AspectRatio.Root>
          {/if}
          <div class="pointer-events-none absolute inset-3 rounded-t-full rounded-b-2xl ring-1 ring-inset ring-parchment/70" aria-hidden="true"></div>
        </div>
      </figure>
    </div>
  </div>
</section>
