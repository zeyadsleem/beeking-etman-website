<script lang="ts">
  let { value, max, onChange }: { value: number; max: number; onChange: (next: number) => void } = $props();
</script>

<div
  class="inline-flex items-center overflow-hidden rounded-full border border-honey-200 bg-parchment shadow-warm-sm"
  role="group"
  aria-label="كمية المنتج"
>
  <button
    type="button"
    class="px-3 py-1.5 text-lg font-bold text-honey-700 transition hover:bg-honey-100 disabled:opacity-30 disabled:hover:bg-transparent"
    disabled={value >= max}
    onclick={() => onChange(Math.min(value + 1, max))}
    aria-label="زيادة الكمية"
  >+</button>
  <span class="min-w-9 border-x border-honey-100 bg-white text-center font-bold text-cocoa-900" data-testid="quantity">{value}</span>
  <button
    type="button"
    class="px-3 py-1.5 text-lg font-bold text-honey-700 transition hover:bg-honey-100 disabled:opacity-30 disabled:hover:bg-transparent"
    disabled={value <= 1}
    onclick={() => onChange(Math.max(value - 1, 1))}
    aria-label="تقليل الكمية"
  >−</button>
</div>