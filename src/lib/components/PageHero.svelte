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
  class={`relative rounded-2xl bg-cream px-5 py-8 sm:px-10 sm:py-12 ${className}`}
>
  <div class="relative">
    {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
    <h1 class="headline mt-2 text-3xl leading-tight text-cocoa-900 sm:text-4xl">{title}</h1>
    {#if subtitle}<p class="mt-3 max-w-xl leading-relaxed text-cocoa-600">{subtitle}</p>{/if}
  </div>
</section>
