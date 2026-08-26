<script lang="ts">
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import {
    ADDITIVE_KEYS,
    ADDITIVE_LABELS,
    BASE_HONEY_OPTIONS,
    BLEND_GOALS,
    JAR_SIZES,
    MAX_DOSE,
  } from "$lib/blends";
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang }: { lang: Lang } = $props();
  const game = getBlendsGame();
</script>

<div class="sr-only" data-testid="blends-actionbar">
  {#if game.step === "goal"}
    {#each BLEND_GOALS as goal (goal.id)}
      <button
        type="button"
        data-testid={`action-goal-${goal.id}`}
        onclick={() => game.selectGoal(goal.id)}
      >
        {t(lang, "blends.game.action.goals")}: {lang === "ar" ? goal.nameAr : goal.nameEn}
      </button>
    {/each}
  {:else if game.step === "honey"}
    {#each JAR_SIZES as size (size)}
      <button
        type="button"
        data-testid={`action-jar-${size}`}
        aria-pressed={game.jarSize === size}
        onclick={() => game.setJarSize(size)}
      >
        {size === "half"
          ? t(lang, "blends.game.action.jarHalf")
          : t(lang, "blends.game.action.jarFull")}
      </button>
    {/each}
    {#each BASE_HONEY_OPTIONS as option (option.id)}
      <button
        type="button"
        data-testid={`action-honey-${option.id}`}
        onclick={() => game.selectHoney(option.id)}
      >
        {t(lang, "blends.game.action.honeys")}: {lang === "ar" ? option.nameAr : option.nameEn}
      </button>
    {/each}
  {:else if game.step === "prep"}
    {#each ADDITIVE_KEYS as key (key)}
      <button
        type="button"
        data-testid={`action-dose-add-${key}`}
        disabled={game.doses[key] >= MAX_DOSE}
        onclick={() => game.addDose(key)}
      >
        {t(lang, "blends.game.action.doseAdd")} {ADDITIVE_LABELS[key][lang]}
      </button>
      <button
        type="button"
        data-testid={`action-dose-remove-${key}`}
        disabled={game.doses[key] <= 0}
        onclick={() => game.removeDose(key)}
      >
        {t(lang, "blends.game.action.doseRemove")} {ADDITIVE_LABELS[key][lang]}
      </button>
    {/each}
    <button type="button" data-testid="action-stir-start" onclick={() => game.startStir()}>
      {t(lang, "blends.game.action.startStir")}
    </button>
  {:else if game.step === "stir"}
    <button type="button" data-testid="action-stir-finish" onclick={() => game.forceFinishStir()}>
      {t(lang, "blends.game.action.finishStir")}
    </button>
  {:else if game.step === "pour"}
    <button
      type="button"
      data-testid="action-pour"
      onclick={() => {
        game.setJarFill(1);
        game.completePour();
      }}
    >
      {t(lang, "blends.game.action.pour")}
    </button>
  {/if}
  <button type="button" data-testid="action-restart" onclick={() => game.reset()}>
    {t(lang, "blends.game.action.restart")}
  </button>
</div>
