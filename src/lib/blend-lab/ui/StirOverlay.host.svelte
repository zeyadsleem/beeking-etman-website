<script lang="ts">
  import { provideBlendsGame, type BlendsGame } from "$lib/blend-lab/game-state.svelte";
  import type { Lang } from "$lib/i18n/messages";
  import StirOverlay from "./StirOverlay.svelte";

  let { game, lang }: { game: BlendsGame; lang: Lang } = $props();
  // svelte-ignore state_referenced_locally -- context must capture the exact test instance
  provideBlendsGame(game);
</script>

<StirOverlay {lang} />
