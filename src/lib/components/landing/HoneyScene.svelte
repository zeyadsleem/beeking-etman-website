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
    let idle = 0;
    const start = () => {
      if (disposed) return;
      void import("./honey-studio").then(async ({ createHoneyStudio }) => {
        if (disposed) return;
        const scene = await createHoneyStudio(container, () => progress, () => { if (!disposed) onUnavailable?.(); }, () => { if (!disposed) onReady?.(); });
        if (disposed) scene.destroy();
        else { destroy = scene.destroy; }
      }).catch(() => { destroy(); if (!disposed) onUnavailable?.(); });
    };
    // Scene setup costs real GPU time (environment prefilter, label texture,
    // first transmission pass) and reading back a live WebGL canvas stalls the
    // compositor. Start once the browser is idle so an early interaction — a
    // navigation's view-transition snapshot in particular — is never queued
    // behind scene setup.
    idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 2500 })
      : window.setTimeout(start, 400);
    return () => {
      disposed = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else clearTimeout(idle);
      destroy();
    };
  });
</script>
<div bind:this={host} class="honey-canvas" aria-hidden="true"></div>
<style>.honey-canvas{position:absolute;inset:0}.honey-canvas :global(canvas){display:block;width:100%;height:100%}</style>
