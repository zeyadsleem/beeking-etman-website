<script lang="ts">
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang }: { lang: Lang } = $props();
  const game = getBlendsGame();

  const STEPS = ["goal", "honey", "prep", "stir", "pour", "order"] as const;

  const canBack = $derived(game.canBack);
</script>

<div
  class="pointer-events-auto mx-auto flex w-fit items-center gap-2 rounded-full bg-ink-950/70 px-4 py-2 backdrop-blur"
  data-testid="blends-stepbar"
>
  {#each STEPS as s, i (s)}
    {#if i > 0}<span class="h-1 w-4 rounded bg-white/25"></span>{/if}
    <span
      class={`rounded-full px-3 py-1 text-sm ${
        game.step === s ? "bg-honey-500 font-bold text-ink-950" : "text-parchment/80"
      }`}
    >
      {t(lang, `blends.game.step.${s}`)}
    </span>
  {/each}
  {#if canBack}
    <button
      class="ms-2 rounded-full border border-parchment/40 px-3 py-1 text-sm text-parchment hover:bg-parchment/10"
      onclick={() => game.goBack()}
    >
      {t(lang, "blends.game.back")}
    </button>
  {/if}
</div>
