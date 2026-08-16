<script lang="ts">
  import { ToggleGroup } from "bits-ui";
  import Button from "$lib/components/Button.svelte";
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import SearchSuggestions from "$lib/components/SearchSuggestions.svelte";
  import { goto } from "$app/navigation";
  import { t } from "$lib/i18n/messages";
  import type { SortOrder } from "$lib/server/store";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang = $derived(data.lang);

  function navigate({ sort, category, page, q }: { sort?: SortOrder; category?: string | null; page?: number; q?: string }) {
    const params = new URLSearchParams();
    if (q !== undefined) {
      if (q) params.set("q", q);
    } else if (data.filters.q) {
      params.set("q", data.filters.q);
    }
    const nextCategory = category !== undefined ? category : data.filters.category;
    if (nextCategory) params.set("category", nextCategory);
    const nextSort = sort ?? data.filters.sort;
    if (nextSort !== "newest") params.set("sort", nextSort);
    const nextPage = page ?? data.page;
    if (nextPage > 1) params.set("page", String(nextPage));
    void goto(`/products${params.size ? `?${params}` : ""}`);
  }

  function searchProducts(q: string) {
    navigate({ q, page: 1 });
  }

  function selectCategory(slug: string | null) {
    navigate({ category: slug, page: 1 });
  }

  function changeSort(sort: SortOrder) {
    navigate({ sort, page: 1 });
  }
</script>

<svelte:head><title>{t(lang, "products.pageTitle")}</title></svelte:head>

<section class="mt-6">
  <p class="eyebrow">{t(lang, "brand.name")}</p>
  <h1 class="headline mt-2 text-4xl leading-tight text-cocoa-900">{t(lang, "products.title")}</h1>
  <p class="mt-3 max-w-xl text-cocoa-500">{t(lang, "products.subtitle")}</p>
</section>

<Breadcrumb lang={lang} className="mt-6" items={[{ label: t(lang, "nav.home"), href: "/" }, { label: t(lang, "nav.store") }]} />

<div class="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
  <SearchSuggestions
    lang={lang}
    initial={data.filters.q}
    placeholder={t(lang, "products.searchPlaceholder")}
    ariaLabel={t(lang, "products.searchAria")}
    submitLabel={t(lang, "products.searchSubmit")}
    class="flex max-w-sm flex-1 gap-2"
    onSearch={searchProducts}
    onSelect={(value) => goto(value)}
  />
  <div class="flex items-center gap-2">
    <span class="text-sm font-medium text-cocoa-700">{t(lang, "products.sortLabel")}</span>
    <ToggleGroup.Root
      type="single"
      value={data.filters.sort}
      onValueChange={(v) => changeSort((v ?? "newest") as SortOrder)}
      class="flex items-center gap-2"
      aria-label={t(lang, "products.sortAria")}
    >
      <ToggleGroup.Item value="newest" class="chip data-[state=on]:chip-active">{t(lang, "products.sortNewest")}</ToggleGroup.Item>
      <ToggleGroup.Item value="price-asc" class="chip data-[state=on]:chip-active">{t(lang, "products.sortPriceAsc")}</ToggleGroup.Item>
      <ToggleGroup.Item value="price-desc" class="chip data-[state=on]:chip-active">{t(lang, "products.sortPriceDesc")}</ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
</div>

<ToggleGroup.Root
  type="single"
  value={data.filters.category || "all"}
  onValueChange={(v) => selectCategory(v === "all" ? null : v)}
  class="mt-5 flex flex-wrap gap-2"
  aria-label={t(lang, "products.filterAria")}
>
  <ToggleGroup.Item value="all" class="chip data-[state=on]:chip-active">{t(lang, "products.allCategories")}</ToggleGroup.Item>
  {#each data.categories as cat (cat.id)}
    <ToggleGroup.Item value={cat.slug} class="chip data-[state=on]:chip-active">{cat.name}</ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>

{#if data.products.length === 0}
  <div class="mt-14 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cocoa-200 bg-parchment p-14 text-center">
    <svg width="52" height="58" viewBox="0 0 26 30" fill="none" aria-hidden="true">
      <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke="#dcd8d0" stroke-width="1.6" />
    </svg>
    <p class="text-lg font-semibold text-cocoa-600">{t(lang, "products.empty")}</p>
    <Button variant="outline" type="button" onclick={() => selectCategory(null)} class="mt-1 text-sm">{t(lang, "products.showAll")}</Button>
  </div>
{:else}
  <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {#each data.products as product (product.id)}
      <ProductCard lang={lang} {product} />
    {/each}
  </div>

  {#if data.totalPages > 1}
    <nav class="mt-10 flex items-center justify-center gap-4" aria-label={t(lang, "products.paginationAria")}>
      <Button
        variant="outline"
        type="button"
        class="text-sm"
        disabled={data.page <= 1}
        onclick={() => navigate({ page: data.page - 1 })}
      >
        {t(lang, "products.prev")}
      </Button>
      <span class="text-sm text-cocoa-600" aria-label={t(lang, "products.pageAria", { page: data.page })}>
        {t(lang, "products.page")} {data.page} {t(lang, "products.of")} {data.totalPages}
      </span>
      <Button
        variant="outline"
        type="button"
        class="text-sm"
        disabled={data.page >= data.totalPages}
        onclick={() => navigate({ page: data.page + 1 })}
      >
        {t(lang, "products.next")}
      </Button>
    </nav>
  {/if}
{/if}