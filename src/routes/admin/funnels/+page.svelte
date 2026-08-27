<script lang="ts">
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);

  const FUNNEL_STEPS = [
    "product_view",
    "add_to_cart",
    "begin_checkout",
    "purchase",
  ] as const;
</script>

<svelte:head>
  <title>{t(lang, "admin.stats.title")} — Funnels</title>
</svelte:head>

<section class="mx-auto max-w-4xl px-4 py-10">
  <SectionTitle as="h1" className="text-4xl">Purchase Funnel</SectionTitle>

  <div class="mt-8 rounded-2xl border border-cocoa-100 bg-parchment p-8 text-center shadow-warm-sm">
    <p class="text-lg font-semibold text-cocoa-700">
      Connect PostHog to see funnel data
    </p>
    <p class="mt-2 text-sm text-cocoa-500">
      Set <code class="rounded bg-cocoa-100 px-1.5 py-0.5 font-mono text-xs">PUBLIC_POSTHOG_KEY</code>
      in your environment to start collecting analytics events.
    </p>

    <div class="mt-8 flex items-center justify-center gap-3">
      {#each FUNNEL_STEPS as step, i (step)}
        <div class="flex items-center gap-3">
          <div class="rounded-xl border border-cocoa-200 bg-parchment px-4 py-3 text-sm font-semibold text-cocoa-700 shadow-warm-sm">
            {step}
          </div>
          {#if i < FUNNEL_STEPS.length - 1}
            <svg class="h-5 w-5 text-cocoa-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <a href="/admin" class="mt-6 inline-block text-sm font-semibold text-honey-700 hover:underline">
    ← Back to dashboard
  </a>
</section>
