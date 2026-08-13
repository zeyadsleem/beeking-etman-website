<script lang="ts">
  import { addToCart } from "$lib/cart-store.svelte";
  import Price from "./Price.svelte";
  import { formatEGP } from "$lib/currency";
  import type { ProductSummary } from "$lib/server/store";

  let { product }: { product: ProductSummary } = $props();

  function handleAdd() {
    if (product.variants.length === 0) return;
    const v = product.variants[0];
    if (v.stock <= 0) return;
    addToCart({
      variantId: v.id,
      productId: product.id,
      name: product.name,
      variantName: v.name,
      slug: product.slug,
      image: v.image,
      price: v.price,
      stock: v.stock,
    });
  }
</script>

<section class="group flex flex-col overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-warm">
  <a href={`/products/${product.slug}`} class="relative block overflow-hidden bg-honey-100 p-2 pb-0">
    <div class="arch-frame relative aspect-[4/3] overflow-hidden border border-honey-200">
      <img
        src={product.variants[0]?.image ?? product.image}
        alt={product.name}
        loading="lazy"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-cocoa-950/20 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"></div>
    </div>
    {#if product.variants[0]?.stock === 0}
      <span class="badge-stock absolute bottom-4 start-1/2 -translate-x-1/2 bg-cocoa-900/85 text-white">نفدت الكمية</span>
    {:else if product.variants[0] && product.variants[0].stock <= 5}
      <span class="badge-stock absolute bottom-4 start-1/2 -translate-x-1/2 bg-honey-600/95 text-white">كمية محدودة</span>
    {/if}
  </a>
  <div class="flex flex-1 flex-col gap-2 p-4">
    <h2 class="headline text-lg leading-snug text-cocoa-900">{product.name}</h2>
    <div class="mt-auto flex items-center justify-between gap-2">
      <div class="flex flex-col">
        {#if product.variants.length > 1}
          <span class="text-[11px] font-semibold text-cocoa-500">يبدأ من {formatEGP(product.minPrice)}</span>
          <Price amount={product.minPrice} className="text-lg font-extrabold text-honey-800" />
        {:else}
          <Price amount={product.variants[0]?.price ?? 0} className="text-lg font-extrabold text-honey-800" />
        {/if}
      </div>
      <button
        type="button"
        class="rounded-full bg-honey-600 px-4 py-2 text-sm font-semibold text-white shadow-warm-sm transition-all duration-300 hover:bg-honey-500 hover:shadow-warm disabled:cursor-not-allowed disabled:opacity-40"
        disabled={product.variants[0]?.stock === 0 || product.variants.length === 0}
        onclick={handleAdd}
        data-testid="add-to-cart"
      >
        {product.variants[0]?.stock === 0 || product.variants.length === 0 ? "غير متوفر" : "أضف للسلة"}
      </button>
    </div>
  </div>
</section>