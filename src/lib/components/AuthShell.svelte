<script lang="ts">
  import { type Lang } from "$lib/i18n/messages";
  let { lang = "ar", title, helper, children }: { lang?: Lang; title: string; helper?: string; children: import("svelte").Snippet } = $props();
</script>
<section class="mx-auto my-8 w-full max-w-lg rounded-2xl border border-cocoa-200 bg-parchment px-5 py-8 sm:my-12 sm:px-10 sm:py-10" lang={lang}>
  <h1 class="headline text-3xl text-cocoa-900">{title}</h1>
  {#if helper}<p class="mt-3 text-sm leading-relaxed text-cocoa-600">{helper}</p>{/if}
  <div class="mt-7">{@render children()}</div>
</section>
