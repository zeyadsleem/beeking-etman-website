<script lang="ts">
  import { interactivity } from "@threlte/extras";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  // Enables raycast pointer events (onclick etc.) on scene objects. The plugin
  // is injected into THIS component's Svelte context, so it only reaches T
  // components rendered inside — mount it as the Canvas root wrapping every
  // station, not as a sibling.
  interactivity();
</script>

{@render children()}
