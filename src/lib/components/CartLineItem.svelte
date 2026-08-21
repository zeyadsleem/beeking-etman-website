<script lang="ts">
  import QuantityPicker from "./QuantityPicker.svelte";
  import Price from "./Price.svelte";
  import { formatEGP } from "$lib/currency";
  import { closeDrawer, removeFromCart, setQuantity } from "$lib/cart-store.svelte";
  import { isBlendItem, itemId, lineTotal } from "$lib/cart";
  import { blendLineDetail } from "$lib/blends";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { CartItem } from "$lib/cart";

  let { item, lang, size = "page" }: { item: CartItem; lang: Lang; size?: "drawer" | "page" } = $props();

  const isDrawer = $derived(size === "drawer");
  const itemHref = $derived(isBlendItem(item) ? "/blends" : `/products/${item.slug}`);
  const removeButton = $derived(
    isDrawer ? "grid h-8 w-8 place-items-center rounded-full" : "grid h-9 w-9 place-items-center rounded-full",
  );
  const detailClass = $derived(
    isDrawer ? "mt-0.5 line-clamp-2 text-[11px] font-medium" : "line-clamp-2 text-sm font-medium",
  );
</script>

<li
  class={isDrawer
    ? "flex gap-3 rounded-xl border border-cocoa-100 bg-paper p-3"
    : "flex gap-4 rounded-2xl border border-cocoa-100 bg-parchment p-4 shadow-warm-sm"}
>
  <a
    href={itemHref}
    onclick={isDrawer ? closeDrawer : undefined}
    class={isDrawer
      ? "w-16 shrink-0 self-stretch overflow-hidden rounded-xl border border-cocoa-200 bg-cocoa-100"
      : "w-20 shrink-0 self-stretch overflow-hidden rounded-xl border border-cocoa-100 bg-cocoa-100 sm:w-24"}
  >
    <img src={item.image} alt={item.name} class="h-full w-full object-cover" />
  </a>
  <div class="flex min-w-0 flex-1 flex-col gap-1.5">
    <div class="flex items-start justify-between gap-2">
      <a
        href={itemHref}
        onclick={isDrawer ? closeDrawer : undefined}
        class={isDrawer
          ? "line-clamp-1 text-sm font-semibold text-cocoa-800 transition-colors hover:text-honey-700"
          : "card-title text-base leading-snug text-cocoa-900 hover:text-honey-700"}
      >
        {item.name}
      </a>
      <button
        type="button"
        class="{removeButton} shrink-0 text-cocoa-400 transition-colors hover:bg-clay-50 hover:text-clay-600"
        onclick={() => removeFromCart(itemId(item))}
        aria-label={t(lang, "cart.remove")}
      >
        <svg width={isDrawer ? 15 : 17} height={isDrawer ? 15 : 17} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    {#if isBlendItem(item)}
      <span class="{detailClass} text-cocoa-500">
        {blendLineDetail(item.variantName, item.additives)}
      </span>
    {:else}
      <span class="{detailClass} text-cocoa-500">
        {isDrawer
          ? item.variantName
          : t(lang, "cart.itemLine", { variantName: item.variantName, price: formatEGP(item.price, lang) })}
      </span>
    {/if}
    <div class="mt-auto flex items-center justify-between gap-2 pt-1.5">
      {#if isBlendItem(item)}
        <span class="text-xs text-cocoa-500">× 1</span>
      {:else}
        <QuantityPicker lang={lang} value={item.quantity} max={item.stock} onChange={(q) => setQuantity(item.variantId, q)} />
      {/if}
      <Price amount={lineTotal(item)} lang={lang} className={isDrawer ? "text-sm font-bold text-cocoa-900" : "text-lg font-extrabold text-cocoa-900"} />
    </div>
  </div>
</li>