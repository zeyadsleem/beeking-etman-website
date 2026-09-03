<script lang="ts">
  import type { PageData } from "./$types";
  import { BlendsGame, BLEND_STEPS, provideBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import OrderPanel from "$lib/blend-lab/ui/OrderPanel.svelte";
  import MixStep from "$lib/blend-lab/ui/MixStep.svelte";
  import GoalStep from "$lib/blend-lab/ui/GoalStep.svelte";
  import {
    ADDITIVE_KEYS,
    ADDITIVE_LABELS,
    BASE_HONEY_OPTIONS,
    JAR_SIZES,
    isAdditiveKey,
    jarLabel,
    type AdditiveKey,
  } from "$lib/blends";
  import { HONEY_COLORS, INGREDIENT_COLORS } from "$lib/blend-lab/benefits";
  import { blendUnitPrice } from "$lib/blend-lab/pricing";
  import { mixIngredients } from "$lib/blend-lab/color-mix";
  import { prefersReducedMotion, sfx } from "$lib/blend-lab/ui/fx-utils";
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

  // --- image-based "game elements": one ingredient token per selected additive,
  //     positioned deterministically so the jar fills with the actual images ---
  const anim = $derived(!prefersReducedMotion());

  interface JarToken {
    key: AdditiveKey;
    dose: number;
    image: string;
    name: string;
    left: number;
    top: number;
    angle: number;
    delay: number;
  }

  const jarTokens = $derived<JarToken[]>(
    selectedDoses
      .map((d) => {
        const entry = additiveMap.get(d.key);
        const seed = Math.abs(
          [...d.key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
        );
        return {
          key: d.key,
          dose: d.dose,
          image: entry?.image ?? "",
          name: entry?.label ?? "",
          left: 12 + (seed % 66),
          top: 14 + ((seed >> 3) % 56),
          angle: ((seed >> 5) % 22) - 11,
          delay: (seed % 5) * 40,
        };
      })
      .filter((x) => x.image),
  );

  // --- drag & drop (HTML5 for desktop; steppers + mix gesture cover touch) ---
  let dragging = $state<AdditiveKey | null>(null);

  const stepLabel = (step: (typeof BLEND_STEPS)[number]): string =>
    step === "goal"
      ? t(data.lang, "blends.game.step.goal")
      : step === "honey"
        ? t(data.lang, "blends.game.step.select")
        : step === "additives"
          ? t(data.lang, "blends.game.step.ingredients")
          : t(data.lang, "blends.game.step.mix");

  const gateHint = $derived(
    game.step === "goal"
      ? t(data.lang, "blends.game.goal.hint")
      : game.step === "honey"
        ? t(data.lang, "blends.gate.honey")
        : game.step === "additives"
          ? t(data.lang, "blends.gate.additives")
          : t(data.lang, "blends.gate.mix"),
  );
</script>

<div
  class="min-h-dvh bg-paper pb-40 text-cocoa-900"
  data-testid="blends-scene"
>
  <header class="sticky top-0 z-30 border-b border-cocoa-200 bg-paper/80 backdrop-blur">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
      <div>
        <h1 class="headline text-xl font-bold text-cocoa-900">{t(data.lang, "blends.game.title")}</h1>
        <p class="text-xs text-cocoa-600">{t(data.lang, "blends.game.subtitle")}</p>
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
              class:text-cocoa-950={game.step === step}
              class:text-cocoa-600={game.step !== step}
              class:opacity-60={game.step !== step && !(i < BLEND_STEPS.indexOf(game.step))}
              aria-current={game.step === step ? "step" : undefined}
              disabled={(i > BLEND_STEPS.indexOf(game.step) && !(game.step === "mix")) || i === BLEND_STEPS.indexOf(game.step)}
              onclick={() => {
                if (i < BLEND_STEPS.indexOf(game.step)) game.back();
              }}
              data-testid={`step-${step}`}
            >
              <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cocoa-200/70 text-[10px]">
                {i + 1}
              </span>
              <span class="truncate">{stepLabel(step)}</span>
            </button>
            {#if i < BLEND_STEPS.length - 1}
              <span class="h-px w-3 shrink-0 bg-cocoa-300" aria-hidden="true"></span>
            {/if}
          </li>
        {/each}
      </ol>
    </nav>
  </header>

  <main class="mx-auto max-w-5xl space-y-8 px-4 py-6">
    <!-- STEP 0: choose a goal -->
    {#if game.step === "goal"}
      <section aria-label={t(data.lang, "blends.game.step.goal")}>
        <GoalStep lang={data.lang} />
      </section>
    {/if}

    <!-- STEP 1: choose base honey -->
    {#if game.step === "honey"}
      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="headline text-lg font-bold text-cocoa-900">{t(data.lang, "blends.section.honey")}</h2>

          <div class="inline-flex overflow-hidden rounded-full border border-cocoa-200 bg-parchment" role="group" aria-label={t(data.lang, "blends.size.label")}>
            {#each JAR_SIZES as size (size)}
              <button
                type="button"
                class="px-4 py-1.5 text-sm font-semibold transition"
                class:bg-honey-500={game.jarSize === size}
                class:text-cocoa-950={game.jarSize === size}
                class:text-cocoa-700={game.jarSize !== size}
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
                class="group flex flex-col overflow-hidden rounded-2xl bg-parchment text-start shadow-warm-sm ring-1 ring-cocoa-200 transition hover:-translate-y-0.5 hover:shadow-warm hover:ring-honey-400"
                class:ring-2={game.honeyId === option.id}
                class:ring-honey-500={game.honeyId === option.id}
                aria-pressed={game.honeyId === option.id}
                onclick={() => game.selectHoney(option.id)}
                data-testid={`honey-${option.id}`}
              >
                <div class="relative aspect-square overflow-hidden bg-paper-deep">
                  <img
                    src={entry.image}
                    alt={entry.name}
                    class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div class="p-3">
                  <p class="truncate font-bold text-cocoa-900">
                    {data.lang === "ar" ? option.nameAr : option.nameEn}
                  </p>
                  <p class="mt-0.5 text-sm font-semibold text-honey-700">
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
        class="rounded-3xl bg-parchment p-5 shadow-warm-sm ring-1 ring-cocoa-200 transition"
        class:ring-honey-500={dragging !== null}
        class:shadow-warm={dragging !== null}
        role="group"
        aria-label={t(data.lang, "blends.section.yourJar")}
        ondrop={(e) => {
          e.preventDefault();
          const key = e.dataTransfer?.getData("text/plain");
          if (key && isAdditiveKey(key)) {
            game.addDose(key);
            sfx.pop();
          }
          dragging = null;
        }}
        ondragover={(e) => e.preventDefault()}
        data-testid="blend-drop-zone"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="headline text-lg font-bold text-cocoa-900">{t(data.lang, "blends.section.yourJar")}</h2>
          <span class="text-xs text-cocoa-600">{t(data.lang, "blends.mixHint")}</span>
        </div>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div class="flex items-center gap-4">
            {#if baseEntry}
              <img
                src={baseEntry.image}
                alt={baseEntry.name}
                class="h-20 w-20 rounded-2xl object-cover ring-1 ring-cocoa-200"
              />
            {:else}
              <div class="grid h-20 w-20 place-items-center rounded-2xl bg-paper-deep text-2xl" aria-hidden="true">🍯</div>
            {/if}

            <div class="relative h-40 w-32 shrink-0 overflow-hidden rounded-b-[2rem] rounded-t-xl border-2 border-cocoa-200 bg-parchment shadow-warm-sm" aria-hidden="true">
              <!-- liquid fill -->
              <div
                class="absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out"
                style={`height:${fillPercent}%;background:linear-gradient(180deg,${mixedColor},${mixedColor}cc)`}
              ></div>
              <!-- floating ingredient images -->
              {#each jarTokens as tok (tok.key)}
                <div
                  class="absolute flex flex-col items-center {anim ? 'animate-pop' : ''}"
                  style={`left:${tok.left}%;top:${tok.top}%;animation-delay:${tok.delay}ms`}
                >
                  <img
                    src={tok.image}
                    alt=""
                    class="h-9 w-9 rounded-full border border-white/70 object-cover shadow-sm"
                    style={`transform:rotate(${tok.angle}deg)`}
                    loading="lazy"
                  />
                  {#key tok.dose}
                    <span
                      class="mt-0.5 rounded-full px-1.5 text-[10px] font-bold leading-4"
                      style={`background:${INGREDIENT_COLORS[tok.key]};color:#1c1914`}
                    >×{tok.dose}</span>
                  {/key}
                </div>
              {/each}
            </div>

            <div class="min-w-0">
              {#if game.honeyId && baseEntry}
                <p class="truncate font-bold text-cocoa-900">{baseEntry.name}</p>
                <p class="text-sm text-cocoa-600">{jarLabel(data.lang, game.jarSize)}</p>
                {#if selectedDoses.length > 0}
                  <ul class="mt-2 flex flex-wrap gap-1">
                    {#each selectedDoses as d (d.key)}
                      <li class="chip !m-0" style={`background:${INGREDIENT_COLORS[d.key]}22`}>
                        {ADDITIVE_LABELS[d.key][data.lang]} ×{d.dose}
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="mt-1 text-sm text-cocoa-600">{t(data.lang, "blends.noHoney")}</p>
                {/if}
              {:else}
                <p class="font-bold text-honey-700">{t(data.lang, "blends.choosePrompt")}</p>
              {/if}
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between sm:mt-0 sm:flex-col sm:items-end">
            <p class="text-sm text-cocoa-600">{t(data.lang, "blends.game.order.unitPrice")}</p>
            <p class="text-2xl font-extrabold text-honey-700" data-testid="live-price">
              {formatEGP(unitPrice, data.lang)}
            </p>
          </div>
        </div>
      </section>

      <!-- ingredient shelf -->
      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="headline text-lg font-bold text-cocoa-900">{t(data.lang, "blends.section.additives")}</h2>
          {#if game.recommendedAdditives.length > 0}
            <span class="chip !m-0 bg-honey-500 text-cocoa-950" data-testid="rec-hint">
              {t(data.lang, "blends.game.rec.hint")}
            </span>
          {/if}
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {#each ADDITIVE_KEYS as key (key)}
            {@const entry = additiveMap.get(key)}
            {#if entry}
              <div
                class="flex flex-col overflow-hidden rounded-2xl bg-parchment shadow-warm-sm ring-1 ring-cocoa-200"
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
                <div class="relative aspect-square overflow-hidden bg-paper-deep">
                  <img
                    src={entry.image}
                    alt={entry.name}
                    class="h-full w-full object-cover"
                    loading="lazy"
                    draggable="false"
                  />
                  {#if game.isRecommended(key)}
                    <span
                      class="absolute start-2 top-2 rounded-full bg-honey-500 px-2 py-0.5 text-[10px] font-extrabold text-cocoa-950 shadow-sm"
                      data-testid={`rec-badge-${key}`}
                    >
                      {t(data.lang, "blends.game.rec.badge")}
                    </span>
                  {/if}
                  {#if selectedDoses.some((d) => d.key === key)}
                    <span
                      class="absolute end-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold"
                      style={`background:${INGREDIENT_COLORS[key]};color:#1c1914`}
                      data-testid={`dose-count-${key}`}
                    >×{game.doses[key]}</span>
                  {/if}
                </div>
                <div class="flex flex-1 flex-col p-3">
                  <p class="truncate text-sm font-bold text-cocoa-900">{entry.label}</p>
                  <p class="mt-0.5 text-xs text-cocoa-600">{formatEGP(entry.price, data.lang)}{t(data.lang, "blends.perDose")}</p>
                  <div class="mt-2 inline-flex items-center justify-between">
                    <button
                      type="button"
                      class="grid h-9 w-9 place-items-center rounded-full bg-cocoa-100 text-lg font-bold text-cocoa-700 transition hover:bg-cocoa-200 disabled:opacity-30"
                      aria-label={t(data.lang, "blends.game.action.doseRemove")}
                      disabled={game.doses[key] <= 0}
                      onclick={() => game.removeDose(key)}
                      data-testid={`dose-remove-${key}`}
                    >−</button>
                    <span class="min-w-8 text-center font-bold text-honey-700">{game.doses[key]}</span>
                    <button
                      type="button"
                      class="grid h-9 w-9 place-items-center rounded-full bg-honey-500 text-lg font-bold text-cocoa-950 transition hover:bg-honey-400 active:scale-90"
                      aria-label={t(data.lang, "blends.game.action.doseAdd")}
                      onclick={() => {
                        game.addDose(key);
                        sfx.pop();
                      }}
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
        <h2 class="headline text-lg font-bold text-cocoa-900">{t(data.lang, "blends.game.stir.title")}</h2>
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
          class="flex items-center justify-between gap-3 rounded-3xl bg-parchment/95 px-5 py-4 shadow-warm-lg ring-1 ring-cocoa-200 backdrop-blur"
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
            <p class="text-xs text-cocoa-600">{gateHint}</p>
            <p class="text-lg font-bold text-honey-700" data-testid="live-price">
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
