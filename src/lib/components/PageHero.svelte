<script lang="ts">
  let {
    eyebrow,
    title,
    subtitle,
    image,
    class: className = "",
  }: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    image?: string;
    class?: string;
  } = $props();
</script>

<section
  class={`relative overflow-hidden rounded-2xl bg-cream px-5 py-8 sm:px-10 sm:py-12 ${className}`}
>
  {#if image}<img src={image} alt="" class="pointer-events-none absolute inset-y-0 end-0 h-full w-full object-cover opacity-25 sm:w-1/2 sm:opacity-75" loading="lazy" />{/if}
  <div class="relative max-w-xl">
    {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
    <h1 class="headline mt-2 text-3xl leading-tight text-cocoa-900 sm:text-4xl">{title}</h1>
    {#if subtitle}<p class="mt-3 max-w-xl leading-relaxed text-cocoa-600">{subtitle}</p>{/if}
  </div>
</section>
