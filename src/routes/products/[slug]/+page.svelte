<script lang="ts">
  import Price from "$lib/components/Price.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import { addToCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let quantity = $state(1);

  function handleAdd() {
    addToCart(
      {
        productId: data.product.id,
        name: data.product.name,
        slug: data.product.slug,
        image: data.product.image,
        price: data.product.price,
        stock: data.product.stock,
      },
      quantity,
    );
  }
</script>

<svelte:head><title>{data.product.name} — بيت العسل</title></svelte:head>

<nav class="my-6 flex items-center gap-2 text-sm text-stone-500">
  <a href="/" class="hover:text-honey-700">الرئيسية</a>
  <span>/</span>
  <a href="/products" class="hover:text-honey-700">المتجر</a>
  <span>/</span>
  <span class="text-stone-800">{data.product.name}</span>
</nav>

<div class="grid gap-8 lg:grid-cols-2">
  <div class="aspect-square overflow-hidden rounded-3xl bg-honey-100">
    <img src={data.product.image} alt={data.product.name} class="h-full w-full object-cover" />
  </div>

  <div class="flex flex-col gap-5">
    <div>
      <p class="text-sm font-semibold text-honey-700">بيت العسل</p>
      <h1 class="mt-1 text-3xl font-extrabold leading-tight">{data.product.name}</h1>
    </div>
    <Price amount={data.product.price} className="text-3xl font-extrabold text-honey-800" />
    {#if data.product.stock === 0}
      <p class="w-fit rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">نفدت الكمية</p>
    {:else}
      <p class="text-sm text-stone-500">متوفر: {data.product.stock} قطعة</p>
    {/if}
    <p class="leading-relaxed text-stone-600">{data.product.description}</p>

    {#if data.product.stock > 0}
      <div class="flex items-center gap-3">
        <QuantityPicker value={quantity} max={data.product.stock} onChange={(q) => (quantity = q)} />
        <button
          type="button"
          class="rounded-full bg-honey-600 px-6 py-3 font-semibold text-white transition hover:bg-honey-700"
          onclick={handleAdd}
        >أضف إلى السلة</button>
      </div>
      <p class="text-xs text-stone-400">إجمالي: {formatEGP(data.product.price * quantity)}</p>
    {/if}
  </div>
</div>

{#if data.related.length > 0}
  <section class="mt-16">
    <h2 class="text-2xl font-extrabold">منتجات مشابهة</h2>
    <div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {#each data.related as product (product.id)}
        <ProductCard {product} />
      {/each}
    </div>
  </section>
{/if}
