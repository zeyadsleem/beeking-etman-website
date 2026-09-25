<script lang="ts">
  import { onMount } from "svelte";
  let { progress = 0, onReady, onUnavailable }: {
    progress?: number; onReady?: () => void; onUnavailable?: () => void;
  } = $props();
  let host = $state<HTMLDivElement>();
  onMount(() => {
    const container = host;
    if (!container) return;
    let disposed = false;
    let destroy = () => {};
    void import("./honey-studio").then(async ({ createHoneyStudio }) => {
      if (disposed) return;
      const scene = await createHoneyStudio(container, () => progress, () => disposed, () => { if (!disposed) onUnavailable?.(); });
      if (disposed) scene.destroy();
      else { destroy = scene.destroy; onReady?.(); }
    }).catch(() => { destroy(); if (!disposed) onUnavailable?.(); });
    return () => { disposed = true; destroy(); };
  });
</script>
<div bind:this={host} class="honey-canvas" aria-hidden="true"></div>
<style>.honey-canvas{position:absolute;inset:0}.honey-canvas :global(canvas){display:block;width:100%;height:100%}</style>
