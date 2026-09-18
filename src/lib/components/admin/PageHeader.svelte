<script lang="ts">
  let {
    title,
    description,
    actions,
    titleTestId,
  }: {
    title: string;
    description?: string;
    actions?: import("svelte").Snippet;
    titleTestId?: string;
  } = $props();
</script>

<div class="flex flex-wrap items-start justify-between gap-4">
  <div class="min-w-0">
    <div class="mb-3 block h-[3px] w-10 rounded-full bg-honey-600" aria-hidden="true"></div>
    <h1 class="headline text-3xl text-cocoa-900" data-testid={titleTestId}>{title}</h1>
    {#if description}
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-cocoa-500">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex flex-wrap items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
