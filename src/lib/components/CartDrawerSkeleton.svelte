<script lang="ts">
  import CartLineItemSkeleton from "./CartLineItemSkeleton.svelte";
  let { count = 3 }: { count?: number } = $props();
</script>

<ul class="flex-1 space-y-4 overflow-y-auto p-4">
  {#each Array(count) as _, i (i)}
    <CartLineItemSkeleton drawer />
  {/each}
</ul>

<footer class="border-t border-cocoa-200 bg-paper p-4">
  <div class="mb-3 flex justify-between">
    <div class="skeleton skeleton-text w-20"></div>
    <div class="skeleton skeleton-text w-14"></div>
  </div>
  <div class="skeleton h-10 w-full rounded-full"></div>
</footer>
