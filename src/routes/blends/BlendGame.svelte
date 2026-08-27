<script lang="ts">
	import { onDestroy } from "svelte";
	import type { PageData } from "./$types";
	import { BlendsGame, provideBlendsGame } from "$lib/blend-lab/game-state.svelte";
	import { BlendsBridge, type GameSnapshot, type SceneActions } from "$lib/blend-lab/phaser/bridge";
	import { createGame, type CreatedGame } from "$lib/blend-lab/phaser/create-game";
	import StepBar from "$lib/blend-lab/ui/StepBar.svelte";
	import MixSummary from "$lib/blend-lab/ui/MixSummary.svelte";
	import StirOverlay from "$lib/blend-lab/ui/StirOverlay.svelte";
	import InfoCard from "$lib/blend-lab/ui/InfoCard.svelte";
	import OrderPanel from "$lib/blend-lab/ui/OrderPanel.svelte";
	import ActionBar from "$lib/blend-lab/ui/ActionBar.svelte";
	import {
		ADDITIVE_LABELS,
		BASE_HONEY_OPTIONS,
		BLEND_GOALS,
		JAR_SIZES,
		jarLabel,
		type BaseHoneyOption,
	} from "$lib/blends";
	import {
		DEFAULT_ADDITIVE_BENEFITS,
		DEFAULT_HONEY_BENEFITS,
		HONEY_COLORS,
		INGREDIENT_COLORS,
	} from "$lib/blend-lab/benefits";
	import { blendUnitPrice } from "$lib/blend-lab/pricing";
	import { t } from "$lib/i18n/messages";

	let { data }: { data: PageData } = $props();

	const game = new BlendsGame();
	provideBlendsGame(game);

	let booted = $state(false);
	let bootError = $state<string | null>(null);
	let inspectedHoneyId = $state<BaseHoneyOption["id"] | null>(null);
	let canvasHost: HTMLDivElement | undefined = $state();
	let destroyGame: (() => void) | null = null;

	const bridge = new BlendsBridge(readSnapshot());

	function readSnapshot(): GameSnapshot {
		return {
			step: game.step,
			honeyId: game.honeyId,
			jarSize: game.jarSize,
			doses: { ...game.doses },
			jarFill: game.jarFill,
			mixProgress: game.mixProgress,
		};
	}

	const actions: SceneActions = {
		selectGoal: (id) => {
			const goal = BLEND_GOALS.find((g) => g.id === id);
			if (goal) game.selectGoal(goal.id);
		},
		selectHoney: (id) => {
			const option = BASE_HONEY_OPTIONS.find((o) => o.id === id);
			if (option) game.selectHoney(option.id);
		},
		addDose: (key) => game.addDose(key),
		removeDose: (key) => game.removeDose(key),
		startStir: () => game.startStir(),
		forceFinishStir: () => game.forceFinishStir(),
		recordStir: (deltaRadians) => game.recordStir(deltaRadians),
		setJarFill: (value) => game.setJarFill(value),
		completePour: () => game.completePour(),
		reset: () => game.reset(),
	};

	const baseMap = $derived(new Map(data.baseHoneys));
	const additiveMap = $derived(new Map(data.additives));
	const unitPrice = $derived(
		blendUnitPrice(data.baseHoneys, data.additives, game.honeyId, game.jarSize, game.doses),
	);

	const honeyInspection = $derived(
		game.step === "honey" && inspectedHoneyId !== null ? inspectedHoneyId : null,
	);
	const additiveInspection = $derived(game.step === "prep" ? game.inspected : null);
	const honeyInspectionOption = $derived(
		honeyInspection === null
			? null
			: (BASE_HONEY_OPTIONS.find((o) => o.id === honeyInspection) ?? null),
	);

	$effect(() => {
		if (game.step !== "honey") inspectedHoneyId = null;
	});

	$effect(() => {
		bridge.setSnapshot(readSnapshot());
	});

	const stopListening = bridge.on((event) => {
		if (event.type === "inspectHoney") {
			inspectedHoneyId = BASE_HONEY_OPTIONS.find((o) => o.id === event.id)?.id ?? null;
		} else if (event.type === "inspectAdditive") {
			game.setInspected(event.key);
		}
	});

	$effect(() => {
		const container = canvasHost;
		if (!container || destroyGame !== null) return;
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let cancelled = false;
		createGame({ container, bridge, actions, reducedMotion })
			.then((created: CreatedGame) => {
				if (cancelled) {
					created.destroy();
					return;
				}
				destroyGame = created.destroy;
				booted = true;
				bridge.setSnapshot(readSnapshot());
			})
			.catch((error: unknown) => {
				bootError = error instanceof Error ? error.message : String(error);
			});
		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		stopListening();
		destroyGame?.();
		destroyGame = null;
		bridge.clear();
	});
