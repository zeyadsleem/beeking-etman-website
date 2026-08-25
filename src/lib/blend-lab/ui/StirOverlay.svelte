<script lang="ts">
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang }: { lang: Lang } = $props();
  const game = getBlendsGame();

  const R = 64;
  const CIRC = 2 * Math.PI * R;

  let completionTimer: ReturnType<typeof setTimeout> | null = null;
  let completionLatched = false;

  // Derived primitive: invalidates dependents only when the value flips, so raw
  // stirTotal churn past full progress cannot re-run the effect below.
  const mixed = $derived(game.mixProgress >= 1);

  const clearCompletionTimer = (): void => {
    if (completionTimer !== null) {
      clearTimeout(completionTimer);
      completionTimer = null;
    }
  };

  $effect(() => {
    if (game.step !== "stir") {
      completionLatched = false;
      return clearCompletionTimer;
    }
    if (mixed && !completionLatched) {
      completionLatched = true;
      completionTimer = setTimeout(() => {
        completionTimer = null;
        game.finishStir();
      }, 600);
    }
    return clearCompletionTimer;
  });
</script>

{#if game.step === "stir"}
  <div class="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex flex-col items-center gap-2">
    <svg width={R * 2 + 16} height={R * 2 + 16} viewBox="0 0 {R * 2 + 16} {R * 2 + 16}" role="img" aria-label={t(lang, "blends.game.stir.title")} class="-rotate-90">
      <circle cx={R + 8} cy={R + 8} r={R} fill="none" stroke="#ffffff33" stroke-width="10" />
      <circle
        cx={R + 8}
        cy={R + 8}
        r={R}
        fill="none"
        stroke="#e8a020"
        stroke-width="10"
        stroke-linecap="round"
        stroke-dasharray={CIRC}
        stroke-dashoffset={CIRC * (1 - game.mixProgress)}
        data-testid="stir-progress-ring"
      />
    </svg>
    <p class="rounded-full bg-ink-950/70 px-4 py-1 text-sm text-parchment backdrop-blur">
      {game.mixProgress >= 1 ? t(lang, "blends.game.stir.done") : t(lang, "blends.game.stir.hint")}
    </p>
    {#if game.mixProgress < 1}
      <button class="btn-outline pointer-events-auto" onclick={() => game.forceFinishStir()}>
        {t(lang, "blends.game.skip")}
      </button>
    {/if}
  </div>
{/if}
