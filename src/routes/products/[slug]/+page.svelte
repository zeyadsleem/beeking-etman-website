<script lang="ts">
  import { untrack } from "svelte";
  import Price from "$lib/components/Price.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { addToCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  let selectedVariant = $state(untrack(() => data.product.variants[0]));
  let quantity = $state(1);

  function selectVariant(id: string) {
    const v = data.product.variants.find((x) => x.id === id);
    if (v) {
      selectedVariant = v;
      quantity = 1;
    }
  }

  function handleAdd() {
    addToCart(
      {
        variantId: selectedVariant.id,
        productId: data.product.id,
        name: data.product.name,
        variantName: selectedVariant.name,
        slug: data.product.slug,
        image: selectedVariant.image,
        price: selectedVariant.price,
        stock: selectedVariant.stock,
      },
      quantity,
    );
  }
</script>

<svelte:head><title>{data.product.name} — مملكة النحل</title></svelte:head>

{#key data.product.id}
<nav class="my-6 flex items-center gap-2 text-sm text-cocoa-400" aria-label="مسار التنقل">
  <a href="/" class="transition hover:text-honey-700">الرئيسية</a>
  <span>/</span>
  <a href="/products" class="transition hover:text-honey-700">المتجر</a>
  <span>/</span>
  <span class="text-cocoa-800">{data.product.name}</span>
</nav>

<div class="grid gap-8 lg:grid-cols-2">
  <figure class="relative">
    <div class="absolute -inset-3 rounded-[2.5rem] border border-honey-200"></div>
    <div class="arch-frame-lg relative overflow-hidden border-4 border-gold-500/70 bg-ink-950 shadow-warm-lg">
      {#key selectedVariant.id}
        <img src={selectedVariant.image} alt={data.product.name} class="aspect-square h-full w-full object-cover motion-safe:animate-fade-up" />
      {/key}
    </div>
  </figure>

  <div class="flex flex-col gap-5">
    <div>
      <p class="flex items-center gap-2 text-sm font-bold text-gold-700">
        <svg width="14" height="16" viewBox="0 0 26 30" fill="none" aria-hidden="true">
          <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="#e5a82e" stroke="#96600f" stroke-width="1.6" />
        </svg>
        مملكة النحل — عتمان الأصلي
      </p>
      <h1 class="headline mt-2 text-4xl leading-tight text-cocoa-900">{data.product.name}</h1>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Price amount={selectedVariant.price} className="rounded-full border border-gold-400 bg-ink-950 px-5 py-1.5 text-2xl font-extrabold text-gold-300 shadow-warm-sm" />
      {#if selectedVariant.stock === 0}
        <span class="badge-out">نفدت الكمية</span>
      {:else}
        <span class="badge-neutral">متوفر: {selectedVariant.stock} قطعة</span>
      {/if}
    </div>

    {#if data.product.variants.length > 1}
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="اختيار الحجم">
        <span class="text-sm font-semibold text-cocoa-700">الحجم:</span>
        {#each data.product.variants as v (v.id)}
          <button
            type="button"
            class="chip"
            class:chip-active={selectedVariant.id === v.id}
            class:border-cocoa-200={selectedVariant.id !== v.id}
            class:bg-white={selectedVariant.id !== v.id}
            class:text-cocoa-700={selectedVariant.id !== v.id}
            disabled={v.stock === 0}
            onclick={() => selectVariant(v.id)}
          >
            {v.name}{v.stock === 0 ? " (نفد)" : ""}
          </button>
        {/each}
      </div>
    {/if}

    <p class="leading-relaxed text-cocoa-600">{data.product.description}</p>

    {#if selectedVariant.stock > 0}
      <div class="mt-2 flex flex-wrap items-center gap-4">
        <QuantityPicker value={quantity} max={selectedVariant.stock} onChange={(q) => (quantity = q)} />
        <button
          type="button"
          class="btn-honey"
          onclick={handleAdd}
        >أضف إلى السلة</button>
      </div>
      <p class="text-sm font-semibold text-cocoa-500">إجمالي: {formatEGP(selectedVariant.price * quantity)}</p>
    {/if}

    <div class="mt-4 grid grid-cols-3 gap-3 border-t border-dashed border-cocoa-200 pt-5 text-center">
      <div>
        <svg class="mx-auto h-7 w-7 text-honey-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4.5c2.6 0 4.5 1.9 4.5 4.5h-9C7.5 6.4 9.4 4.5 12 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M7.5 9h9v1.5a4.5 4.5 0 0 1-9 0V9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M12 15v3.5M9.5 18.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <p class="mt-1.5 text-xs font-semibold text-cocoa-700">عسل خام</p>
      </div>
      <div>
        <svg class="mx-auto h-7 w-7 text-honey-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l2.1 4.3 4.7.7-3.4 3.3.8 4.7L12 13.9l-4.2 2.1.8-4.7L5.2 8l4.7-.7L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
        </svg>
        <p class="mt-1.5 text-xs font-semibold text-cocoa-700">بدون إضافات</p>
      </div>
      <div>
        <svg class="mx-auto h-7 w-7 text-honey-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h11v9H3zM14 9h3l3 3v3h-6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <circle cx="7" cy="18.5" r="1.8" stroke="currentColor" stroke-width="1.6" />
          <circle cx="17" cy="18.5" r="1.8" stroke="currentColor" stroke-width="1.6" />
        </svg>
        <p class="mt-1.5 text-xs font-semibold text-cocoa-700">توصيل سريع</p>
      </div>
    </div>
  </div>
</div>

{#if data.related.length > 0}
  <section class="mt-16">
    <SectionTitle className="text-3xl">منتجات مشابهة</SectionTitle>
    <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {#each data.related as product (product.id)}
        <ProductCard {product} />
      {/each}
    </div>
  </section>
{/if}
{/key}