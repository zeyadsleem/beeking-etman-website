<script module lang="ts">
  import type { PageData } from "../../../../routes/blends/$types";
  import type { BaseHoneyOption } from "$lib/blends";

  export type BaseHoneyEntry = PageData["baseHoneys"][number];

  export interface HoneyInspection {
    id: BaseHoneyOption["id"];
    title: string;
    body: string;
    priceLabel?: string;
  }
</script>

<script lang="ts">
  import { T } from "@threlte/core";
  import { BASE_HONEY_OPTIONS } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { HONEY_BENEFITS, HONEY_COLORS } from "$lib/blend-lab/benefits";
  import HoneyJar from "../models/HoneyJar.svelte";
  import { formatEGP } from "$lib/currency";
  import { t, type Lang } from "$lib/i18n/messages";

  let {
    lang,
    baseHoneys,
    oninspect,
  }: {
    lang: Lang;
    baseHoneys: BaseHoneyEntry[];
    oninspect: (inspection: HoneyInspection | null) => void;
  } = $props();

  const game = getBlendsGame();
  const byId = $derived(new Map(baseHoneys));

  let preview = $state<BaseHoneyOption["id"] | null>(null);

  const labelOf = (id: BaseHoneyOption["id"]): string => {
    const option = BASE_HONEY_OPTIONS.find((o) => o.id === id);
    return option ? (lang === "ar" ? option.nameAr : option.nameEn) : id;
  };

  const sizeText = $derived(
    t(lang, game.jarSize === "full" ? "blends.game.honey.sizeFull" : "blends.game.honey.sizeHalf"),
  );

  const inspection = $derived.by<HoneyInspection | null>(() => {
    if (!preview || game.step !== "honey") return null;
    const variant = byId.get(preview)?.[game.jarSize];
    if (!variant) return null;
    return {
      id: preview,
      title: `${labelOf(preview)} · ${sizeText}`,
      body: lang === "ar" ? HONEY_BENEFITS[preview].ar : HONEY_BENEFITS[preview].en,
      priceLabel: formatEGP(variant.price, lang),
    };
  });

  $effect(() => {
    if (game.step !== "honey") preview = null;
  });

  $effect(() => {
    oninspect(inspection);
  });
</script>

<T.Group position={[-3.4, 0, -3.0]}>
  <T.Mesh position={[0, 1.15, 0]} castShadow receiveShadow>
    <T.BoxGeometry args={[2.6, 0.08, 0.55]} />
    <T.MeshStandardMaterial color="#8b5a2b" roughness={0.65} />
  </T.Mesh>
  {#each BASE_HONEY_OPTIONS as o, i (o.id)}
    <T.Group
      position={[-1.0 + i * 0.5, 1.19, 0]}
      scale={preview === o.id ? 1.12 : 1}
      onclick={() => (preview = o.id)}
      onpointerenter={() => (preview = o.id)}
    >
      <HoneyJar fillLevel={1} color={HONEY_COLORS[o.id]} />
    </T.Group>
  {/each}
</T.Group>
