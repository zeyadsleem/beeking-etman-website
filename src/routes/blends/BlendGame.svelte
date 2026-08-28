<script lang="ts">
  import type { PageData } from "./$types";
  import { BlendsGame, BLEND_STEPS, provideBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import OrderPanel from "$lib/blend-lab/ui/OrderPanel.svelte";
  import MixStep from "$lib/blend-lab/ui/MixStep.svelte";
  import {
    ADDITIVE_KEYS,
    ADDITIVE_LABELS,
    BASE_HONEY_OPTIONS,
    JAR_SIZES,
    isAdditiveKey,
    jarLabel,
    MAX_DOSE,
    type AdditiveKey,
  } from "$lib/blends";
  import { HONEY_COLORS, INGREDIENT_COLORS } from "$lib/blend-lab/benefits";
  import { blendUnitPrice } from "$lib/blend-lab/pricing";
  import { mixIngredients } from "$lib/blend-lab/color-mix";
  import { formatEGP } from "$lib/currency";
  import { t } from "$lib/i18n/messages";

  let { data }: { data: PageData } = $props();

  const game = new BlendsGame();
  provideBlendsGame(game);

  const baseMap = $derived(new Map(data.baseHoneys));
  const additiveMap = $derived(new Map(data.additives));
  const baseEntry = $derived(
    game.honeyId ? baseMap.get(game.honeyId)?.[game.jarSize] : undefined,
  );
  const unitPrice = $derived(
    blendUnitPrice(data.baseHoneys, data.additives, game.honeyId, game.jarSize, game.doses),
  );

  // --- mix visual: a convincing blend colour that deepens with each dose ---
  const selectedDoses = $derived(
    ADDITIVE_KEYS.flatMap((key) => {
      const dose = game.doses[key];
      return dose > 0 ? [{ key, dose }] : [];
    }),
  );
  const baseHex = $derived(game.honeyId ? HONEY_COLORS[game.honeyId] : "#e8a020");
  const additiveWeights = $derived(
    selectedDoses.map((d) => ({ hex: INGREDIENT_COLORS[d.key], weight: d.dose })),
  );
  const progress = $derived(Math.min(1, game.totalDoses / 4));
  const mixedColor = $derived(mixIngredients(baseHex, additiveWeights, progress));
  const fillPercent = $derived(game.hasHoney ? Math.min(100, 45 + game.totalDoses * 10) : 0);

  // --- drag & drop (HTML5 for desktop; steppers + mix gesture cover touch) ---
  let dragging = $state<AdditiveKey | null>(null);

  const stepLabel = (step: (typeof BLEND_STEPS)[number]): string =>
    step === "honey"
      ? t(data.lang, "blends.game.step.select")
      : step === "additives"
        ? t(data.lang, "blends.game.step.ingredients")
        : t(data.lang, "blends.game.step.mix");

  const gateHint = $derived(
    game.step === "honey"
      ? t(data.lang, "blends.gate.honey")
      : game.step === "additives"
        ? t(data.lang, "blends.gate.additives")
        : t(data.lang, "blends.gate.mix"),
  );
</script>

<div
  class="min-h-dvh bg-cocoa-950 pb-40 text-cocoa-100"
  data-testid="blends-scene"
>
  <header class="sticky top-0 z-30 border-b border-cocoa-800 bg-cocoa-950/80 backdrop-blur">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
      <div>
        <h1 class="headline text-xl font-bold text-honey-100">{t(data.lang, "blends.game.title")}</h1>
        <p class="text-xs text-cocoa-300">{t(data.lang, "blends.game.subtitle")}</p>
      </div>
      <button
        type="button"
        class="btn-outline shrink-0 !py-1.5 !px-3 text-sm"
        onclick={() => game.reset()}
        data-testid="blends-restart"
      >
        {t(data.lang, "blends.game.restart")}
      </button>
    </div>

    <!-- step indicator -->
    <nav class="mx-auto max-w-5xl px-4 pb-3" aria-label={t(data.lang, "blends.game.action.goals")}>
      <ol class="flex items-center gap-1">
        {#each BLEND_STEPS as step, i (step)}
          <li class="flex flex-1 items-center gap-1">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 py-1.5 text-xs font-semibold transition"
              class:bg-honey-500={game.step === step}
              class:text-cocoa-900={game.step === step}
              class:text-cocoa-200={game.step !== step}
              class:opacity-60={game.step !== step && !(i < BLEND_STEPS.indexOf(game.step))}
              aria-current={game.step === step ? "step" : undefined}
              disabled={(i > BLEND_STEPS.indexOf(game.step) && !(game.step === "mix")) || i === BLEND_STEPS.indexOf(game.step)}
              onclick={() => {
                if (i < BLEND_STEPS.indexOf(game.step)) game.back();
              }}
              data-testid={`step-${step}`}
            >
              <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cocoa-950/30 text-[10px]">
                {i + 1}
              </span>
              <span class="truncate">{stepLabel(step)}</span>
            </button>
            {#if i < BLEND_STEPS.length - 1}
              <span class="h-px w-3 shrink-0 bg-cocoa-700" aria-hidden="true"></span>
            {/if}
          </li>
        {/each}
      </ol>
    </nav>
  </header>

  <main class="mx-auto max-w-5xl space-y-8 px-4 py-6">
    <!-- STEP 1: choose base honey -->
    {#if game.step === "honey"}
      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="headline text-lg font-bold text-honey-100">{t(data.lang, "blends.section.honey")}</h2>

          <div class="inline-flex overflow-hidden rounded-full border border-cocoa-600" role="group" aria-label={t(data.lang, "blends.size.label")}>
            {#each JAR_SIZES as size (size)}
              <button
                type="button"
                class="px-4 py-1.5 text-sm font-semibold transition"
                class:bg-honey-500={game.jarSize === size}
                class:text-cocoa-900={game.jarSize === size}
                class:text-cocoa-200={game.jarSize !== size}
                aria-pressed={game.jarSize === size}
                onclick={() => game.setJarSize(size)}
                data-testid={`size-${size}`}
              >
                {jarLabel(data.lang, size)}
              </button>
            {/each}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {#each BASE_HONEY_OPTIONS as option (option.id)}
            {@const entry = baseMap.get(option.id)?.[game.jarSize]}
            {#if entry}
              <button
                type="button"
                class="group flex flex-col overflow-hidden rounded-2xl bg-cocoa-900/60 text-start ring-1 ring-cocoa-800 transition hover:-translate-y-0.5 hover:ring-honey-500"
                class:ring-2={game.honeyId === option.id}
                class:ring-honey-400={game.honeyId === option.id}
                aria-pressed={game.honeyId === option.id}
                onclick={() => game.selectHoney(option.id)}
                data-testid={`honey-${option.id}`}
              >
                <div class="relative aspect-square overflow-hidden bg-cocoa-950/40">
                  <img
                    src={entry.image}
                    alt={entry.name}
                    class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div class="p-3">
                  <p class="truncate font-bold text-parchment">
                    {data.lang === "ar" ? option.nameAr : option.nameEn}
                  </p>
                  <p class="mt-0.5 text-sm font-semibold text-honey-300">
                    {formatEGP(entry.price, data.lang)}
                  </p>
                </div>
              </button>
            {/if}
          {/each}
        </div>
      </section>
    {/if}

    <!-- STEP 2: add additives by drag & drop / steppers -->
    {#if game.step === "additives"}
      <!-- Your jar: live summary + drop target -->
      <section
        class="rounded-3xl bg-cocoa-900/60 p-5 ring-1 ring-cocoa-800 transition"
        class:ring-honey-500={dragging !== null}
        class:scale-[1.01]={dragging !== null}
        role="group"
        aria-label={t(data.lang, "blends.section.yourJar")}
        ondrop={(e) => {
          e.preventDefault();
          const key = e.dataTransfer?.getData("text/plain");
          if (key && isAdditiveKey(key)) game.addDose(key);
          dragging = null;
        }}
        ondragover={(e) => e.preventDefault()}
        data-testid="blend-drop-zone"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="headline text-lg font-bold text-honey-100">{t(data.lang, "blends.section.yourJar")}</h2>
          <span class="text-xs text-cocoa-300">{t(data.lang, "blends.mixHint")}</span>
        </div>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div class="flex items-center gap-4">
            {#if baseEntry}
              <img
                src={baseEntry.image}
                alt={baseEntry.name}
                class="h-20 w-20 rounded-2xl object-cover ring-1 ring-cocoa-700"
              />
            {:else}
              <div class="grid h-20 w-20 place-items-center rounded-2xl bg-cocoa-800 text-2xl" aria-hidden="true">🍯</div>
            {/if}

            <div class="flex h-24 flex-col justify-end" aria-hidden="true">
              <div class="w-14 overflow-hidden rounded-b-xl rounded-t-md border border-cocoa-600 bg-cocoa-950/40">
                <div
                  class="w-full transition-[height] duration-500 ease-out"
                  style="height:{fillPercent}%;background:linear-gradient(180deg,{mixedColor},{mixedColor}99)"
                ></div>
              </div>
            </div>

            <div class="min-w-0">
              {#if game.honeyId && baseEntry}
                <p class="truncate font-bold text-parchment">{baseEntry.name}</p>
                <p class="text-sm text-cocoa-300">{jarLabel(data.lang, game.jarSize)}</p>
                {#if selectedDoses.length > 0}
                  <ul class="mt-2 flex flex-wrap gap-1">
                    {#each selectedDoses as d (d.key)}
                      <li class="chip !m-0" style={`background:${INGREDIENT_COLORS[d.key]}22`}>
                        {ADDITIVE_LABELS[d.key][data.lang]} ×{d.dose}
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="mt-1 text-sm text-cocoa-300">{t(data.lang, "blends.noHoney")}</p>
                {/if}
              {:else}
                <p class="font-bold text-honey-200">{t(data.lang, "blends.choosePrompt")}</p>
              {/if}
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between sm:mt-0 sm:flex-col sm:items-end">
            <p class="text-sm text-cocoa-300">{t(data.lang, "blends.game.order.unitPrice")}</p>
            <p class="text-2xl font-extrabold text-honey-300" data-testid="live-price">
              {formatEGP(unitPrice, data.lang)}
            </p>
          </div>
        </div>
      </section>

      <!-- ingredient shelf -->
      <section>
        <h2 class="headline mb-3 text-lg font-bold text-honey-100">{t(data.lang, "blends.section.additives")}</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {#each ADDITIVE_KEYS as key (key)}
            {@const entry = additiveMap.get(key)}
            {#if entry}
              <div
                class="flex flex-col overflow-hidden rounded-2xl bg-cocoa-900/60 ring-1 ring-cocoa-800"
                role="group"
                aria-label={entry.label}
                draggable="true"
                ondragstart={(e) => {
                  e.dataTransfer?.setData("text/plain", key);
                  dragging = key;
                }}
                ondragend={() => (dragging = null)}
                data-testid={`additive-${key}`}
              >
                <div class="relative aspect-square overflow-hidden bg-cocoa-950/40">
                  <img
                    src={entry.image}
                    alt={entry.name}
                    class="h-full w-full object-cover"
                    loading="lazy"
                    draggable="false"
                  />
                  {#if selectedDoses.some((d) => d.key === key)}
                    <span
                      class="absolute end-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold"
                      style={`background:${INGREDIENT_COLORS[key]};color:#1c1914`}
                      data-testid={`dose-count-${key}`}
                    >×{game.doses[key]}</span>
                  {/if}
                </div>
                <div class="flex flex-1 flex-col p-3">
                  <p class="truncate text-sm font-bold text-parchment">{entry.label}</p>
                  <p class="mt-0.5 text-xs text-cocoa-300">{formatEGP(entry.price, data.lang)}{t(data.lang, "blends.perDose")}</p>
                  <div class="mt-2 inline-flex items-center justify-between">
                    <button
                      type="button"
                      class="grid h-9 w-9 place-items-center rounded-full bg-cocoa-800 text-lg font-bold text-parchment transition hover:bg-cocoa-700 disabled:opacity-30"
                      aria-label={t(data.lang, "blends.game.action.doseRemove")}
                      disabled={game.doses[key] <= 0}
                      onclick={() => game.removeDose(key)}
                      data-testid={`dose-remove-${key}`}
                    >−</button>
                    <span class="min-w-8 text-center font-bold text-honey-200">{game.doses[key]}</span>
                    <button
                      type="button"
                      class="grid h-9 w-9 place-items-center rounded-full bg-honey-500 text-lg font-bold text-cocoa-900 transition hover:bg-honey-400 disabled:opacity-40"
                      aria-label={t(data.lang, "blends.game.action.doseAdd")}
                      disabled={game.doses[key] >= MAX_DOSE}
                      onclick={() => game.addDose(key)}
                      data-testid={`dose-add-${key}`}
                    >+</button>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/if}

    <!-- STEP 3: interactive mix -->
    {#if game.step === "mix"}
      <section class="flex flex-col items-center gap-4">
        <h2 class="headline text-lg font-bold text-honey-100">{t(data.lang, "blends.game.stir.title")}</h2>
        <MixStep
          lang={data.lang}
          color={mixedColor}
          fillPercent={fillPercent}
          progress={game.mixProgress}
          onProgress={(amount) => game.recordStir(amount)}
        />
        {#if selectedDoses.length > 0}
          <ul class="flex flex-wrap items-center justify-center gap-1">
            {#each selectedDoses as d (d.key)}
              <li class="chip !m-0" style={`background:${INGREDIENT_COLORS[d.key]}22`}>
                {ADDITIVE_LABELS[d.key][data.lang]} ×{d.dose}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </main>

  <!-- Sticky footer: back / next navigation, then order CTA -->
  <div class="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
    <div class="mx-auto w-full max-w-5xl">
      {#if game.step === "mix" && game.isMixDone && baseEntry}
        <OrderPanel
          lang={data.lang}
          baseHoneys={baseMap}
          additives={additiveMap}
          blendImage={data.blendImage}
        />
      {:else}
        <div
          class="flex items-center justify-between gap-3 rounded-3xl bg-cocoa-900/95 px-5 py-4 ring-1 ring-cocoa-800"
        >
          <button
            type="button"
            class="btn-outline !px-4 !py-2 text-sm"
            disabled={!game.canBack}
            onclick={() => game.back()}
            data-testid="blends-back"
          >
            {t(data.lang, "blends.game.back")}
          </button>

          <div class="min-w-0 text-center">
            <p class="text-xs text-cocoa-300">{gateHint}</p>
            <p class="text-lg font-bold text-honey-300" data-testid="live-price">
              {formatEGP(unitPrice, data.lang)}
            </p>
          </div>

          <button
            type="button"
            class="btn-primary !px-5 !py-2 text-sm"
            disabled={!game.canNext}
            onclick={() => game.next()}
            data-testid="blends-next"
          >
            {t(data.lang, "blends.next")}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
