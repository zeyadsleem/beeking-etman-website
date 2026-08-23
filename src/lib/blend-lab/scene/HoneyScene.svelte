<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { Environment } from "@threlte/extras";
  import type { PageData } from "../../../routes/blends/$types";
  import { BlendsGame, provideBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import CameraRig from "./CameraRig.svelte";

  let { data }: { data: PageData } = $props();

  const game = new BlendsGame();
  provideBlendsGame(game);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
</script>

<div class="relative h-dvh w-full overflow-hidden bg-cocoa-950" data-testid="blends-scene">
  <Canvas dpr={[1, 2]} renderMode={reducedMotion ? "on-demand" : "always"}>
    <Environment url="/hdr/studio.hdr" />
    <ambientLight intensity={0.35}></ambientLight>
    <directionalLight position={[4, 6, 3]} intensity={1.4} castShadow></directionalLight>
    <CameraRig />
    <!-- Stations are added in Tasks 8–12 -->
  </Canvas>

  <!-- HTML overlay layer -->
  <div class="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
    <header class="text-center text-parchment">
      <h1 class="headline text-2xl font-bold drop-shadow">{data.lang === "ar" ? "مختبر العسل التفاعلي" : "Interactive Honey Lab"}</h1>
    </header>
  </div>
</div>
