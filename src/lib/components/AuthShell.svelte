<script lang="ts">
  import { type Lang } from "$lib/i18n/messages";
  let { lang = "ar", title, helper, children }: { lang?: Lang; title: string; helper?: string; children: import("svelte").Snippet } = $props();
</script>
<section class="mx-auto my-12 w-full max-w-lg rounded-2xl border border-cocoa-100 bg-white px-6 py-9 shadow-warm-sm sm:px-10" lang={lang}>
  <h1 class="headline text-3xl text-cocoa-900">{title}</h1>
  {#if helper}<p class="mt-3 text-sm leading-relaxed text-cocoa-500">{helper}</p>{/if}
  <div class="mt-7">{@render children()}</div>
</section>
