<script lang="ts">
  import { t, type Lang } from "$lib/i18n/messages";

  let {
    lang = "ar",
    value,
    max,
    onChange,
  }: { lang?: Lang; value: number; max: number; onChange: (next: number) => void } = $props();
</script>

<div
  class="inline-flex items-center overflow-hidden rounded-full border border-cocoa-200 bg-parchment"
  role="group"
  aria-label={t(lang, "qty.group")}
>
  <button
    type="button"
    class="px-3 py-1.5 text-lg font-bold text-cocoa-700 transition hover:bg-cocoa-50 disabled:opacity-30 disabled:hover:bg-transparent"
    disabled={value >= max}
    onclick={() => onChange(Math.min(value + 1, max))}
    aria-label={t(lang, "qty.increase")}
  >+</button>
  <span class="min-w-9 border-x border-cocoa-100 bg-parchment text-center font-bold text-cocoa-900" data-testid="quantity">{value}</span>
  <button
    type="button"
    class="px-3 py-1.5 text-lg font-bold text-cocoa-700 transition hover:bg-cocoa-50 disabled:opacity-30 disabled:hover:bg-transparent"
    disabled={value <= 1}
    onclick={() => onChange(Math.max(value - 1, 1))}
    aria-label={t(lang, "qty.decrease")}
  >−</button>
</div>