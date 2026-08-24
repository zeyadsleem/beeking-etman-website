<script lang="ts">
  import { provideBlendsGame, type BlendsGame } from "$lib/blend-lab/game-state.svelte";
  import type { AdditiveKey, BaseHoneyOption, JarSize } from "$lib/blends";
  import type { Lang } from "$lib/i18n/messages";
  import type { CatalogEntry } from "./catalog";
  import OrderPanel from "./OrderPanel.svelte";

  let {
    game,
    lang,
    baseHoneys,
    additives,
    blendImage,
  }: {
    game: BlendsGame;
    lang: Lang;
    baseHoneys: Map<BaseHoneyOption["id"], Record<JarSize, CatalogEntry>>;
    additives: Map<AdditiveKey, CatalogEntry & { key: AdditiveKey; label: string }>;
    blendImage: string;
  } = $props();
  // svelte-ignore state_referenced_locally -- context must capture the exact test instance
  provideBlendsGame(game);
</script>

<OrderPanel {lang} {baseHoneys} {additives} {blendImage} />
