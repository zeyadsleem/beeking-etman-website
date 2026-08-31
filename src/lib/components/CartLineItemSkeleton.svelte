<script lang="ts">
  let { drawer = false }: { drawer?: boolean } = $props();
</script>

<li
  class={drawer
    ? "flex gap-3 rounded-xl border border-cocoa-100 bg-paper p-3"
    : "flex gap-4 rounded-2xl border border-cocoa-100 bg-parchment p-4 shadow-warm-sm"}
>
  <div class="skeleton {drawer ? 'h-16 w-16' : 'h-20 w-20 sm:h-24 sm:w-24'} shrink-0 rounded-xl"></div>
  <div class="flex min-w-0 flex-1 flex-col gap-2">
    <div class="flex items-start justify-between gap-2">
      <div class="skeleton skeleton-heading {drawer ? 'w-2/3' : 'w-1/2'}"></div>
      <div class="skeleton h-8 w-8 shrink-0 rounded-full"></div>
    </div>
    <div class="skeleton skeleton-text {drawer ? 'w-1/3' : 'w-2/5'}"></div>
    <div class="mt-auto flex items-center justify-between pt-1.5">
      <div class="skeleton h-8 {drawer ? 'w-24' : 'w-28'} rounded-full"></div>
      <div class="skeleton skeleton-heading {drawer ? 'w-14' : 'w-16'}"></div>
    </div>
  </div>
</li>
