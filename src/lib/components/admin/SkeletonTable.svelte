<script lang="ts">
  let {
    rows = 5,
  }: {
    rows?: number;
  } = $props();
</script>

<div class="overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm" aria-hidden="true">
  <div class="grid grid-cols-4 gap-4 border-b border-cocoa-100 px-5 py-4">
    {#each Array(4) as _, i}
      <div class="skeleton-text h-3 w-3/4"></div>
    {/each}
  </div>
  {#each Array(rows) as _, i}
    <div class="grid grid-cols-4 items-center gap-4 border-b border-cocoa-50 px-5 py-4 last:border-0">
      <div class="skeleton-text h-4 w-2/3"></div>
      <div class="skeleton-text h-4 w-1/2"></div>
      <div class="skeleton-text h-4 w-3/4"></div>
      <div class="skeleton-text h-4 w-1/2"></div>
    </div>
  {/each}
</div>
