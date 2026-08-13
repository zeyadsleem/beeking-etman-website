<script lang="ts">
  let { value, max, onChange }: { value: number; max: number; onChange: (next: number) => void } = $props();
</script>

<div class="inline-flex items-center rounded-full border border-stone-300 bg-white" role="group" aria-label="كمية المنتج">
  <button
    type="button"
    class="px-3 py-1.5 text-honey-700 transition disabled:opacity-30"
    disabled={value >= max}
    onclick={() => onChange(Math.min(value + 1, max))}
    aria-label="زيادة الكمية"
  >+</button>
  <span class="min-w-8 text-center font-semibold" data-testid="quantity">{value}</span>
  <button
    type="button"
    class="px-3 py-1.5 text-honey-700 transition disabled:opacity-30"
    disabled={value <= 1}
    onclick={() => onChange(Math.max(value - 1, 1))}
    aria-label="تقليل الكمية"
  >−</button>
</div>
