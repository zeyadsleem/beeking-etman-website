<script lang="ts">
  import { Separator } from "bits-ui";
  import { t, type Lang } from "$lib/i18n/messages";

  let {
    items,
    lang = "ar",
    className = "",
  }: {
    items: { label: string; href?: string }[];
    lang?: Lang;
    className?: string;
  } = $props();
</script>

<nav class={`flex items-center gap-2 text-sm text-cocoa-400 ${className}`} aria-label={t(lang, "breadcrumb.nav")}>
  {#each items as item, i (item.label)}
    {#if i > 0}
      <Separator.Root orientation="vertical" decorative class="h-4 w-px bg-cocoa-200" />
    {/if}
    {#if item.href}
      <a href={item.href} class="transition hover:text-honey-700">{item.label}</a>
    {:else}
      <span class="text-cocoa-800" aria-current="page">{item.label}</span>
    {/if}
  {/each}
</nav>