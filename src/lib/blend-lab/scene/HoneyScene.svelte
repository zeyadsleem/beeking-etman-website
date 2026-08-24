<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { Environment } from "@threlte/extras";
  import type { PageData } from "../../../routes/blends/$types";
  import { t } from "$lib/i18n/messages";
  import { JAR_SIZES } from "$lib/blends";
  import { BlendsGame, provideBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import CameraRig from "./CameraRig.svelte";
  import Interactivity from "./Interactivity.svelte";
  import GoalTable from "./stations/GoalTable.svelte";
  import HoneyShelf, { type HoneyInspection } from "./stations/HoneyShelf.svelte";
  import WorkTable, { type IngredientInspection } from "./stations/WorkTable.svelte";
  import JarStation from "./stations/JarStation.svelte";
  import StepBar from "../ui/StepBar.svelte";
  import InfoCard from "../ui/InfoCard.svelte";
  import MixSummary from "../ui/MixSummary.svelte";
  import StirOverlay from "../ui/StirOverlay.svelte";
  import OrderPanel from "../ui/OrderPanel.svelte";
  import { blendUnitPrice } from "$lib/blend-lab/pricing";

  let { data }: { data: PageData } = $props();

  const game = new BlendsGame();
  provideBlendsGame(game);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let honeyInspection = $state<HoneyInspection | null>(null);
  let ingredientInspection = $state<IngredientInspection | null>(null);

  const unitPrice = $derived(
    blendUnitPrice(data.baseHoneys, data.additives, game.honeyId, game.jarSize, game.doses),
  );

  // devalue serializes the catalog Maps as [key, value] entry arrays
  const baseMap = $derived(new Map(data.baseHoneys));
  const additiveMap = $derived(new Map(data.additives));
</script>

<div
  class="blends-scene relative h-dvh w-full overflow-hidden bg-cocoa-950"
  data-testid="blends-scene"
>
  <Canvas dpr={[1, 2]} renderMode={reducedMotion ? "on-demand" : "always"}>
    <Environment url="/hdr/studio.hdr" />
    <Interactivity>
      <ambientLight intensity={0.35}></ambientLight>
      <directionalLight position={[4, 6, 3]} intensity={1.4} castShadow></directionalLight>
      <CameraRig />
      <GoalTable lang={data.lang} />
      <HoneyShelf
        lang={data.lang}
        baseHoneys={data.baseHoneys}
        oninspect={(inspection) => (honeyInspection = inspection)}
      />
      <WorkTable
        lang={data.lang}
        additives={data.additives}
        oninspect={(inspection) => (ingredientInspection = inspection)}
      />
      <JarStation />
    </Interactivity>
  </Canvas>

  <!-- HTML overlay layer -->
  <div class="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
    <header class="text-center text-parchment">
      <h1 class="headline text-2xl font-bold drop-shadow">{t(data.lang, "blends.game.title")}</h1>
      <StepBar lang={data.lang} />
    </header>

    {#if game.step === "prep" || game.step === "stir"}
      <div class="flex justify-center">
        <MixSummary lang={data.lang} unitPrice={unitPrice} />
      </div>
    {/if}

    {#if game.step === "pour"}
      <div class="flex justify-center">
        <p
          class="pointer-events-none rounded-full bg-ink-950/70 px-4 py-2 text-sm text-parchment backdrop-blur"
          data-testid="blends-pour-hint"
        >
          {t(data.lang, "blends.game.pour.title")}
        </p>
      </div>
    {/if}

    {#if game.step === "order"}
      <OrderPanel
        lang={data.lang}
        baseHoneys={baseMap}
        additives={additiveMap}
        blendImage={data.blendImage}
      />
    {/if}

    <StirOverlay lang={data.lang} />

    {#if honeyInspection && game.step === "honey"}
      {@const current = honeyInspection}
      <div
        class="pointer-events-auto absolute bottom-24 start-1/2 z-10 w-[min(92vw,26rem)] -translate-x-1/2 rtl:translate-x-1/2"
        data-testid="honey-info-card"
      >
        <div class="mb-2 flex justify-center gap-2">
          {#each JAR_SIZES as size (size)}
            <button
              class={`rounded-full border px-4 py-1.5 text-sm font-semibold backdrop-blur transition-colors ${
                game.jarSize === size
                  ? "border-honey-500 bg-honey-500 text-ink-950"
                  : "border-parchment/40 bg-ink-950/60 text-parchment hover:bg-parchment/10"
              }`}
              onclick={() => game.setJarSize(size)}
            >
              {t(data.lang, size === "full" ? "blends.game.honey.sizeFull" : "blends.game.honey.sizeHalf")}
            </button>
          {/each}
        </div>
        <InfoCard
          title={current.title}
          body={current.body}
          priceLabel={current.priceLabel}
          actionLabel={t(data.lang, "blends.game.honey.viewBenefits")}
          onaction={() => game.selectHoney(current.id)}
        />
      </div>
    {/if}

    {#if ingredientInspection && game.step === "prep"}
      {@const current = ingredientInspection}
      <div
        class="pointer-events-auto absolute bottom-24 start-1/2 z-10 w-[min(92vw,26rem)] -translate-x-1/2 rtl:translate-x-1/2"
        data-testid="ingredient-info-card"
      >
        <InfoCard
          title={current.title}
          body={current.body}
          actionLabel={t(data.lang, "blends.game.prep.title")}
          onaction={() => game.setInspected(null)}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  /* Prevent browser scroll/zoom gestures from hijacking drag pointers mid-gesture. */
  .blends-scene :global(canvas) {
    touch-action: none;
  }
</style>
