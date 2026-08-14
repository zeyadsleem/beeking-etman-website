<script lang="ts">
  let {
    as = "h2",
    className = "",
    children,
  }: {
    as?: "h1" | "h2" | "h3";
    className?: string;
    children: import("svelte").Snippet;
  } = $props();
</script>

<svelte:element this={as} class={`rule-flourish headline ${className}`}>
  <i aria-hidden="true"></i>
  {@render children()}
</svelte:element>
