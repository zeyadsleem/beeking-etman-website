<script lang="ts">
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

<div class="relative min-h-dvh bg-cocoa-950" data-testid="blends-shell">
	<BlendGame {data} />
</div>
