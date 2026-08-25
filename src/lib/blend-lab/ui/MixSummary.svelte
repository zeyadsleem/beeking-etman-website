<script lang="ts">
  import { ADDITIVE_KEYS, ADDITIVE_LABELS, MAX_DOSE } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { formatEGP } from "$lib/currency";
  import { t, type Lang } from "$lib/i18n/messages";

  let {
    lang,
    unitPrice,
  }: { lang: Lang; unitPrice: number } = $props();

  const game = getBlendsGame();
</script>

<div
  class="pointer-events-auto mx-auto flex w-fit flex-wrap items-center gap-2 rounded-full bg-ink-950/70 px-4 py-2 text-sm text-parchment backdrop-blur"
  data-testid="blends-mix-summary"
>
  {#if unitPrice > 0}
    <span class="font-bold text-honey-400">
      {t(lang, "blends.game.order.unitPrice")}:
      {formatEGP(unitPrice, lang)}
    </span>
  {/if}
  {#each ADDITIVE_KEYS as k (k)}
    {#if game.doses[k] > 0}
      <span class="rounded-full bg-honey-500/20 px-2 py-0.5">
        {ADDITIVE_LABELS[k][lang]} ×{game.doses[k]}<span class="text-parchment/50">/{MAX_DOSE}</span>
      </span>
    {/if}
  {/each}
  {#if game.step === "prep"}
    <button
      class="btn-primary pointer-events-auto px-4 py-1 text-xs"
      data-testid="start-stir-btn"
      onclick={() => game.startStir()}
    >
      {t(lang, "blends.game.prep.toStir")}
    </button>
  {/if}
</div>
