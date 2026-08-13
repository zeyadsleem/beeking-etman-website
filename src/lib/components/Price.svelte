<script lang="ts">
  import { formatEGP } from "$lib/currency";

  let { amount, className = "" }: { amount: number; className?: string } = $props();
</script>

<span class={className}>{formatEGP(amount)}</span>
