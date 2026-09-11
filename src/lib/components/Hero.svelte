<script lang="ts">
  import { AspectRatio } from "bits-ui";
  import { countUp } from "$lib/actions/countup.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import Button from "./Button.svelte";

  let { lang = "ar", productCount }: { lang?: Lang; productCount: number } = $props();

  const mainImage = "/images/Beeking Etman/برطمان السدر المصرى.jpg";
  const seal = $derived(lang === "en" ? "/images/etman-wax-en.png" : "/images/etman-wax-ar.png");
</script>

<section
  class="relative start-1/2 -ms-[50vw] w-screen overflow-x-clip border-b border-honey-100 bg-gradient-to-b from-paper via-paper to-cream pt-12 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24"
>
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div class="honeycomb absolute inset-0 opacity-60"></div>
    <div class="absolute -top-40 end-[-8rem] h-[30rem] w-[30rem] rounded-full bg-honey-200/40 blur-3xl"></div>
    <div class="absolute bottom-[-10rem] start-[-8rem] h-[24rem] w-[24rem] rounded-full bg-clay-100/40 blur-3xl"></div>
  </div>

  <div class="hero-grid relative mx-auto max-w-7xl px-4 lg:px-6">
    <div class="grid-area-text max-w-2xl motion-safe:animate-fade-up">
      <div class="flex items-center gap-3">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 8l4-3 5 3 5-3 4 3-1 3H4z" fill="var(--color-honey-500)" />
          <path d="M4 14h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" fill="var(--color-honey-700)" />
        </svg>
        <p class="eyebrow">{t(lang, "hero.eyebrow")}</p>
      </div>

      <p class="mt-4 flex items-center gap-3 text-sm font-semibold text-cocoa-500">
        <span class="rule-gold h-px w-10"></span>
        {t(lang, "hero.since")}
      </p>

      <h1 class="headline mt-5 text-4xl leading-[1.15] text-cocoa-900 sm:text-5xl lg:text-6xl">
        {t(lang, "hero.titleA")}
        <br />
        <span class="relative inline-block text-honey-700">
          {t(lang, "hero.titleB")}
          <svg
            class="absolute -bottom-2 start-0 w-full"
            height="10"
            viewBox="0 0 200 10"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M2 7c40-5 158-5 196 0" stroke="var(--color-honey-400)" stroke-width="3" stroke-linecap="round" fill="none" />
          </svg>
        </span>
      </h1>

      <p class="mt-6 max-w-xl text-base leading-relaxed text-cocoa-600 sm:text-lg">
        {t(lang, "hero.subtitle")}
      </p>

      <div class="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="primary" href="/products" class="px-6 py-3">
          {t(lang, "hero.ctaShop")}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </Button>
        <Button variant="outline" href="#categories" class="px-6 py-3">{t(lang, "hero.ctaDiscover")}</Button>
      </div>
    </div>

    <div class="grid-area-image relative mx-auto mt-10 w-full max-w-sm motion-safe:animate-fade-up sm:max-w-md lg:mt-0">
      <div data-testid="hero-brand" class="absolute -top-10 end-2 z-10 hidden h-36 w-36 lg:block" aria-hidden="true">
        <img
          data-testid="hero-brand-img"
          src={seal}
          alt={t(lang, "brand.tagline")}
          class="seal h-full w-full select-none"
        />
      </div>

      <div class="relative">
        <div class="absolute inset-4 -z-10 rounded-full bg-honey-200/50 blur-2xl"></div>
        <div class="overflow-hidden rounded-t-full rounded-b-3xl border border-honey-200 bg-parchment p-3 shadow-warm-lg">
          <AspectRatio.Root ratio={4 / 5} class="overflow-hidden rounded-t-full rounded-b-2xl">
            <img src={mainImage} alt={t(lang, "hero.sidrAlt")} class="h-full w-full object-cover" />
          </AspectRatio.Root>
        </div>

        <div data-testid="hero-brand-inline" class="absolute -top-6 end-1 z-10 h-24 w-24 lg:hidden" aria-hidden="true">
          <img
            data-testid="hero-brand-img-inline"
            src={seal}
            alt={t(lang, "brand.tagline")}
            class="seal h-full w-full select-none"
          />
        </div>
      </div>
    </div>

    <dl class="grid-area-stats mt-12 grid grid-cols-3 gap-4 border-t border-honey-100 pt-8 sm:gap-8">
      <div>
        <dd class="headline text-3xl text-honey-700 sm:text-4xl" use:countUp={{ target: productCount, lang }}></dd>
        <dt class="mt-1 text-xs font-semibold text-cocoa-500 sm:text-sm">{t(lang, "hero.statProducts")}</dt>
      </div>
      <div>
        <dd class="headline text-3xl text-honey-700 sm:text-4xl" use:countUp={{ target: 27, lang }}></dd>
        <dt class="mt-1 text-xs font-semibold text-cocoa-500 sm:text-sm">{t(lang, "hero.statGovernorates")}</dt>
      </div>
      <div>
        <dd class="headline text-3xl text-honey-700 sm:text-4xl" use:countUp={{ target: 12000, lang }}></dd>
        <dt class="mt-1 text-xs font-semibold text-cocoa-500 sm:text-sm">{t(lang, "hero.statCustomers")}</dt>
      </div>
    </dl>
  </div>
</section>
