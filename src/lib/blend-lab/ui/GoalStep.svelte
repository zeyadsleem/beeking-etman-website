<script lang="ts">
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { BLEND_GOALS } from "$lib/blends";
  import { t } from "$lib/i18n/messages";
  import { sfx } from "./fx-utils";

  let { lang }: { lang: "ar" | "en" } = $props();

  const game = getBlendsGame();

  // One distinct, on-brand icon per goal; falls back to a sparkle when no icon
  // is assigned so the card always stays visually rich.
  const GOAL_ICONS: Record<string, string> = {
    vitality: "⚡",
    immunity: "🛡️",
    children: "🧸",
    digestive: "🌿",
    energy: "🔥",
  };
</script>

<div class="space-y-4">
  <div class="text-center">
    <h2 class="headline text-xl font-bold text-cocoa-900">
      {t(lang, "blends.game.goal.heading")}
    </h2>
    <p class="mx-auto mt-1 max-w-md text-sm text-cocoa-600">
      {t(lang, "blends.game.goal.hint")}
    </p>
  </div>

  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each BLEND_GOALS as goal (goal.id)}
      <button
        type="button"
        class="group flex flex-col items-start gap-2 rounded-2xl p-4 text-start shadow-warm-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-warm hover:ring-honey-400 {game.goalId === goal.id ? 'bg-honey-500/90 ring-2 ring-honey-500' : 'bg-parchment ring-cocoa-200'}"
        aria-pressed={game.goalId === goal.id}
        onclick={() => {
          game.selectGoal(goal.id);
          sfx.pop();
        }}
        data-testid={`goal-${goal.id}`}
      >
        <span
          class="grid h-11 w-11 place-items-center rounded-xl bg-honey-500/20 text-2xl"
          aria-hidden="true"
        >
          {GOAL_ICONS[goal.id] ?? "✨"}
        </span>
        <span class="font-bold text-cocoa-900">
          {lang === "ar" ? goal.nameAr : goal.nameEn}
        </span>
        <span class="text-sm leading-relaxed text-cocoa-600">
          {lang === "ar" ? goal.descAr : goal.descEn}
        </span>
        <span
          class="chip !m-0 {game.goalId === goal.id ? '!bg-honey-500' : '!bg-cocoa-100'}"
        >
          {t(lang, "blends.game.rec.badge")}
        </span>
      </button>
    {/each}
  </div>
</div>
