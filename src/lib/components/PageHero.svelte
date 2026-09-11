<script lang="ts">
  let {
    eyebrow,
    title,
    subtitle,
    class: className = "",
  }: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    class?: string;
  } = $props();
</script>

<section
  class={`relative overflow-hidden rounded-3xl border border-honey-100 bg-gradient-to-br from-paper via-cream to-cream-deep px-6 py-10 sm:px-10 sm:py-14 ${className}`}
>
  <div class="honeycomb pointer-events-none absolute inset-0"></div>
  <div class="relative">
    {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
    <h1 class="headline mt-2 text-4xl leading-tight text-cocoa-900">{title}</h1>
    {#if subtitle}<p class="mt-3 max-w-xl text-cocoa-500">{subtitle}</p>{/if}
  </div>
</section>
