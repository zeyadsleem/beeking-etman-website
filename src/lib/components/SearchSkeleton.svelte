<div class="space-y-2 p-3">
  {#each Array(4) as _, i (i)}
    <div class="flex items-center gap-3 rounded-xl px-3 py-2.5">
      <div class="skeleton h-9 w-9 shrink-0 rounded-lg"></div>
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <div class="skeleton skeleton-text w-3/5"></div>
        <div class="skeleton skeleton-text w-1/4"></div>
      </div>
    </div>
  {/each}
</div>
