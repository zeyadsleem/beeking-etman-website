<script lang="ts">
  import ProductCard from "$lib/components/ProductCard.svelte";
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

<svelte:head><title>المتجر — بيت العسل</title></svelte:head>

<div class="mt-6">
  <nav class="mb-5 flex items-center gap-2 text-sm text-stone-500">
    <a href="/" class="hover:text-honey-700">الرئيسية</a>
    <span>/</span>
    <span class="text-stone-800">المتجر</span>
  </nav>

  <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <form class="flex max-w-sm flex-1 gap-2" role="search" onsubmit={applyQuery}>
      <input
        type="search"
        name="q"
        value={data.filters.q}
        placeholder="ابحث في المتجر…"
        class="w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-honey-500 focus:ring-honey-500"
      />
      <button type="submit" class="rounded-full bg-honey-600 px-5 py-2 text-sm font-semibold text-white">بحث</button>
    </form>
    <label class="text-sm text-stone-600">
      ترتيب
      <select
        class="ms-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-honey-500 focus:ring-honey-500"
        value={data.filters.sort}
        onchange={(e) => selectSort((e.currentTarget as HTMLSelectElement).value)}
      >
        <option value="newest">الأحدث</option>
        <option value="price-asc">الأرخص أولاً</option>
        <option value="price-desc">الأغلى أولاً</option>
      </select>
    </label>
  </div>

  <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="تصفية حسب الفئة">
    <button
      type="button"
      class="rounded-full border px-4 py-1.5 text-sm transition hover:border-honey-500"
      class:bg-honey-600={data.filters.category === ""}
      class:text-white={data.filters.category === ""}
      class:border-transparent={data.filters.category === ""}
      class:border-stone-300={data.filters.category !== ""}
      class:bg-white={data.filters.category !== ""}
      onclick={() => selectCategory(null)}
    >الكل</button>
    {#each data.categories as cat (cat.id)}
      <button
        type="button"
        class="rounded-full border px-4 py-1.5 text-sm transition hover:border-honey-500"
        class:bg-honey-600={data.filters.category === cat.slug}
        class:text-white={data.filters.category === cat.slug}
        class:border-transparent={data.filters.category === cat.slug}
        class:border-stone-300={data.filters.category !== cat.slug}
        class:bg-white={data.filters.category !== cat.slug}
        onclick={() => selectCategory(cat.slug)}
      >{cat.name}</button>
    {/each}
  </div>

  {#if data.products.length === 0}
    <div class="mt-16 text-center text-stone-500">لا توجد منتجات مطابقة لبحثك.</div>
  {:else}
    <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {#each data.products as product (product.id)}
        <ProductCard {product} />
      {/each}
    </div>
  {/if}
</div>
