<script lang="ts">
  import { AspectRatio } from "bits-ui";
  import { countUp } from "$lib/actions/countup.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import Button from "./Button.svelte";

  let {
    lang = "ar",
    productCount,
  }: { lang?: Lang; productCount: number } = $props();

  const mainImage = "/images/Beeking Etman/برطمان السدر المصرى.jpg";
  const foundationWaxImage = "/images/Beeking Etman/شمع اساس.jpg";
</script>

<section class="relative start-1/2 -ms-[50vw] w-screen overflow-x-clip pt-8 pb-12 sm:pt-10 sm:pb-14 lg:pt-14 lg:pb-16">
  <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <div class="absolute -top-40 end-[-8rem] h-[30rem] w-[30rem] rounded-full bg-honey-100/60 blur-3xl"></div>
    <div class="absolute bottom-[-10rem] start-[-8rem] h-[26rem] w-[26rem] rounded-full bg-clay-100/50 blur-3xl"></div>
  </div>

  <div class="hero-grid mx-auto w-full max-w-7xl gap-x-8 gap-y-8 px-4 sm:gap-x-10 sm:gap-y-10 sm:px-6 lg:gap-x-14 lg:gap-y-9 lg:px-8">
    <div class="relative grid-area-text motion-safe:animate-fade-up">
      <div
        data-testid="hero-brand-inline"
        class="pointer-events-none absolute -top-2 end-0 z-10 h-28 w-28 sm:h-36 sm:w-36 lg:hidden"
        aria-hidden="true"
      >
        <img
          data-testid="hero-brand-img-inline"
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
              <stop offset="0%" stop-color="var(--color-amber-400)" />
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

      <h1 class="headline mt-4 text-4xl leading-[1.15] text-cocoa-950 sm:text-5xl lg:mt-5 lg:text-7xl">
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
            <path d="M3 8c50-5 130-6 194-2" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
        </span>
      </h1>

      <p class="mt-4 max-w-md text-base leading-relaxed text-cocoa-500 sm:text-lg lg:mt-6">
        {t(lang, "hero.subtitle")}
      </p>

      <div class="mt-6 flex flex-wrap items-center gap-3 sm:gap-4 lg:mt-8">
        <Button variant="primary" href="/products">
          {t(lang, "hero.ctaShop")}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </Button>
        <Button variant="outline" href="#categories">{t(lang, "hero.ctaDiscover")}</Button>
      </div>
    </div>

    <div
      class="relative mx-auto mt-2 w-full max-w-sm grid-area-image motion-safe:animate-fade-up sm:max-w-md lg:mt-0"
      style="animation-delay: 120ms"
    >
      <div class="hex-texture absolute inset-0 rounded-[2rem] opacity-30" aria-hidden="true"></div>

      <div
        data-testid="hero-brand"
        class="absolute -top-9 end-0 z-10 hidden h-36 w-36 lg:block"
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

      <figure class="relative">
        <div class="absolute inset-0 -z-10 rounded-full bg-honey-100/70 blur-2xl" aria-hidden="true"></div>
        <div class="relative overflow-hidden rounded-t-full rounded-b-2xl border border-honey-200 bg-parchment shadow-warm-lg lg:rounded-b-[1.5rem]">
          <AspectRatio.Root ratio={4 / 5} class="transition-transform duration-700 ease-out group-hover:scale-105">
            <img src={mainImage} alt={t(lang, "hero.sidrAlt")} class="h-full w-full object-cover" />
          </AspectRatio.Root>
          <div
            class="pointer-events-none absolute inset-3 rounded-t-full rounded-b-2xl ring-1 ring-inset ring-parchment/70 lg:rounded-b-[1.2rem]"
            aria-hidden="true"
          ></div>
        </div>

        <div
          class="absolute -bottom-6 start-1/2 z-10 w-60 -translate-x-1/2 motion-safe:animate-fade-up sm:w-72"
          style="animation-delay: 240ms"
          data-testid="hero-foundation-wax"
        >
          <div class="relative overflow-hidden rounded-2xl border border-honey-200/70 bg-parchment shadow-warm">
            <img
              src={foundationWaxImage}
              alt={t(lang, "hero.foundationWax")}
              draggable="false"
              class="aspect-[4/3] w-full object-cover"
            />
            <div
              class="pointer-events-none absolute inset-0 bg-gradient-to-t from-cocoa-950/60 via-transparent to-transparent"
              aria-hidden="true"
            ></div>
            <figcaption class="absolute bottom-2.5 start-3 flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-parchment/95 px-3 py-1 text-[11px] font-semibold text-cocoa-900 shadow-sm">
                <svg class="h-3 w-3 text-honey-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 9l3.5 2.5L14 15l-2 3-2-3-1.5-3.5L12 9ZM4 8l3 2-1 3L4 15l-1-2 1-5Zm16 0 1 5-1 2-2-2-1-3 3-2Z" />
                </svg>
                {t(lang, "hero.foundationWax")}
              </span>
              <span class="hidden text-[11px] font-medium text-parchment/90 sm:inline">{t(lang, "hero.foundationTagline")}</span>
            </figcaption>
          </div>
        </div>
      </figure>
    </div>

    <dl
      class="mt-2 grid max-w-lg grid-cols-3 gap-4 grid-area-stats motion-safe:animate-fade-up sm:gap-6"
      style="animation-delay: 240ms"
    >
      <div>
        <dt class="text-xs font-semibold text-cocoa-500">{t(lang, "hero.statProducts")}</dt>
        <dd class="headline mt-1 text-2xl text-cocoa-950 sm:text-3xl" use:countUp={{ target: productCount, lang }}>0</dd>
      </div>
      <div>
        <dt class="text-xs font-semibold text-cocoa-500">{t(lang, "hero.statGovernorates")}</dt>
        <dd class="headline mt-1 text-2xl text-cocoa-950 sm:text-3xl" use:countUp={{ target: 27, lang }}>0</dd>
      </div>
      <div>
        <dt class="text-xs font-semibold text-cocoa-500">{t(lang, "hero.statCustomers")}</dt>
        <dd class="headline mt-1 text-2xl text-cocoa-950 sm:text-3xl" use:countUp={{ target: 12000, lang }}>0</dd>
      </div>
    </dl>
  </div>
</section>