</script>

<div
	class="blends-scene relative h-dvh w-full overflow-hidden bg-cocoa-950"
	data-testid="blends-scene"
>
	<div class="absolute inset-0" bind:this={canvasHost}></div>

	{#if !booted && !bootError}
		<div class="absolute inset-0 grid place-items-center" data-testid="blends-boot-spinner">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-honey-500 border-t-transparent"
			></div>
		</div>
	{/if}

	{#if bootError}
		<div class="absolute inset-0 grid place-items-center p-6" data-testid="blends-boot-error">
			<div class="max-w-md rounded-xl bg-white/95 p-6 text-center shadow-xl">
				<p class="mb-4 font-semibold text-cocoa-900">
					{t(data.lang, "blends.game.bootError")}
				</p>
				<a class="btn-primary" href="/products">{t(data.lang, "nav.store")}</a>
			</div>
		</div>
	{/if}

	<div
		class="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-2 p-4"
	>
		<h1 class="text-2xl font-bold text-honey-100 drop-shadow">{t(data.lang, "blends.game.title")}</h1>
		<div class="pointer-events-auto"><StepBar lang={data.lang} /></div>
	</div>

	<div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-6">
		<div class="pointer-events-auto w-[min(94vw,30rem)]">
			{#if game.step === "prep" || game.step === "stir"}
				<MixSummary lang={data.lang} {unitPrice} />
			{/if}
		</div>
	</div>

	{#if game.step === "pour"}
		<div class="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center">
			<span
				class="rounded-full bg-black/60 px-4 py-2 text-sm text-honey-100"
				data-testid="blends-pour-hint"
			>
				{t(data.lang, "blends.game.pour.title")}
			</span>
		</div>
	{/if}

	<StirOverlay lang={data.lang} />

	{#if honeyInspectionOption}
		<div
			class="pointer-events-auto absolute bottom-24 start-1/2 z-20 w-[min(92vw,26rem)] -translate-x-1/2 rtl:translate-x-1/2"
			data-testid="honey-info-card"
		>
			<div class="mb-2 flex gap-2">
				{#each JAR_SIZES as size (size)}
					<button
						type="button"
						class="btn-outline flex-1"
						class:bg-honey-500={game.jarSize === size}
						onclick={() => game.setJarSize(size)}
					>
						{jarLabel(data.lang, size)}
					</button>
				{/each}
			</div>
			<InfoCard
				title={data.lang === "ar" ? honeyInspectionOption.nameAr : honeyInspectionOption.nameEn}
				body={(data.honeyBenefits ?? DEFAULT_HONEY_BENEFITS)[honeyInspectionOption.id][data.lang]}
				actionLabel={t(data.lang, "blends.game.honey.viewBenefits")}
				onaction={() => game.selectHoney(honeyInspectionOption.id)}
			/>
		</div>
	{/if}

	{#if additiveInspection}
		<div
			class="pointer-events-auto absolute bottom-24 start-1/2 z-20 w-[min(92vw,26rem)] -translate-x-1/2 rtl:translate-x-1/2"
			data-testid="ingredient-info-card"
		>
			<InfoCard
				title={ADDITIVE_LABELS[additiveInspection][data.lang]}
				body={(data.additiveBenefits ?? DEFAULT_ADDITIVE_BENEFITS)[additiveInspection][data.lang]}
				actionLabel={t(data.lang, "blends.game.benefits.title")}
				onaction={() => game.setInspected(null)}
			/>
		</div>
	{/if}

	<ActionBar lang={data.lang} />

	{#if game.step === "order"}
		<OrderPanel
			lang={data.lang}
			baseHoneys={baseMap}
			additives={additiveMap}
			blendImage={data.blendImage}
		/>
	{/if}
</div>

<style>
	.blends-scene,
	.blends-scene :global(canvas) {
		touch-action: none;
	}
</style>
