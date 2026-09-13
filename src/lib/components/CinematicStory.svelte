<script lang="ts">
  import { t, type Lang } from "$lib/i18n/messages";
  import Button from "./Button.svelte";

  let { lang = "ar" }: { lang?: Lang } = $props();

  const chapters = $derived([
    { key: 1, aria: t(lang, "story.ch.1.title") },
    { key: 2, aria: t(lang, "story.ch.2.title") },
    { key: 3, aria: t(lang, "story.ch.3.title") },
    { key: 4, aria: t(lang, "story.ch.4.title") },
  ]);

  const image = "/images/Beeking Etman/برطمان السدر المصرى.jpg";

  let sectionEl = $state<HTMLElement>();
  let povEl = $state<HTMLElement>();
  let imgEl = $state<HTMLImageElement>();
  let progress = $state(0);

  let reduced = $state(false);

  let visible = false;

  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (reduced = mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else if (mq.addListener) mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else if (mq.removeListener) mq.removeListener(update);
    };
  });

  $effect(() => {
    const section = sectionEl;
    const pov = povEl;
    if (!section || !pov) return;

    if (reduced) return;

    let syncFrame = 0;

    const sync = () => {
      syncFrame = 0;
      const sectionRect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      visible = sectionRect.bottom > 0 && sectionRect.top < vh;
      if (!visible) {
        // Off-screen: snap to the nearest edge so the pinned frame never
        // lingers on a stale scrub value as the next section takes over.
        progress = sectionRect.top < 0 ? 1 : 0;
        return;
      }
      // Progress through the tall section: how far its top has travelled
      // above the viewport, normalised by the section's scrollable run.
      const run = sectionRect.height - vh;
      progress = run > 0 ? clamp(-sectionRect.top / run, 0, 1) : 0;
    };

    const schedule = () => {
      if (syncFrame) return;
      syncFrame = requestAnimationFrame(sync);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    sync();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (syncFrame) cancelAnimationFrame(syncFrame);
    };
  });

  function mix(from: number, to: number, p: number): number {
    return from + (to - from) * p;
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  // Per-chapter fade window: chapter i (0-based) is centred on its segment.
  function chapterState(i: number, p: number): { opacity: number; y: number } {
    const n = chapters.length;
    const seg = 1 / n;
    const enter = i * seg;
    const center = enter + seg / 2;
    const exit = (i + 1) * seg;
    let opacity = 0;
    if (p >= enter && p <= exit) {
      const rise = 0.34 * seg;
      const fadeIn = Math.min(1, (p - enter) / rise);
      const fadeOut = Math.min(1, (exit - p) / (rise * 1.25));
      opacity = Math.min(fadeIn, fadeOut);
    }
    const y = mix(16, -12, opacity);
    return { opacity, y };
  }

  const bgScale = $derived(1 + progress * 0.55);
  const bgRotate = $derived((progress - 0.5) * 5);
  const bgY = $derived(mix(0, -6, progress));
  const barWidth = $derived(`${(progress * 100).toFixed(2)}%`);
</script>

{#if !reduced}
  <section bind:this={sectionEl} class="relative h-[400vh]" aria-label={t(lang, "story.eyebrow")}>
    <div bind:this={povEl} class="sticky top-0 h-screen w-full overflow-hidden bg-ink-950">
      <!-- Full-bleed scrubbed image -->
      <img
        bind:this={imgEl}
        src={image}
        alt=""
        loading="lazy"
        draggable="false"
        class="absolute inset-0 h-full w-full object-cover will-change-transform"
        style="transform: translateY({bgY}%) scale({bgScale}); rotate: {bgRotate}deg;"
      />

      <!-- Warm dark veil for text legibility -->
      <div class="absolute inset-0 bg-gradient-to-b from-ink-950/80 via-ink-950/35 to-ink-900/85" aria-hidden="true"></div>
      <div class="absolute inset-0 paper-grain opacity-40 mix-blend-soft-light" aria-hidden="true"></div>

      <!-- Eyebrow pinned top -->
      <div class="absolute top-8 start-0 end-0 z-10 flex justify-center px-6 sm:top-10">
        <p class="eyebrow flex items-center gap-3 text-parchment">
          <span class="h-px w-8 bg-honey-300/70" aria-hidden="true"></span>
          <span class="tracking-[0.3em]">{t(lang, "story.eyebrow")}</span>
          <span class="h-px w-8 bg-honey-300/70" aria-hidden="true"></span>
        </p>
      </div>

      <!-- Chapters -->
      <div class="relative z-10 flex h-full items-center justify-center">
        {#each chapters as ch, i (ch.key)}
          {@const state = chapterState(i, progress)}
          <article
            aria-hidden={state.opacity < 0.5 ? "true" : undefined}
            class="absolute mx-auto max-w-2xl px-6 text-center will-change-transform"
            style="opacity: {state.opacity}; transform: translateY({state.y}px);"
          >
            <p class="font-display text-xs font-semibold text-honey-300" style="letter-spacing:0.4em">
              {t(lang, `story.ch.${ch.key}.num`)}
            </p>
            <h2 class="headline mt-3 text-3xl text-parchment sm:text-4xl lg:text-5xl">
              {t(lang, `story.ch.${ch.key}.title`)}
            </h2>
            <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-parchment/80 sm:text-base lg:text-lg">
              {t(lang, `story.ch.${ch.key}.body`)}
            </p>
          </article>
        {/each}
      </div>

      <!-- Bottom CTA -->
      <div
        class="absolute bottom-10 start-0 end-0 z-10 flex flex-col items-center gap-3 px-6 sm:bottom-12"
        style="opacity: {progress};"
      >
        <p class="text-xs tracking-[0.25em] text-parchment/70">{t(lang, "story.eyebrow")}</p>
        <Button variant="primary" href="/products" class="text-sm">
          {t(lang, "story.cta")}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </Button>
      </div>

      <!-- Progress rail -->
      <div class="absolute inset-x-0 bottom-0 h-1 bg-parchment/15" aria-hidden="true">
        <div class="h-full bg-gradient-to-r from-honey-600 to-honey-300" style="width: {barWidth};"></div>
      </div>
    </div>
  </section>
{:else}
  <section class="paper-panel mx-auto max-w-4xl px-6 py-14 sm:px-10" aria-label={t(lang, "story.eyebrow")}>
    <div class="text-center">
      <p class="eyebrow flex items-center justify-center gap-3">
        <span class="h-px w-8 bg-honey-400" aria-hidden="true"></span>
        {t(lang, "story.eyebrow")}
        <span class="h-px w-8 bg-honey-400" aria-hidden="true"></span>
      </p>
    </div>
    <div class="mt-10 space-y-8">
      {#each chapters as ch, i (ch.key)}
        <div class="flex flex-col gap-3 border-t border-cocoa-100 pt-6 sm:flex-row sm:items-baseline sm:gap-6">
          <p class="font-display text-sm font-bold text-honey-600">{t(lang, `story.ch.${ch.key}.num`)}</p>
          <div>
            <h2 class="headline text-2xl text-cocoa-900">{t(lang, `story.ch.${ch.key}.title`)}</h2>
            <p class="mt-2 text-sm leading-relaxed text-cocoa-500">{t(lang, `story.ch.${ch.key}.body`)}</p>
          </div>
        </div>
      {/each}
    </div>
    <div class="mt-10 text-center">
      <Button variant="primary" href="/products" class="text-sm">{t(lang, "story.cta")}</Button>
    </div>
  </section>
{/if}
