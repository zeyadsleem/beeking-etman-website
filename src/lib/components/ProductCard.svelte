<script lang="ts">
  import { addToCart } from "$lib/cart-store.svelte";
  import Price from "./Price.svelte";
  import type { ProductSummary } from "$lib/server/store";

  let { product }: { product: Pick<ProductSummary, "id" | "name" | "slug" | "price" | "stock" | "image"> } = $props();

  function handleAdd() {
    if (product.stock <= 0) return;
    addToCart({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: product.image,
      price: product.price,
      stock: product.stock,
    });
  }
</script>

<section class="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md">
  <a href={`/products/${product.slug}`} class="relative block aspect-[4/3] overflow-hidden bg-honey-100">
    <img
      src={product.image}
      alt={product.name}
      loading="lazy"
      class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
    />
    {#if product.stock === 0}
      <span class="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-stone-900/80 px-3 py-1 text-xs font-semibold text-white">نفدت الكمية</span>
    {:else if product.stock <= 5}
      <span class="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-honey-600/90 px-3 py-1 text-xs font-semibold text-white">كمية محدودة</span>
    {/if}
  </a>
  <div class="flex flex-1 flex-col gap-2 p-4">
    <h2 class="font-bold leading-snug">{product.name}</h2>
    <div class="mt-auto flex items-center justify-between gap-2">
      <Price amount={product.price} className="text-lg font-extrabold text-honey-800" />
      <button
        type="button"
        class="rounded-full bg-honey-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-honey-700 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={product.stock === 0}
        onclick={handleAdd}
      >
        {product.stock === 0 ? "غير متوفر" : "أضف للسلة"}
      </button>
    </div>
  </div>
</section>
