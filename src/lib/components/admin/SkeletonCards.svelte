<script lang="ts">
  let {
    cards = 3,
  }: {
    cards?: number;
  } = $props();
</script>

<div class="space-y-3" aria-hidden="true">
  {#each Array(cards) as _, i}
    <div class="flex items-center justify-between rounded-2xl border border-cocoa-100 bg-parchment px-5 py-4 shadow-warm-sm">
      <div class="flex items-center gap-3">
        <div class="skeleton h-10 w-10 rounded-full"></div>
        <div class="space-y-2">
          <div class="skeleton-text h-3 w-36"></div>
          <div class="skeleton-text h-3 w-24"></div>
        </div>
      </div>
      <div class="skeleton-text h-4 w-16"></div>
    </div>
  {/each}
</div>
