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

<svelte:element this={as} class={`headline ${className}`}>
  <span class="mb-3 block h-[3px] w-9 rounded-full bg-honey-600" aria-hidden="true"></span>
  <span class="block">{@render children()}</span>
</svelte:element>
