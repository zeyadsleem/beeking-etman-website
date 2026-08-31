<script lang="ts">
  import { t } from "$lib/i18n/messages";
  import { sfx, prefersReducedMotion } from "./fx-utils";

  let {
    lang,
    color,
    fillPercent,
    onProgress,
    progress,
  }: {
    lang: "ar" | "en";
    color: string;
    fillPercent: number;
    onProgress: (amount: number) => void;
    progress: number;
  } = $props();

  // --- circular stir gesture ---
  let zone = $state<HTMLElement | null>(null);
  let sweeping = $state(false);
  let lastAngle = $state(0);
  let swept = $state(0);
  let tick = $state(0);
  let doneFired = $state(false);
  let muted = $state(sfx.muted);
  let lastBlipAt = 0;
  let combo = $state(0);
  let lastStirAt = 0;

  // A full stir requires this many radians of circular sweep (~3 full turns).
  const FULL_SWEEP = 6 * Math.PI;

  const anim = $derived(!prefersReducedMotion());

  function angleAt(e: PointerEvent): number {
    const rect = zone?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }

  function onDown(e: PointerEvent): void {
    sweeping = true;
    lastAngle = angleAt(e);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture can fail for synthesized events; the gesture still
      // works because moves continue targeting this element.
    }
  }

  function onMove(e: PointerEvent): void {
    if (!sweeping) return;
    const a = angleAt(e);
    let delta = a - lastAngle;
    // Normalize to the shortest arc so we don't overshoot on wrap-around.
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    lastAngle = a;
    if (delta > 0) {
      swept += delta;
      onProgress(delta / FULL_SWEEP);
      // Juice: a little pulse + a rising plink with each meaningful push,
      // throttled so a fast swirl doesn't turn into a machine gun.
      tick++;
      combo++;
      lastStirAt = performance.now();
      const now = performance.now();
      if (now - lastBlipAt > 90) {
        lastBlipAt = now;
        sfx.stir(progress);
      }
    }
  }

  function onUp(): void {
    sweeping = false;
    swept = 0;
  }

  const percent = $derived(Math.round(progress * 100));
  const done = $derived(progress >= 1);

  // Fire the completion chime exactly once.
  $effect(() => {
    if (done && !doneFired) {
      doneFired = true;
      sfx.done();
    } else if (!done) {
      doneFired = false;
    }
  });

  // A steady-stir streak resets to zero after a pause, creating tension.
  $effect(() => {
    if (combo === 0) return;
    const id = setTimeout(() => {
      if (performance.now() - lastStirAt >= 1600) combo = 0;
    }, 1600);
    return () => clearTimeout(id);
  });
</script>

<div class="flex flex-col items-center gap-5">
  <div
    bind:this={zone}
    role="group"
    aria-label={t(lang, "blends.game.stir.title")}
    class="relative grid h-56 w-56 touch-none select-none place-items-center rounded-full border-2 border-dashed border-honey-500/50"
    class:scale-105={sweeping}
    class:border-solid={done}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    data-testid="mix-stir-zone"
  >
    <!-- squash & stretch jar; the keyed overlay replays the pulse per stir tick -->
    <div
      class="relative grid h-40 w-40 place-items-center overflow-hidden rounded-full bg-paper-deep ring-1 ring-cocoa-200"
      aria-hidden="true"
    >
      <!-- liquid fill, mixed colour rising with progress -->
      <div
        class="absolute inset-x-2 bottom-2 rounded-full opacity-90 transition-[height] duration-200"
        style={`height:${fillPercent + progress * (92 - fillPercent)}%;background:${color}`}
      ></div>
      <div class="relative z-10 text-5xl">🍯</div>
      {#if done}
        <span class="absolute inset-0 z-0 animate-pop overflow-hidden rounded-full ring-2 ring-honey-500/70"></span>
      {:else if anim && tick > 0}
        {#key tick}
          <span class="mix-stir-pulse pointer-events-none absolute inset-0 rounded-full ring-[3px] ring-honey-500/40"></span>
        {/key}
      {/if}
    </div>

    {#if done}
      <span
        class="absolute -bottom-2 animate-pop rounded-full bg-honey-500 px-3 py-1 text-sm font-bold text-cocoa-950"
        data-testid="mix-done"
      >
        {t(lang, "blends.game.stir.done")}
      </span>
    {/if}
  </div>

  <div class="flex flex-col items-center gap-2 text-center">
    <p class="font-bold text-cocoa-900">{t(lang, "blends.game.stir.title")}</p>
    <p class="max-w-xs text-sm text-cocoa-600">{t(lang, "blends.mix.instruction")}</p>
    <div class="h-2 w-48 overflow-hidden rounded-full bg-cocoa-200" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent} aria-label={t(lang, "blends.mix.percent", { p: percent })}>
      <div
        class="h-full rounded-full transition-[width] duration-200"
        style={`width:${percent}%;background:${color}`}
      ></div>
    </div>
    <p class="text-sm font-semibold text-honey-700">{t(lang, "blends.mix.percent", { p: percent })}</p>
    {#if done}
      <p class="animate-pop text-base font-extrabold text-honey-700" role="status">
        {t(lang, "blends.game.stir.perfect", { n: combo || 1 })}
      </p>
    {:else if combo >= 3}
      <p class="animate-pop text-sm font-bold text-honey-700" data-testid="mix-combo" aria-live="polite">
        {t(lang, "blends.game.stir.combo", { n: combo })}
      </p>
    {/if}
    <button
      type="button"
      class="btn-outline !px-3 !py-1 text-xs"
      aria-pressed={muted}
      onclick={() => (muted = sfx.toggleMuted())}
      data-testid="mix-mute"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  </div>
</div>
