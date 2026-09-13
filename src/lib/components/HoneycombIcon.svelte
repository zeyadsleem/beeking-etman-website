<script lang="ts">
  import { ShoppingBag } from "@lucide/svelte";
  let { size = 40, stroke = "currentColor", class: className = "" }: { size?: number; stroke?: string; class?: string } = $props();
</script>
<ShoppingBag {size} color={stroke} strokeWidth={1.5} class={className} aria-hidden="true" />
