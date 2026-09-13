<script lang="ts">
  import { productPhotos } from "$lib/product-media";
  import { AspectRatio } from "bits-ui";
  import { addToCart } from "$lib/cart-store.svelte";
  import { regularItemPayload } from "$lib/cart";
  import Price from "./Price.svelte";
  import ProductArt from "./ProductArt.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { ProductSummary } from "$lib/server/store";
  import { isPlaceholderImage, productPath } from "$lib/storefront";

  let { lang = "ar", product }: { lang?: Lang; product: ProductSummary } = $props();

  const href = $derived(productPath(product));
  const imageSrc = $derived(productPhotos(product)[0]);
  const stock = $derived(product.variants.reduce((total, variant) => total + variant.stock, 0));

  let imageEl = $state<HTMLImageElement>();
  let added = $state(false);
  let addedTimer: ReturnType<typeof setTimeout> | undefined;

  function beginImageTransition() {
    if (!imageEl) return;
    imageEl.style.viewTransitionName = `product-${product.id}`;
    imageEl.style.viewTransitionClass = "product-img";
  }

  function handleAdd() {
    if (product.variants.length === 0) return;
    const v = product.variants[0];
    if (v.stock <= 0) return;
    addToCart({
      ...regularItemPayload(product, v),
      image: productPhotos(product, v.image)[0] ?? "",
    });
    // Flash the "added" state
    added = true;
    clearTimeout(addedTimer);
    addedTimer = setTimeout(() => {
      added = false;
    }, 1800);
  }
</script>

<section class="group flex flex-col overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment transition-all duration-300 hover:-translate-y-0.5 hover:border-cocoa-200 hover:shadow-warm">
  <a href={href} class="relative block overflow-hidden bg-white" onclick={beginImageTransition}>
    <AspectRatio.Root ratio={4 / 3} class="overflow-hidden">
      {#if isPlaceholderImage(imageSrc)}
        <ProductArt {lang} department={product.department} categorySlug={product.categorySlug} />
      {:else}
        <img
          bind:this={imageEl}
          src={imageSrc}
          alt={product.name}
          loading="lazy"
          class="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105"
        />
      {/if}
    </AspectRatio.Root>
    {#if stock === 0}
      <span class="badge-out absolute bottom-3 start-3 end-3 justify-center text-center">{t(lang, "product.outOfStock")}</span>
    {:else if stock <= 5}
      <span class="badge-warn absolute bottom-3 start-3 end-3 justify-center text-center">{t(lang, "product.lowStock")}</span>
    {/if}
  </a>
  <div class="flex flex-1 flex-col gap-3 p-3 sm:p-4">
    <h2 class="card-title text-sm leading-relaxed text-cocoa-900 sm:text-base"><a href={href}>{product.name}</a></h2>
    <div class="mt-auto flex flex-col gap-3">
      <div class="flex w-full flex-col gap-0.5">
        {#if product.variants.length > 1}
          <span class="flex items-center gap-1.5 text-xs font-semibold text-cocoa-600">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-honey-600" aria-hidden="true"></span>
            {t(lang, "product.startsFrom")}
          </span>
          <Price amount={product.minPrice} lang={lang} className="text-lg font-extrabold text-cocoa-900" />
        {:else}
          <Price amount={product.variants[0]?.price ?? 0} lang={lang} className="text-lg font-extrabold text-cocoa-900" />
        {/if}
      </div>
      {#if product.variants.length > 1}
        <a
          href={href}
          onclick={beginImageTransition}
          class="btn-outline w-full shrink-0 px-4 py-2"
          aria-label={t(lang, "product.chooseSizeAria", { name: product.name })}
        >
          {t(lang, "product.chooseSize")}
           <svg class="shrink-0 rtl:rotate-180" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
      {:else}
        <button
          type="button"
          class="btn-primary w-full shrink-0 px-4 py-2 {added ? '!bg-olive-600 !text-white' : ''}"
          disabled={!product.variants[0] || product.variants[0].stock <= 0}
          onclick={handleAdd}
          data-testid="add-to-cart"
        >
          {#if added}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="animate-added-check">
              <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="24" />
            </svg>
            {t(lang, "product.added")}
          {:else}
            {product.variants[0]?.stock === 0 ? t(lang, "product.unavailable") : t(lang, "product.addToCartShort")}
          {/if}
        </button>
      {/if}
    </div>
  </div>
</section>
