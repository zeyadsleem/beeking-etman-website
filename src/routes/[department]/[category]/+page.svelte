<script lang="ts">
  import { Select } from "bits-ui";
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Button from "$lib/components/Button.svelte";
  import HoneycombIcon from "$lib/components/HoneycombIcon.svelte";
  import PageHero from "$lib/components/PageHero.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { goto } from "$app/navigation";
  import { getDir, t } from "$lib/i18n/messages";
  import { categoryPath, departmentPath } from "$lib/storefront";
  import type { Lang } from "$lib/i18n/messages";
  import type { SortOrder } from "$lib/server/store";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const lang: Lang = $derived(data.lang);
  const department = $derived(data.department);
  const deptPath = $derived(departmentPath(department));
  const catPath = $derived(categoryPath(department, data.category.slug));
  const deptLabel = $derived(
    department === "honey"
      ? t(lang, "breadcrumb.honeyStore")
      : t(lang, "breadcrumb.equipmentStore"),
  );
  const title = $derived.by(() => {
    const section = department === "honey" ? t(lang, "products.honeyTitle") : t(lang, "products.equipmentTitle");
    return data.category.name;
  });

  function changeSort(sort: SortOrder) {
    const params = new URLSearchParams();
    if (sort !== "newest") params.set("sort", sort);
    void goto(`${catPath}${params.size ? `?${params}` : ""}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (data.filters.sort !== "newest") params.set("sort", data.filters.sort);
    if (page > 1) params.set("page", String(page));
    void goto(`${catPath}${params.size ? `?${params}` : ""}`);
  }
</script>

<Seo
  title={t(lang, "products.categoryPageTitle", { category: data.category.name })}
  description={t(lang, "products.categorySubtitle", { category: data.category.name })}
  path={catPath}
  siteName={t(lang, "brand.name")}
/>

<Breadcrumb
  lang={lang}
  className="mt-8"
  items={[
    { label: t(lang, "nav.home"), href: "/" },
    { label: deptLabel, href: deptPath },
    { label: data.category.name },
  ]}
/>

<PageHero
  eyebrow={deptLabel}
  title={title}
  subtitle={t(lang, "products.categorySubtitle", { category: data.category.name })}
  class="mt-5"
/>

{#if data.subcategories.length > 0}
  <div class="mt-6 flex flex-wrap gap-2">
    {#each data.subcategories as sub (sub.slug)}
      <a href={categoryPath(department, sub.slug)} class="chip">
        {sub.name}
      </a>
    {/each}
  </div>
{/if}

<div class="mt-6 flex items-center justify-end gap-2">
  <span class="text-sm font-medium text-cocoa-700">{t(lang, "products.sortLabel")}</span>
  <Select.Root
    type="single"
    value={data.filters.sort}
    onValueChange={(v) => changeSort((v ?? "newest") as SortOrder)}
    items={[
      { value: "newest", label: t(lang, "products.sortNewest") },
      { value: "price-asc", label: t(lang, "products.sortPriceAsc") },
      { value: "price-desc", label: t(lang, "products.sortPriceDesc") },
    ]}
  >
    <Select.Trigger class="chip py-2" aria-label={t(lang, "products.sortAria")}>
      <Select.Value>
        {#snippet children({ selection, placeholder })}
          <span class="flex items-center gap-3">
            {selection.type === "single" ? (selection.selected?.label ?? placeholder) : placeholder}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        {/snippet}
      </Select.Value>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content
        dir={getDir(lang)}
        class="z-50 min-w-[var(--bits-select-anchor-width)] rounded-2xl border border-cocoa-200 bg-parchment p-1.5 shadow-warm-lg"
        sideOffset={8}
        align="start"
      >
        <Select.Viewport>
          <Select.Item value="newest" label={t(lang, "products.sortNewest")} class="rounded-xl outline-none data-highlighted:bg-honey-50 data-highlighted:text-honey-800 data-selected:bg-honey-100 data-selected:text-honey-900">
            {#snippet children()}
              <span class="block px-3 py-2.5 text-center text-sm font-medium">{t(lang, "products.sortNewest")}</span>
            {/snippet}
          </Select.Item>
          <Select.Item value="price-asc" label={t(lang, "products.sortPriceAsc")} class="rounded-xl outline-none data-highlighted:bg-honey-50 data-highlighted:text-honey-800 data-selected:bg-honey-100 data-selected:text-honey-900">
            {#snippet children()}
              <span class="block px-3 py-2.5 text-center text-sm font-medium">{t(lang, "products.sortPriceAsc")}</span>
            {/snippet}
          </Select.Item>
          <Select.Item value="price-desc" label={t(lang, "products.sortPriceDesc")} class="rounded-xl outline-none data-highlighted:bg-honey-50 data-highlighted:text-honey-800 data-selected:bg-honey-100 data-selected:text-honey-900">
            {#snippet children()}
              <span class="block px-3 py-2.5 text-center text-sm font-medium">{t(lang, "products.sortPriceDesc")}</span>
            {/snippet}
          </Select.Item>
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
</div>

{#if data.products.length === 0}
  <div class="mt-14 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cocoa-200 bg-parchment p-14 text-center">
    <HoneycombIcon size={52} class="text-cocoa-500" />
    <p class="text-lg font-semibold text-cocoa-600">{t(lang, "products.empty")}</p>
    <Button variant="outline" type="button" onclick={() => goto(deptPath)} class="mt-1 text-sm">{t(lang, "products.showAll")}</Button>
  </div>
{:else}
  <div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
        onclick={() => goToPage(data.page - 1)}
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
        onclick={() => goToPage(data.page + 1)}
      >
        {t(lang, "products.next")}
      </Button>
    </nav>
  {/if}
{/if}
