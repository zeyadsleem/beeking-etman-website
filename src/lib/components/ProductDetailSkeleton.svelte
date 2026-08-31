<div class="grid gap-8 lg:grid-cols-2">
  <!-- Gallery skeleton -->
  <div class="flex flex-col gap-3">
    <div class="skeleton aspect-square w-full rounded-2xl"></div>
    <div class="flex gap-2">
      {#each Array(4) as _, i (i)}
        <div class="skeleton h-16 w-16 shrink-0 rounded-xl"></div>
      {/each}
    </div>
  </div>

  <!-- Info skeleton -->
  <div class="flex flex-col gap-5">
    <div>
      <div class="skeleton skeleton-text w-16 mb-3"></div>
      <div class="skeleton skeleton-heading w-3/4 h-8"></div>
    </div>

    <div class="flex items-end gap-3">
      <div class="skeleton h-9 w-24"></div>
      <div class="skeleton h-5 w-16 rounded-full"></div>
    </div>

    <div class="flex gap-2">
      {#each Array(3) as _, i (i)}
        <div class="skeleton h-9 w-20 rounded-full"></div>
      {/each}
    </div>

    <div class="space-y-2">
      <div class="skeleton skeleton-text w-full"></div>
      <div class="skeleton skeleton-text w-5/6"></div>
      <div class="skeleton skeleton-text w-2/3"></div>
    </div>

    <div class="flex items-center gap-4 pt-2">
      <div class="skeleton h-10 w-32 rounded-full"></div>
      <div class="skeleton h-12 w-40 rounded-full"></div>
    </div>
  </div>
</div>
