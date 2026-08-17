<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import type { Lang } from "$lib/i18n/messages";

  let { amount, lang = "ar", className = "" }: { amount: number; lang?: Lang; className?: string } = $props();
</script>

<span class={className}>{formatEGP(amount, lang)}</span>
