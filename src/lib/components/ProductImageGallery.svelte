<script lang="ts">
  import { AspectRatio } from "bits-ui";
  import { t, type Lang } from "$lib/i18n/messages";

  let {
    images,
    productName,
    lang,
    viewTransitionName,
    activeKey,
  }: {
    images: string[];
    productName: string;
    lang: Lang;
    viewTransitionName: string;
    activeKey: string;
  } = $props();

  let activeIndex = $state(0);
  let lightboxOpen = $state(false);

  // Switching variant (or arriving on a new product) shows that variant's image first.
  $effect(() => {
    if (activeKey) activeIndex = 0;
  });

  // Lock page scroll while the lightbox is open.
  $effect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  });

  // Lightbox keyboard navigation (arrow direction follows the reading order).
  $effect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") lightboxOpen = false;
      const forward = lang === "ar" ? "ArrowLeft" : "ArrowRight";
      if (e.key === forward) goNext();
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function goNext() {
    activeIndex = (activeIndex + 1) % images.length;
  }

  function goPrev() {
    activeIndex = (activeIndex - 1 + images.length) % images.length;
  }

  // Swipe navigation. A completed swipe sets `swipeMoved` so the following
  // click (fired after pointerup) doesn't open the lightbox.
  let swipeStartX: number | null = null;
  let swipeMoved = false;

  function onSwipeStart(e: PointerEvent) {
    swipeMoved = false;
    swipeStartX = e.clientX;
  }

  function onSwipeMove(e: PointerEvent) {
    if (swipeStartX === null) return;
    if (Math.abs(e.clientX - swipeStartX) > 30) swipeMoved = true;
  }

  function onSwipeEnd(e: PointerEvent) {
    if (swipeStartX === null) return;
    const delta = e.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(delta) < 50) return;
    swipeMoved = true;
    if ((lang === "ar" && delta > 0) || (lang === "en" && delta < 0)) goNext();
    else goPrev();
  }

  function onGalleryClick() {
    if (swipeMoved) {
      swipeMoved = false;
      return;
    }
    lightboxOpen = true;
  }

  function onGalleryKeydown(e: KeyboardEvent) {
    // While the lightbox is open the window handler owns the arrow keys.
    if (lightboxOpen) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      lightboxOpen = true;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const forward = lang === "ar" ? "ArrowLeft" : "ArrowRight";
      if (e.key === forward) goNext();
      else goPrev();
    }
  }
</script>

{#if images.length > 0}
  <figure class="relative">
    <div class="absolute -inset-3 rounded-3xl border border-cocoa-200/70" aria-hidden="true"></div>

    <div
      class="relative overflow-hidden rounded-2xl bg-cocoa-100"
      onclick={onGalleryClick}
      onpointerdown={onSwipeStart}
      onpointermove={onSwipeMove}
      onpointerup={onSwipeEnd}
      onpointercancel={onSwipeEnd}
      role="button"
      tabindex="0"
      aria-label={t(lang, "gallery.expandAria")}
      onkeydown={onGalleryKeydown}
    >
      <AspectRatio.Root ratio={1} class="overflow-hidden">
        {#key `${images[activeIndex]}-${activeKey}`}
          <div class="gallery-fade h-full w-full">
            <img
              src={images[activeIndex]}
              alt={productName}
              style="view-transition-name: {viewTransitionName}; view-transition-class: product-img;"
              class="h-full w-full object-cover"
            />
          </div>
        {/key}
      </AspectRatio.Root>

      {#if images.length > 1}
        <span class="absolute bottom-3 end-3 rounded-full bg-ink-950/70 px-3 py-1 text-xs font-semibold text-parchment backdrop-blur-sm">
          {t(lang, "gallery.counter", { current: activeIndex + 1, total: images.length })}
        </span>
      {/if}
    </div>

    {#if images.length > 1}
      <div
        class="mt-3 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label={t(lang, "gallery.thumbnailsAria")}
      >
        {#each images as image, index (image)}
          <button
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={t(lang, "gallery.thumbnailAria", { name: productName, index: index + 1 })}
            class="w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-cocoa-100 transition-all duration-200 {index === activeIndex
              ? 'border-honey-600 ring-2 ring-honey-600/25'
              : 'border-cocoa-200 opacity-75 hover:border-cocoa-400 hover:opacity-100'}"
            onclick={() => (activeIndex = index)}
          >
            <AspectRatio.Root ratio={1}>
              <img src={image} alt="" loading="lazy" class="h-full w-full object-cover" />
            </AspectRatio.Root>
          </button>
        {/each}
      </div>
    {/if}
  </figure>

  {#if lightboxOpen}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/95 backdrop-blur-sm motion-safe:animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, "gallery.lightboxAria")}
      tabindex="-1"
      onclick={(e) => {
        if (e.target === e.currentTarget) lightboxOpen = false;
      }}
      onkeydown={(e) => {
        if (e.key === "Escape") lightboxOpen = false;
      }}
      onpointerdown={onSwipeStart}
      onpointermove={onSwipeMove}
      onpointerup={onSwipeEnd}
      onpointercancel={onSwipeEnd}
    >
      <button
        type="button"
        class="absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-parchment/10 text-parchment transition-colors duration-200 hover:bg-parchment/20"
        aria-label={t(lang, "gallery.close")}
        onclick={() => (lightboxOpen = false)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      {#if images.length > 1}
        <button
          type="button"
          class="absolute start-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-parchment/10 text-parchment transition-colors duration-200 hover:bg-parchment/20"
          aria-label={t(lang, "gallery.prev")}
          onclick={goPrev}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="rtl:rotate-180">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          class="absolute end-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-parchment/10 text-parchment transition-colors duration-200 hover:bg-parchment/20"
          aria-label={t(lang, "gallery.next")}
          onclick={goNext}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="rtl:rotate-180">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      {/if}

      <figure class="px-4">
        <div class="overflow-hidden rounded-2xl bg-parchment/5">
          <img
            src={images[activeIndex]}
            alt={productName}
            class="max-h-[82vh] w-auto max-w-full object-contain motion-safe:animate-fade-in"
          />
        </div>
        {#if images.length > 1}
          <figcaption class="mt-3 text-center text-sm font-semibold text-parchment/80">
            {t(lang, "gallery.counter", { current: activeIndex + 1, total: images.length })}
          </figcaption>
        {/if}
      </figure>
    </div>
  {/if}
{/if}

<style>
  .gallery-fade {
    animation: gallery-fade 0.35s ease both;
  }

  @keyframes gallery-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gallery-fade {
      animation: none;
    }
  }
</style>