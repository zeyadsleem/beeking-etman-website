<script lang="ts">
  import ProductCard from "$lib/components/ProductCard.svelte";
  import CategoryCard from "$lib/components/CategoryCard.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>بيت العسل — متجر العسل الطبيعي</title></svelte:head>

<section class="mt-6 overflow-hidden rounded-3xl bg-gradient-to-l from-honey-600 via-honey-500 to-honey-400 px-8 py-14 text-white">
  <div class="max-w-2xl">
    <p class="mb-3 w-fit rounded-full bg-white/20 px-4 py-1 text-sm font-semibold">من مناحلنا مباشرة إلى بابك</p>
    <h1 class="text-4xl font-extrabold leading-tight sm:text-5xl">عسل طبيعي نقي 100%</h1>
    <p class="mt-4 text-lg text-honey-50">اختر من تشكيلة عسل السدر، زهر البرتقال، والأصناف البرية — بجودة مضمونة وتوصيل سريع لكل المحافظات.</p>
    <a href="/products" class="mt-6 inline-block rounded-full bg-white px-6 py-3 font-bold text-honey-800 transition hover:bg-honey-50">تسوق الآن</a>
  </div>
</section>

<section class="mt-12">
  <div class="flex items-end justify-between">
    <h2 class="text-2xl font-extrabold">اختير لك</h2>
    <a href="/products" class="text-sm font-semibold text-honey-700 hover:underline">كل المنتجات ←</a>
  </div>
  <div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {#each data.featured as product (product.id)}
      <ProductCard {product} />
    {/each}
  </div>
</section>

<section class="mt-12">
  <h2 class="text-2xl font-extrabold">تصفح حسب الفئات</h2>
  <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.categories as cat (cat.id)}
      <CategoryCard name={cat.name} slug={cat.slug} />
    {/each}
  </div>
</section>
