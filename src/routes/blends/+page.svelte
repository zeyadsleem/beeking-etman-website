<script lang="ts">
  import { onMount, type Component } from "svelte";
  import { hasWebGL } from "$lib/blend-lab/webgl";
  import { t } from "$lib/i18n/messages";
  import FallbackBlends from "./FallbackBlends.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let mode: "loading" | "game" | "fallback" = $state("loading");
  let Scene: Component<{ data: PageData }> | null = $state(null);

  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const forced2d = params?.has("force2d") ?? false;

  onMount(() => {
    if (forced2d || !hasWebGL()) {
      mode = "fallback";
      return;
    }
    import("$lib/blend-lab/scene/HoneyScene.svelte")
      .then((m) => {
        Scene = m.default;
        mode = "game";
      })
      .catch((err) => {
        console.error("3D scene failed to load", err);
        mode = "fallback";
      });
  });
</script>

<svelte:head>
  <title>{t(data.lang, "blends.pageTitle")}</title>
</svelte:head>

<div class="relative min-h-dvh bg-parchment" data-testid="blends-shell">
  {#if mode === "game" && Scene}
    <Scene {data} />
  {:else if mode === "fallback"}
    <p
      class="mx-auto max-w-xl px-4 pt-6 text-center text-sm text-cocoa-700"
      data-testid="webgl-fallback-message"
    >
      {t(data.lang, forced2d ? "blends.game.fallback.force2d" : "blends.game.fallback.webgl")}
    </p>
    <div data-testid="blends-fallback">
      <FallbackBlends {data} />
    </div>
  {:else}
    <div class="grid min-h-dvh place-items-center">
      <span class="h-10 w-10 animate-spin rounded-full border-4 border-honey-500 border-t-transparent"></span>
    </div>
  {/if}
</div>
