<script lang="ts">
  let { variant = "grid" }: { variant?: "grid" | "list" } = $props();
</script>

<section class="flex flex-col overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment">
  <div class="skeleton aspect-[4/3] w-full rounded-none"></div>
  <div class="flex flex-1 flex-col gap-2 p-4">
    <div class="skeleton skeleton-heading w-3/4"></div>
    <div class="mt-auto flex items-center justify-between gap-2 pt-1">
      <div class="skeleton skeleton-text w-20"></div>
      <div class="skeleton h-9 w-24 rounded-full"></div>
    </div>
  </div>
</section>
