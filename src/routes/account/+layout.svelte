<script lang="ts">
  let { children }: { children: import("svelte").Snippet } = $props();
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>
{@render children()}
