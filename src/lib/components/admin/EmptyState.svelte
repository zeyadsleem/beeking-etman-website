<script lang="ts">
  let {
    title,
    description,
    icon,
    actions,
  }: {
    title: string;
    description?: string;
    icon?: import("svelte").Component;
    actions?: import("svelte").Snippet;
  } = $props();

  const Icon = $derived(icon);
</script>

<div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cocoa-200 bg-parchment/60 px-6 py-16 text-center">
  {#if icon}
    <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-honey-50 text-honey-600">
      {#if Icon}
        <Icon class="h-6 w-6" strokeWidth={1.8} />
      {/if}
    </span>
  {/if}
  <p class="mt-4 font-semibold text-cocoa-800">{title}</p>
  {#if description}
    <p class="mt-1 max-w-sm text-sm leading-relaxed text-cocoa-500">{description}</p>
  {/if}
  {#if actions}
    <div class="mt-5">
      {@render actions()}
    </div>
  {/if}
</div>
