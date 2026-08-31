<script lang="ts">
	import { browser } from "$app/environment";
	import BlendGame from "./BlendGame.svelte";
	import Seo from "$lib/components/Seo.svelte";
	import { t } from "$lib/i18n/messages";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<Seo
	title={t(data.lang, "blends.pageTitle")}
	description={t(data.lang, "blends.subtitle")}
	path="/blends"
	siteName={t(data.lang, "brand.name")}
/>

<div class="relative min-h-dvh bg-paper" data-testid="blends-shell">
	{#if !browser}
		<div class="blends-ssr-fallback flex min-h-dvh flex-col items-center justify-center px-6 text-center">
			<h1 class="headline mb-4 text-3xl font-bold text-cocoa-900">.Blend Lab — صمم خليتك الخاصة</h1>
			<p class="mb-6 max-w-lg text-lg leading-relaxed text-cocoa-700">
				اختار عسل الأساس، أضف المكملات اللي تناسبك، واكتب خلطة طبيعية مخصوصة بيك.
				عسل مملكة النحل — من المناحل لحد بابك.
			</p>
			<a href="/products" class="btn-primary px-6 py-3 font-semibold">
				افتح الموقع على موبايلك لتجربة مختبر الخلط
			</a>
		</div>
	{/if}

	<BlendGame {data} />
</div>

<noscript>
	<style>.blends-ssr-fallback { display: flex !important; }</style>
</noscript>
