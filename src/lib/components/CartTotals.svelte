<script lang="ts">
  import { formatEGP } from "$lib/currency";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { CartTotals } from "$lib/cart";

  let { totals, lang, itemCount }: { totals: CartTotals; lang: Lang; itemCount?: number } = $props();
</script>

<dl class="mt-4 space-y-2 text-sm text-cocoa-700">
  {#if itemCount !== undefined}
    <div class="flex justify-between">
      <dt>{t(lang, "cart.itemCount")}</dt>
      <dd class="font-semibold">{itemCount}</dd>
    </div>
  {/if}
  <div class="flex justify-between">
    <dt>{t(lang, "cart.subtotal")}</dt>
    <dd class="font-semibold">{formatEGP(totals.subtotal, lang)}</dd>
  </div>
  <div class="flex justify-between">
    <dt>{t(lang, "cart.shipping")}</dt>
    <dd class="font-semibold">{totals.shipping === 0 ? t(lang, "cart.free") : formatEGP(totals.shipping, lang)}</dd>
  </div>
  <div class="mt-3 flex justify-between border-t border-cocoa-100 pt-3 text-base font-extrabold text-cocoa-900">
    <dt>{t(lang, "cart.total")}</dt>
    <dd>{formatEGP(totals.total, lang)}</dd>
  </div>
</dl>