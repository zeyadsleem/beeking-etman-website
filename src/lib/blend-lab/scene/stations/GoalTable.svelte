<script lang="ts">
  import { T } from "@threlte/core";
  import { Text } from "@threlte/extras";
  import { BLEND_GOALS, type BlendGoalId } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang }: { lang: Lang } = $props();
  const game = getBlendsGame();

  let hovered = $state<BlendGoalId | null>(null);

  const CARD_W = 0.62;
  const GAP = 0.14;
  const totalW = BLEND_GOALS.length * CARD_W + (BLEND_GOALS.length - 1) * GAP;

  const nameOf = (g: (typeof BLEND_GOALS)[number]): string =>
    lang === "ar" ? g.nameAr : g.nameEn;
</script>

<T.Group position={[0, 0, -2.5]}>
  <T.Mesh position={[0, 0.72, 0]} receiveShadow>
    <T.BoxGeometry args={[totalW + 0.5, 0.06, 1.4]} />
    <T.MeshStandardMaterial color="#7a4f21" roughness={0.7} />
  </T.Mesh>
  {#each BLEND_GOALS as g, i (g.id)}
    {@const x = -totalW / 2 + CARD_W / 2 + i * (CARD_W + GAP)}
    <T.Group
      position={[x, 0.78, 0]}
      onclick={() => game.selectGoal(g.id)}
      onpointerenter={() => (hovered = g.id)}
      onpointerleave={() => (hovered === g.id ? (hovered = null) : null)}
    >
      <T.Mesh position={[0, 0.16, 0]} castShadow>
        <T.BoxGeometry args={[CARD_W, 0.32, 0.02]} />
        <T.MeshStandardMaterial
          color={hovered === g.id ? "#e8a020" : "#f5efe2"}
          roughness={0.4}
        />
      </T.Mesh>
      <Text
        position={[0, 0.16, 0.02]}
        fontSize={0.05}
        color="#3b2314"
        maxWidth={CARD_W - 0.04}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
      >
        {nameOf(g)}
      </Text>
    </T.Group>
  {/each}
</T.Group>
