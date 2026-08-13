<script lang="ts">
  import ProductCard from "$lib/components/ProductCard.svelte";
  import { reveal } from "$lib/actions/reveal.svelte";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function applyQuery(event: SubmitEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLFormElement;
    const q = (target.querySelector<HTMLInputElement>('input[name="q"]')?.value ?? "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (data.filters.category) params.set("category", data.filters.category);
    if (data.filters.sort && data.filters.sort !== "newest") params.set("sort", data.filters.sort);
    goto(`/products${params.size ? `?${params}` : ""}`);
  }

  function selectCategory(slug: string | null) {
    const params = new URLSearchParams();
    if (slug) params.set("category", slug);
    if (data.filters.q) params.set("q", data.filters.q);
    if (data.filters.sort && data.filters.sort !== "newest") params.set("sort", data.filters.sort);
    goto(`/products${params.size ? `?${params}` : ""}`);
  }

  function selectSort(sort: string) {
    const params = new URLSearchParams();
    if (data.filters.q) params.set("q", data.filters.q);
    if (data.filters.category) params.set("category", data.filters.category);
    if (sort !== "newest") params.set("sort", sort);
    goto(`/products${params.size ? `?${params}` : ""}`);
  }
</script>

<svelte:head><title>المتجر — مملكة النحل</title></svelte:head>

<section class="relative mt-6 overflow-hidden rounded-[1.8rem] border border-gold-500/30 bg-ink-950 px-6 py-10 text-parchment shadow-warm">
  <div class="honeycomb-bg absolute inset-0 opacity-25"></div>
  <div class="dot-bg absolute inset-0 opacity-20"></div>
  <div class="relative max-w-xl">
    <p class="wordmark text-lg text-gold-400">مملكة النحل</p>
    <h1 class="headline mt-1 text-4xl leading-tight">متجر العسل الطبيعي</h1>
    <p class="mt-3 text-parchment/70">من مناحلنا إلى بيتك — تصفّح الأصناف، وصنّف حسب ذوقك.</p>
  </div>
</section>

<nav class="mt-6 flex items-center gap-2 text-sm text-cocoa-400" aria-label="مسار التنقل">
  <a href="/" class="transition hover:text-honey-700">الرئيسية</a>
  <span>/</span>
  <span class="text-cocoa-800">المتجر</span>
</nav>

<div class="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
  <form class="flex max-w-sm flex-1 gap-2" role="search" onsubmit={applyQuery}>
    <input type="search" name="q" value={data.filters.q} placeholder="ابحث في المتجر…" aria-label="بحث في المتجر" class="field rounded-full" />
    <button type="submit" class="btn-honey px-5 py-2.5 text-sm">بحث</button>
  </form>
  <label class="text-sm font-medium text-cocoa-700">
    ترتيب
    <select
      class="ms-2 rounded-full border border-cocoa-200 bg-white px-4 py-2 text-sm text-cocoa-900 transition focus:border-honey-500 focus:ring-2 focus:ring-honey-500/25 focus:outline-none"
      value={data.filters.sort}
      onchange={(e) => selectSort((e.currentTarget as HTMLSelectElement).value)}
    >
      <option value="newest">الأحدث</option>
      <option value="price-asc">الأرخص أولاً</option>
      <option value="price-desc">الأغلى أولاً</option>
    </select>
  </label>
</div>

<div class="mt-5 flex flex-wrap gap-2" role="group" aria-label="تصفية حسب الفئة">
  <button
    type="button"
    class="chip"
    class:chip-active={data.filters.category === ""}
    class:border-cocoa-200={data.filters.category !== ""}
    class:bg-white={data.filters.category !== ""}
    class:text-cocoa-700={data.filters.category !== ""}
    onclick={() => selectCategory(null)}
  >الكل</button>
  {#each data.categories as cat (cat.id)}
    <button
      type="button"
      class="chip"
      class:chip-active={data.filters.category === cat.slug}
      class:border-cocoa-200={data.filters.category !== cat.slug}
      class:bg-white={data.filters.category !== cat.slug}
      class:text-cocoa-700={data.filters.category !== cat.slug}
      onclick={() => selectCategory(cat.slug)}
    >{cat.name}</button>
  {/each}
</div>

{#if data.products.length === 0}
  <div class="mt-14 flex flex-col items-center gap-3 text-center">
    <svg width="52" height="58" viewBox="0 0 26 30" fill="none" aria-hidden="true">
      <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke="#ddc5a8" stroke-width="1.6" />
    </svg>
    <p class="text-lg font-semibold text-cocoa-600">لا توجد منتجات مطابقة لبحثك.</p>
    <button type="button" class="btn-outline mt-1 text-sm" onclick={() => selectCategory(null)}>إظهار كل المنتجات</button>
  </div>
{:else}
  <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {#each data.products as product, i (product.id)}
      <div use:reveal={{ delay: i * 40 }}>
        <ProductCard {product} />
      </div>
    {/each}
  </div>
{/if}