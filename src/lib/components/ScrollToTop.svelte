<script lang="ts">
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang = "ar" }: { lang?: Lang } = $props();

  const prefersReduced = $derived(
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  let visible = $state(false);
  let raf = 0;

  function onScroll() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const y = window.scrollY;
      visible = y > 480;
    });
  }

  $effect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  });

  function goTop() {
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  }
</script>

<button
  data-testid="scroll-to-top"
  type="button"
  aria-label={t(lang, "common.scrollToTop")}
  onclick={goTop}
  class="group fixed bottom-5 end-5 z-40 grid h-12 w-12 place-items-center rounded-full bg-ink-950 text-parchment shadow-warm-lg ring-1 ring-inset ring-cocoa-700 transition-all duration-300 hover:bg-cocoa-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-600 motion-reduce:transition-none {visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}"
>
  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</button>
