<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import {
    ADDITIVE_KEYS,
    ADDITIVE_LABELS,
    BASE_HONEY_OPTIONS,
    BLEND_GOALS,
    isAdditiveKey,
    MAX_DOSE,
    presetDoses,
    type AdditiveKey,
    type BaseHoneyOption,
    type BlendGoal,
    type JarSize,
  } from "$lib/blends";
  import { addBlend, openDrawer } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);
  const baseHoneys = $derived(new Map(data.baseHoneys));
  const additives = $derived(new Map(data.additives));

  type Step = "goal" | "base" | "mix" | "done";

  const stepKeys = ["goal", "base", "mix", "done"] as const;

  const JAR_SIZES: readonly JarSize[] = ["half", "full"];

  function zeroDoses(): Record<AdditiveKey, number> {
    return Object.fromEntries(ADDITIVE_KEYS.map((k) => [k, 0])) as Record<AdditiveKey, number>;
  }

  let step = $state<Step>("goal");
  let goal = $state<BlendGoal | null>(null);
  let option = $state<BaseHoneyOption | null>(null);
  let jarSize = $state<JarSize>("full");
  let doses = $state<Record<AdditiveKey, number>>(zeroDoses());
  let dragging = $state(false);
  let dropCount = $state(0);
  let confetti = $state<ConfettiPiece[]>([]);

  interface ConfettiPiece {
    left: string;
    delay: string;
    duration: string;
    color: string;
    size: string;
  }

  const base = $derived(option ? baseHoneys.get(option.id)?.[jarSize] ?? null : null);
  const selectedAdditives = $derived(ADDITIVE_KEYS.filter((k) => doses[k] > 0));
  const additiveTotal = $derived(
    selectedAdditives.reduce((sum, k) => sum + (additives.get(k)?.price ?? 0) * doses[k], 0),
  );
  const total = $derived((base?.price ?? 0) + additiveTotal);
  const recommendedSet = $derived(new Set(goal?.recommended ?? []));

  let wheelEl = $state<HTMLDivElement | undefined>(undefined);
  let spin = $state(0);
  let wheelDragging = $state(false);
  let dragStartAngle = 0;
  let dragStartSpin = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let moved = 0;
  let lastWheelSpin = 0;
  let lastWheelTime = 0;
  let wheelVelocity = 0;
  let wheelRaf: number | undefined;
  let autoRaf: number | undefined;
  let suppressClick = false;
  let selectedInTap = false;

  function startAutoSpin() {
    if (autoRaf !== undefined) return;
    const tick = () => {
      spin += 0.1;
      autoRaf = requestAnimationFrame(tick);
    };
    autoRaf = requestAnimationFrame(tick);
  }

  function stopAutoSpin() {
    if (autoRaf !== undefined) {
      cancelAnimationFrame(autoRaf);
      autoRaf = undefined;
    }
  }

  function wheelAngle(e: PointerEvent): number {
    const el = wheelEl;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  }

  function cancelWheelRaf() {
    if (wheelRaf !== undefined) {
      cancelAnimationFrame(wheelRaf);
      wheelRaf = undefined;
    }
  }

  function wheelDown(e: PointerEvent) {
    stopAutoSpin();
    cancelWheelRaf();
    suppressClick = false;
    selectedInTap = false;
    moved = 0;
    dragStartAngle = wheelAngle(e);
    dragStartSpin = spin;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    lastWheelSpin = spin;
    lastWheelTime = performance.now();
    wheelVelocity = 0;
    wheelDragging = true;
    (e.currentTarget as HTMLElement | null)?.setPointerCapture(e.pointerId);
  }

  function wheelMove(e: PointerEvent) {
    if (!wheelDragging) return;
    moved = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
    const now = performance.now();
    const dt = Math.max(now - lastWheelTime, 1);
    const prev = spin;
    spin = dragStartSpin + (wheelAngle(e) - dragStartAngle);
    wheelVelocity = (spin - prev) / dt;
    lastWheelSpin = spin;
    lastWheelTime = now;
  }

  function tapTargetIndex(e: PointerEvent): number {
    const el = wheelEl;
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = rect.width * 0.36;
    const ry = rect.height * 0.36;
    const nx = (e.clientX - cx) / rx;
    const ny = (e.clientY - cy) / ry;
    if (Math.hypot(nx, ny) < 0.22) return -1;
    const phi = (Math.atan2(ny, nx) * 180) / Math.PI;
    const n = BLEND_GOALS.length;
    let best = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < n; i++) {
      const theta = (i * 360) / n - 90 + spin;
      const diff = ((((phi - theta) % 360) + 540) % 360) - 180;
      if (Math.abs(diff) < Math.abs(bestDiff)) {
        best = i;
        bestDiff = diff;
      }
    }
    return best;
  }

  function wheelUp(e: PointerEvent) {
    if (!wheelDragging) return;
    wheelDragging = false;
    if (moved >= 8) {
      suppressClick = true;
    } else {
      const idx = tapTargetIndex(e);
      if (idx >= 0) {
        suppressClick = true;
        selectedInTap = true;
        selectGoal(BLEND_GOALS[idx]);
      }
    }
    if (Math.abs(wheelVelocity) > 0.04) {
      wheelRaf = requestAnimationFrame(wheelMomentum);
    } else if (!selectedInTap) {
      startAutoSpin();
    }
  }

  function wheelMomentum() {
    if (Math.abs(wheelVelocity) < 0.01) {
      wheelVelocity = 0;
      wheelRaf = undefined;
      startAutoSpin();
      return;
    }
    spin += wheelVelocity * 16.67;
    wheelVelocity *= 0.94;
    wheelRaf = requestAnimationFrame(wheelMomentum);
  }

  const topIndex = $derived.by(() => {
    const n = BLEND_GOALS.length;
    const s = ((spin % 360) + 360) % 360;
    return (((Math.round(-s / (360 / n)) % n) + n) % n);
  });

  onMount(startAutoSpin);

  onDestroy(() => {
    cancelWheelRaf();
    stopAutoSpin();
  });

  function stepIndex(s: Step): number {
    return stepKeys.indexOf(s);
  }

  function selectGoal(g: BlendGoal) {
    goal = g;
    doses = presetDoses(g, jarSize);
    step = "base";
  }

  function selectOption(o: BaseHoneyOption) {
    option = o;
    step = "mix";
  }

  function setJarSize(size: JarSize) {
    jarSize = size;
    if (goal) doses = presetDoses(goal, size);
  }

  function increment(key: AdditiveKey) {
    if (doses[key] >= MAX_DOSE) return;
    doses = { ...doses, [key]: doses[key] + 1 };
  }

  function decrement(key: AdditiveKey) {
    if (doses[key] <= 0) return;
    doses = { ...doses, [key]: doses[key] - 1 };
  }

  function onDragStart(event: DragEvent, key: AdditiveKey) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", key);
    event.dataTransfer.effectAllowed = "copy";
  }

  function onDragOver(event: DragEvent) {
    if (!event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dragging = true;
  }

  function onDragLeave() {
    dragging = false;
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    const key = event.dataTransfer?.getData("text/plain");
    if (isAdditiveKey(key) && doses[key] < MAX_DOSE) {
      increment(key);
      dropCount++;
    }
  }

  function makeConfetti() {
    const colors = ["#eab308", "#d97706", "#a3a380", "#78716c", "#f5d565", "#b45309"];
    return Array.from({ length: 42 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.7}s`,
      duration: `${2.4 + Math.random() * 1.8}s`,
      color: colors[i % colors.length],
      size: `${6 + Math.random() * 7}px`,
    }));
  }

  function goToDone() {
    confetti = makeConfetti();
    step = "done";
  }

  function reset() {
    goal = null;
    option = null;
    jarSize = "full";
    doses = zeroDoses();
    confetti = [];
    step = "goal";
  }

  function orderBlend() {
    if (!base || !option) return;
    addBlend({
      baseVariantId: base.variantId,
      productId: base.productId,
      name: base.name,
      variantName: jarSize === "full" ? t(lang, "blends.jarFull") : t(lang, "blends.jarHalf"),
      image: base.image,
      jarSize,
      basePrice: base.price,
      stock: base.stock,
      quantity: 1,
      additives: selectedAdditives.map((k) => {
        const a = additives.get(k);
        if (!a) throw new Error("missing additive");
        return {
          key: k,
          variantId: a.variantId,
          productId: a.productId,
          name: a.label,
          image: a.image,
          qty: doses[k],
          price: a.price,
          stock: a.stock,
        };
      }),
    });
    openDrawer();
  }

  function currentStepLabel(): string {
    if (step === "goal") return t(lang, "blends.stepGoal");
    if (step === "base") return t(lang, "blends.stepBase");
    if (step === "mix") return t(lang, "blends.stepMix");
    return t(lang, "blends.stepDone");
  }

  function goalName(g: BlendGoal): string {
    return lang === "en" ? g.nameEn : g.nameAr;
  }

  function honeyName(o: BaseHoneyOption): string {
    return lang === "en" ? o.nameEn : o.nameAr;
  }

  function stepLabel(key: (typeof stepKeys)[number]): string {
    if (key === "goal") return t(lang, "blends.stepGoal");
    if (key === "base") return t(lang, "blends.stepBase");
    if (key === "mix") return t(lang, "blends.stepMix");
    return t(lang, "blends.stepDone");
  }

  const jarLabel = $derived(
    jarSize === "full" ? t(lang, "blends.jarFull") : t(lang, "blends.jarHalf"),
  );
</script>

<svelte:head>
  <title>{t(lang, "blends.pageTitle")}</title>
</svelte:head>

<section class="blend-bg relative overflow-hidden">
  <div
    aria-hidden="true"
    class="pointer-events-none absolute -top-28 -start-28 size-96 rounded-full bg-honey-300/60 blur-3xl"
  ></div>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute -bottom-36 -end-28 size-[28rem] rounded-full bg-clay-200/50 blur-3xl"
  ></div>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute start-1/2 top-1/3 size-72 -translate-x-1/2 rounded-full bg-gold-300/30 blur-3xl"
  ></div>
  <div class="relative z-10 mx-auto max-w-6xl px-4 py-14 sm:px-6">
    <div class="text-center">
      <p class="eyebrow mb-3">{t(lang, "blends.eyebrow")}</p>
      <h1 class="headline text-4xl sm:text-5xl">{t(lang, "blends.title")}</h1>
      <p class="mx-auto mt-4 max-w-xl text-cocoa-600">{t(lang, "blends.subtitle")}</p>
    </div>

    <!-- Step indicator -->
    <nav aria-label="steps" class="mt-10 flex items-center justify-center gap-2 sm:gap-3">
      {#each stepKeys as key, i (key)}
        <button
          class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors"
          class:bg-ink-950={step === key}
          class:text-parchment={step === key}
          class:bg-cocoa-100={step !== key}
          class:text-cocoa-500={step !== key}
          onclick={() => (i < stepIndex(step) ? (step = key) : undefined)}
          disabled={i > stepIndex(step)}
        >
          <span
            class="grid size-6 place-items-center rounded-full text-xs font-bold"
            class:bg-honey-400={i < stepIndex(step) || step === key}
            class:text-ink-950={i < stepIndex(step) || step === key}
            class:bg-cocoa-200={i >= stepIndex(step) && step !== key}
            class:text-cocoa-500={i >= stepIndex(step) && step !== key}
          >
            {i < stepIndex(step) ? "✓" : i + 1}
          </span>
          <span class="hidden sm:inline">{stepLabel(key)}</span>
        </button>
      {/each}
    </nav>

    <!-- STEP 1: goal -->
    {#if step === "goal"}
      <div
        in:fly={{ y: 16, duration: 400 }}
        out:fade={{ duration: 200 }}
        class="mt-8"
      >
        <div class="mx-auto w-full max-w-[340px] sm:max-w-[500px] lg:max-w-[620px]">
          <div
            bind:this={wheelEl}
            role="group"
            aria-label={t(lang, "blends.goalTitle")}
            class="relative aspect-square w-full cursor-grab touch-none select-none active:cursor-grabbing"
            onpointerdown={wheelDown}
            onpointermove={wheelMove}
            onpointerup={wheelUp}
            onpointercancel={wheelUp}
          >
            <div
              class="pointer-events-none absolute inset-[14%] rounded-full border-2 border-dashed border-honey-400/40"
              aria-hidden="true"
            ></div>
            <div class="absolute inset-0" style="transform: rotate({spin}deg)">
              {#each BLEND_GOALS as g, i (g.id)}
                {@const mainGoalImg = additives.get(g.recommended[0])?.image ?? ""}
                {@const angle = (i * 360) / BLEND_GOALS.length - 90}
                {@const rad = (angle * Math.PI) / 180}
                {@const left = 50 + 36 * Math.cos(rad)}
                {@const top = 50 + 36 * Math.sin(rad)}
                <div
                  class="wheel-card absolute w-28 hover:z-30 sm:w-44 lg:w-52 {i === topIndex ? 'z-20' : 'z-10'}"
                  style="--i:{i}; left:{left}%; top:{top}%; transform: translate(-50%, -50%) rotate({-spin}deg)"
                >
                  <button
                    onclick={() => {
                      if (suppressClick) return;
                      selectGoal(g);
                    }}
                    class="group relative w-full overflow-hidden rounded-3xl border-2 bg-parchment text-center shadow-warm-sm transition-all duration-300 hover:scale-110 hover:border-honey-400 hover:shadow-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-honey-400 {i === topIndex
                      ? 'border-honey-400 ring-2 ring-honey-400/60'
                      : 'border-parchment'}"
                  >
                    <div class="aspect-[4/3] w-full overflow-hidden bg-cocoa-100">
                      <img
                        src={mainGoalImg}
                        alt={goalName(g)}
                        class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div
                      class="pointer-events-none absolute inset-0 bg-cocoa-900/45"
                      aria-hidden="true"
                    ></div>
                    <span
                      class="headline absolute inset-x-0 top-1/2 -translate-y-1/2 px-3 text-center text-2xl leading-tight text-parchment drop-shadow-[0_2px_8px_rgba(61,40,10,0.85)] sm:text-3xl"
                    >
                      {goalName(g)}
                    </span>
                  </button>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- STEP 2: base honey + jar size -->
    {#if step === "base"}
      <div
        in:fly={{ y: 16, duration: 400 }}
        out:fade={{ duration: 200 }}
        class="mt-10"
      >
        <div class="mb-6 flex flex-col items-center gap-4">
          <h2 class="text-2xl font-bold text-ink-950">{t(lang, "blends.baseTitle")}</h2>
          <p class="text-sm text-cocoa-500">{t(lang, "blends.baseHint")}</p>
          <div class="flex items-center gap-2 rounded-full bg-cocoa-100 p-1">
            <span class="px-2 text-sm text-cocoa-500">{t(lang, "blends.jarSize")}</span>
            {#each JAR_SIZES as size (size)}
              <button
                class="chip"
                class:chip-active={jarSize === size}
                onclick={() => setJarSize(size)}
              >
                {size === "half" ? t(lang, "blends.jarHalf") : t(lang, "blends.jarFull")}
              </button>
            {/each}
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {#each BASE_HONEY_OPTIONS as o (o.id)}
            {@const opt = baseHoneys.get(o.id)?.[jarSize]}
            <button
              onclick={() => selectOption(o)}
              class="group flex flex-col items-center gap-3 rounded-3xl border border-cocoa-200 bg-parchment p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-honey-400 hover:shadow-lg"
            >
              <div class="relative">
                <img
                  src={opt?.image ?? ""}
                  alt={honeyName(o)}
                  class="size-28 rounded-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <span class="font-bold text-ink-950">{honeyName(o)}</span>
              <span class="text-sm font-semibold text-honey-700">
                {formatEGP(opt?.price ?? 0, lang)}
              </span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- STEP 3: mix -->
    {#if step === "mix" && base}
      <div in:fly={{ y: 16, duration: 400 }} out:fade={{ duration: 200 }} class="mt-10">
        <div class="mb-6 text-center">
          <h2 class="text-2xl font-bold text-ink-950">{t(lang, "blends.mixTitle")}</h2>
          <p class="mt-2 text-sm text-cocoa-500">{t(lang, "blends.mixHint")}</p>
        </div>
        <div class="grid gap-8 lg:grid-cols-2">
          <!-- Additive tray -->
          <div class="rounded-3xl border border-cocoa-200 bg-parchment p-6 shadow-sm">
            <h3 class="mb-4 font-bold text-ink-950">{t(lang, "blends.additivesTitle")}</h3>
            <ul class="flex flex-col gap-3">
              {#each ADDITIVE_KEYS as key (key)}
                {@const a = additives.get(key)}
                <li
                  draggable="true"
                  ondragstart={(e) => onDragStart(e, key)}
                  class="flex items-center gap-4 rounded-2xl border border-cocoa-200 bg-paper px-4 py-3 transition-shadow hover:shadow-md"
                >
                  <img
                    src={a?.image ?? ""}
                    alt={ADDITIVE_LABELS[key][lang]}
                    class="size-12 rounded-xl object-cover"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="flex items-center gap-2 font-semibold text-ink-950">
                      {ADDITIVE_LABELS[key][lang]}
                      {#if recommendedSet.has(key)}
                        <span class="rounded-full bg-honey-100 px-2 py-0.5 text-[10px] font-bold text-honey-800">
                          {t(lang, "blends.recommended")}
                        </span>
                      {/if}
                    </p>
                    <p class="text-xs text-cocoa-500">
                      {a ? formatEGP(a.price, lang) : ""} · {t(lang, "blends.dragHint")}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      aria-label={t(lang, "blends.remove")}
                      class="btn-outline size-9 p-0"
                      disabled={doses[key] <= 0}
                      onclick={() => decrement(key)}
                    >
                      −
                    </button>
                    <span class="w-6 text-center font-bold text-ink-950">{doses[key]}</span>
                    <button
                      aria-label={t(lang, "blends.add")}
                      class="btn-primary size-9 p-0"
                      disabled={doses[key] >= MAX_DOSE}
                      onclick={() => increment(key)}
                    >
                      +
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          </div>

          <!-- Jar drop target -->
          <div
            role="group"
            aria-label={t(lang, "blends.jar")}
            class="relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 transition-colors"
            class:border-honey-400={dragging}
            class:border-cocoa-200={!dragging}
            class:bg-honey-50={dragging}
            class:bg-parchment={!dragging}
            ondragover={onDragOver}
            ondragleave={onDragLeave}
            ondrop={onDrop}
          >
            <span class="mb-3 text-sm font-semibold text-cocoa-500">
              {t(lang, "blends.jar")} · {jarLabel}
            </span>
            {#key dropCount}
              <div class="blend-splash relative">
                <img
                  src={base.image}
                  alt={base.name}
                  class="size-44 rounded-full object-cover shadow-xl animate-float"
                />
              </div>
            {/key}
            {#if selectedAdditives.length > 0}
              <div class="mt-6 flex max-w-xs flex-wrap justify-center gap-2">
                {#each selectedAdditives as key (key)}
                  <button
                    onclick={() => decrement(key)}
                    class="chip chip-active"
                    title={t(lang, "blends.remove")}
                  >
                    {ADDITIVE_LABELS[key][lang]} × {doses[key]}
                  </button>
                {/each}
              </div>
            {:else}
              <p class="mt-6 text-center text-sm text-cocoa-400">
                {t(lang, "blends.dragHint")}
              </p>
            {/if}
          </div>
        </div>

        <!-- Live total -->
        <div class="mt-8 flex flex-col items-center gap-4 rounded-3xl bg-ink-950 p-6 text-parchment sm:flex-row sm:justify-between">
          <div class="text-sm text-cocoa-200">
            <p>
              {base.name} · {jarLabel} — {formatEGP(base.price, lang)}
            </p>
            {#if selectedAdditives.length > 0}
              <p class="mt-1">
                {t(lang, "blends.additivesTotal")} — {formatEGP(additiveTotal, lang)}
              </p>
            {/if}
          </div>
          <div class="flex items-center gap-6">
            <div class="text-center">
              <span class="block text-xs text-cocoa-200">{t(lang, "blends.total")}</span>
              <span class="text-2xl font-bold text-honey-400">{formatEGP(total, lang)}</span>
            </div>
            <button class="btn-primary px-8 py-3 text-base" onclick={goToDone}>
              {t(lang, "blends.seeBlend")}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- STEP 4: done -->
    {#if step === "done" && base}
      <div in:scale={{ start: 0.9, duration: 300 }} out:fade class="relative mt-10">
        {#each confetti as c, i (i)}
          <span
            class="confetti"
            style="left:{c.left};animation-delay:{c.delay};animation-duration:{c.duration};background:{c.color};width:{c.size};height:{c.size};"
          ></span>
        {/each}
        <div class="relative mx-auto max-w-xl rounded-3xl border border-cocoa-200 bg-parchment p-8 text-center shadow-xl">
          <p class="eyebrow mb-2">{t(lang, "blends.stepDone")}</p>
          <h2 class="headline text-3xl">{t(lang, "blends.successTitle")}</h2>
          <p class="mt-3 text-sm text-cocoa-600">{t(lang, "blends.successBody")}</p>

          <div class="mt-8">
            <img
              src={base.image}
              alt={base.name}
              class="mx-auto size-44 rounded-full object-cover shadow-2xl animate-float"
            />
          </div>

          <div class="mt-8 rounded-2xl bg-paper p-5 text-right">
            <h3 class="mb-3 font-bold text-ink-950">{t(lang, "blends.composition")}</h3>
            <ul class="flex flex-col gap-2 text-sm">
              <li class="flex items-center justify-between gap-3">
                <span class="text-cocoa-700">{base.name} · {jarLabel}</span>
                <span class="font-semibold text-ink-950">{formatEGP(base.price, lang)}</span>
              </li>
              {#each selectedAdditives as key (key)}
                {@const a = additives.get(key)}
                <li class="flex items-center justify-between gap-3">
                  <span class="text-cocoa-700">
                    {ADDITIVE_LABELS[key][lang]}
                    <span class="text-cocoa-400">× {doses[key]}</span>
                  </span>
                  <span class="font-semibold text-ink-950">
                    {formatEGP((a?.price ?? 0) * doses[key], lang)}
                  </span>
                </li>
              {/each}
              <li class="mt-2 flex items-center justify-between gap-3 border-t border-cocoa-200 pt-3">
                <span class="font-bold text-ink-950">{t(lang, "blends.total")}</span>
                <span class="text-xl font-bold text-honey-700">{formatEGP(total, lang)}</span>
              </li>
            </ul>
          </div>

          <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button class="btn-primary px-8 py-3 text-base" onclick={orderBlend}>
              {t(lang, "blends.orderBlend")}
            </button>
            <button class="btn-outline px-8 py-3 text-base" onclick={reset}>
              {t(lang, "blends.makeAnother")}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <p class="mt-10 text-center text-sm text-cocoa-600">{currentStepLabel()}</p>
  </div>
</section>

<style>
  .blend-bg {
    background:
      radial-gradient(90% 60% at 12% -5%, rgb(250 204 21 / 0.28), transparent 60%),
      radial-gradient(80% 55% at 95% 5%, rgb(251 224 218 / 0.35), transparent 60%),
      radial-gradient(100% 70% at 50% 110%, rgb(253 186 116 / 0.22), transparent 55%),
      linear-gradient(168deg, #fffbeb 0%, #fef3c7 35%, #fde68a 70%, #fcd34d 100%);
  }

  .wheel-card {
    animation: wheel-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
    animation-delay: calc(var(--i) * 80ms);
  }

  @keyframes wheel-in {
    from {
      transform: translate(-50%, -50%) translateY(28px) scale(0.6);
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%);
      opacity: 1;
    }
  }

  .blend-splash {
    animation: blend-splash 0.5s ease-out;
  }

  @keyframes blend-splash {
    0% {
      transform: scale(0.92);
    }
    50% {
      transform: scale(1.06);
    }
    100% {
      transform: scale(1);
    }
  }

  .confetti {
    position: fixed;
    top: -12px;
    border-radius: 2px;
    z-index: 60;
    pointer-events: none;
    animation-name: confetti-fall;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }

  @keyframes confetti-fall {
    0% {
      transform: translateY(-10vh) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(110vh) rotate(720deg);
      opacity: 0;
    }
  }
</style>