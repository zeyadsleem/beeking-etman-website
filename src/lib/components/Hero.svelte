<script lang="ts">
  import { AspectRatio } from "bits-ui";
  import { countUp } from "$lib/actions/countup.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { ProductSummary } from "$lib/server/store";
  import Button from "./Button.svelte";
  import Price from "./Price.svelte";

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
</script>

<section class="relative overflow-x-clip pt-10 pb-16 lg:pt-14">
  <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <div class="absolute -top-40 end-[-8rem] h-[30rem] w-[30rem] rounded-full bg-honey-100/60 blur-3xl"></div>
    <div class="absolute bottom-[-10rem] start-[-8rem] h-[26rem] w-[26rem] rounded-full bg-clay-100/50 blur-3xl"></div>
  </div>

  <div class="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
    <div class="motion-safe:animate-fade-up">
      <p class="eyebrow flex items-center gap-2.5">
        <span class="inline-block h-px w-8 bg-honey-600/60" aria-hidden="true"></span>
        {t(lang, "hero.eyebrow")}
      </p>

      <h1 class="headline mt-5 text-5xl leading-[1.15] text-cocoa-950 sm:text-6xl lg:text-7xl">
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

      <p class="mt-6 max-w-md text-lg leading-relaxed text-cocoa-500">
        {t(lang, "hero.subtitle")}
      </p>

      <div class="mt-8 flex flex-wrap items-center gap-4">
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

      <dl class="mt-12 grid max-w-lg grid-cols-3 divide-x divide-cocoa-100">
        <div class="px-6 first:ps-0 last:pe-0">
          <dt class="text-xs font-semibold text-cocoa-500">{t(lang, "hero.statProducts")}</dt>
          <dd class="headline mt-1 text-3xl text-cocoa-950" use:countUp={productCount}>0</dd>
        </div>
        <div class="px-6 first:ps-0 last:pe-0">
          <dt class="text-xs font-semibold text-cocoa-500">{t(lang, "hero.statGovernorates")}</dt>
          <dd class="headline mt-1 text-3xl text-cocoa-950" use:countUp={27}>0</dd>
        </div>
        <div class="px-6 first:ps-0 last:pe-0">
          <dt class="text-xs font-semibold text-cocoa-500">{t(lang, "hero.statCustomers")}</dt>
          <dd class="headline mt-1 text-3xl text-cocoa-950" use:countUp={12000}>0</dd>
        </div>
      </dl>
    </div>

    <div class="relative hidden lg:block motion-safe:animate-fade-up" style="animation-delay: 120ms">
      <div class="hex-texture absolute inset-0 rounded-[2rem] opacity-30" aria-hidden="true"></div>

      <div
        class="absolute -top-4 end-0 grid h-36 w-36 place-items-center text-honey-700 motion-safe:animate-spin-slow"
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full">
          <defs>
            <path id="hero-circle" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
          </defs>
          <text class="fill-current text-[10px] font-bold tracking-[2.5px]">
            <textPath href="#hero-circle">{t(lang, "hero.textPath")}</textPath>
          </text>
        </svg>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 3 20 8v8l-8 5-8-5V8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M12 9c1.8 2 3 3.5 3 5a3 3 0 1 1-6 0c0-1.5 1.2-3 3-5Z" fill="currentColor" opacity="0.85" />
        </svg>
      </div>

      <div class="relative mx-auto mt-20 w-[70%] max-w-sm">
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
          <figcaption class="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-xl border border-cocoa-100 bg-parchment/95 px-4 py-3 shadow-warm-sm backdrop-blur">
            <span class="truncate text-sm font-semibold text-cocoa-900">{main?.name}</span>
            <Price amount={main?.minPrice ?? 0} className="headline shrink-0 text-lg text-honey-700" />
          </figcaption>
        </figure>

        {#if secondary}
          <figure class="absolute -bottom-4 -end-10 w-44 overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment shadow-warm motion-safe:animate-float">
            {#if secondaryImage}
              <AspectRatio.Root ratio={1}>
                <img src={secondaryImage} alt={secondary.name} class="h-full w-full object-cover" />
              </AspectRatio.Root>
            {/if}
            <figcaption class="px-3 py-2">
              <p class="truncate text-xs font-semibold text-cocoa-900">{secondary.name}</p>
              <Price amount={secondary.minPrice} className="text-xs font-bold text-honey-700" />
            </figcaption>
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

    <div class="relative mx-auto mt-14 max-w-xs motion-safe:animate-fade-up lg:hidden" style="animation-delay: 120ms">
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
        <figcaption class="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-xl border border-cocoa-100 bg-parchment/95 px-4 py-3 shadow-warm-sm backdrop-blur">
          <span class="truncate text-sm font-semibold text-cocoa-900">{main?.name}</span>
          <Price amount={main?.minPrice ?? 0} className="headline shrink-0 text-lg text-honey-700" />
        </figcaption>
      </figure>

      <div class="absolute top-4 -start-2 rounded-2xl border border-cocoa-100 bg-parchment px-3.5 py-2.5 shadow-warm motion-safe:animate-float">
        <div class="flex items-center gap-1 text-honey-600" role="img" aria-label={t(lang, "hero.ratingAria")}>
          {#each stars as _}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.3 6.1 20.1l1.2-6.6L2.5 8.9 9.1 8z" />
            </svg>
          {/each}
        </div>
        <p class="mt-0.5 text-xs font-bold text-cocoa-900">{t(lang, "hero.rating")}</p>
      </div>
    </div>
  </div>
</section>
