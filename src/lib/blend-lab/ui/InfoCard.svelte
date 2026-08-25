<script lang="ts">
  let {
    title,
    body,
    image,
    priceLabel,
    actionLabel,
    onaction,
  }: {
    title: string;
    body: string;
    image?: string;
    priceLabel?: string;
    actionLabel?: string;
    onaction?: () => void;
  } = $props();
</script>

<article class="rounded-2xl bg-parchment/95 p-4 shadow-xl ring-1 ring-cocoa-900/10 backdrop-blur">
  <div class="flex gap-3">
    {#if image}<img src={image} alt="" class="h-16 w-16 rounded-xl object-cover" />{/if}
    <div class="min-w-0 flex-1">
      <h3 class="headline text-lg font-bold text-cocoa-900">{title}</h3>
      {#if priceLabel}<p class="mt-0.5 text-sm font-semibold text-honey-700">{priceLabel}</p>{/if}
      <p class="mt-1 text-sm leading-relaxed text-cocoa-800">{body}</p>
    </div>
  </div>
  {#if actionLabel}
    <button class="btn-primary mt-3 w-full" onclick={() => onaction?.()}>{actionLabel}</button>
  {/if}
</article>
