<script lang="ts">
  import { AspectRatio } from "bits-ui";
  import { addToCart } from "$lib/cart-store.svelte";
  import { regularItemPayload } from "$lib/cart";
  import Price from "./Price.svelte";
  import { formatEGP } from "$lib/currency";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { ProductSummary } from "$lib/server/store";

  let { lang = "ar", product }: { lang?: Lang; product: ProductSummary } = $props();

  // The image element whose snapshot morphs into the product page image.
  let imageEl = $state<HTMLImageElement>();

  // Opt the clicked card image into a shared-element view transition BEFORE
  // navigation starts (the element's onclick fires before SvelteKit's nav).
  // The name is applied per-click instead of statically because the same
  // product can appear more than once on a page (featured + rails), and
  // duplicate view-transition-name values would throw InvalidStateError.
  function beginImageTransition() {
    if (!imageEl) return;
    imageEl.style.viewTransitionName = `product-${product.id}`;
    imageEl.style.viewTransitionClass = "product-img";
  }

  function handleAdd() {
    if (product.variants.length === 0) return;
    const v = product.variants[0];
    if (v.stock <= 0) return;
    addToCart(regularItemPayload(product, v));
  }
</script>

<section class="group flex flex-col overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment transition-all duration-300 hover:-translate-y-0.5 hover:border-cocoa-200 hover:shadow-warm">
  <a href={`/products/${product.slug}`} class="relative block overflow-hidden bg-cocoa-100" onclick={beginImageTransition}>
    <AspectRatio.Root ratio={4 / 3} class="overflow-hidden">
      <img
        bind:this={imageEl}
        src={product.variants[0]?.image ?? product.image}
        alt={product.name}
        loading="lazy"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
    </AspectRatio.Root>
    {#if product.variants[0]?.stock === 0}
      <span class="badge-out absolute bottom-4 start-1/2 -translate-x-1/2">{t(lang, "product.outOfStock")}</span>
    {:else if product.variants[0] && product.variants[0].stock <= 5}
      <span class="badge-warn absolute bottom-4 start-1/2 -translate-x-1/2">{t(lang, "product.lowStock")}</span>
    {/if}
  </a>
  <div class="flex flex-1 flex-col gap-2 p-4">
    <h2 class="card-title text-base leading-snug text-cocoa-900">{product.name}</h2>
    <div class="mt-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex w-full flex-col gap-0.5">
        {#if product.variants.length > 1}
          <span class="flex items-center gap-1.5 text-xs font-semibold text-cocoa-400">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-honey-600" aria-hidden="true"></span>
            {t(lang, "product.startsFrom")} {formatEGP(product.minPrice, lang)}
          </span>
          <Price amount={product.minPrice} lang={lang} className="text-lg font-extrabold text-cocoa-900" />
        {:else}
          <Price amount={product.variants[0]?.price ?? 0} lang={lang} className="text-lg font-extrabold text-cocoa-900" />
        {/if}
      </div>
      {#if product.variants.length > 1}
        <a
          href={`/products/${product.slug}`}
          onclick={beginImageTransition}
          class="btn-outline w-full shrink-0 px-4 py-2 sm:w-auto"
          aria-label={t(lang, "product.chooseSizeAria", { name: product.name })}
        >
          {t(lang, "product.chooseSize")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
      {:else}
        <button
          type="button"
          class="btn-primary w-full shrink-0 px-4 py-2 sm:w-auto"
          disabled={product.variants[0]?.stock === 0}
          onclick={handleAdd}
          data-testid="add-to-cart"
        >
          {product.variants[0]?.stock === 0 ? t(lang, "product.unavailable") : t(lang, "product.addToCartShort")}
        </button>
      {/if}
    </div>
  </div>
</section>
