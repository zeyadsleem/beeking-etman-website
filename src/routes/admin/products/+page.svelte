<script lang="ts">
  import { enhance } from "$app/forms";
  import { Dialog } from "bits-ui";
  import Button from "$lib/components/Button.svelte";
  import HoneycombIcon from "$lib/components/HoneycombIcon.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { formatEGP } from "$lib/currency";
  import { t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);

  type ProductRow = PageData["items"][number];

  let confirmOpen = $state(false);
  let deleting: ProductRow | null = $state(null);

  function askDelete(product: ProductRow): void {
    deleting = product;
    confirmOpen = true;
  }

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (data.query !== "") params.set("q", data.query);
    if (page > 1) params.set("page", String(page));
    const queryString = params.toString();
    return `/admin/products${queryString ? `?${queryString}` : ""}`;
  }

  const hasNextPage = $derived(data.page * data.pageSize < data.total);
</script>

<svelte:head>
  <title>{t(lang, "admin.products.title")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.products.title")}</SectionTitle>
    <a href="/admin/products/new" class="btn-primary">{t(lang, "admin.products.new")}</a>
  </div>

  {#if form?.message}
    <p role="alert" class="mt-2 text-sm font-semibold text-red-700">{form.message}</p>
  {:else if form?.deleted}
    <p role="status" class="mt-2 text-sm font-semibold text-honey-700">
      {t(lang, "admin.products.deleted")}
    </p>
  {/if}

  <form
    method="GET"
    action="/admin/products"
    role="search"
    class="mt-6 flex max-w-md items-center gap-2"
  >
    <input
      type="search"
      name="q"
      value={data.query}
      placeholder={t(lang, "admin.products.searchPlaceholder")}
      aria-label={t(lang, "admin.products.searchPlaceholder")}
      class="w-full rounded-xl border border-cocoa-200 bg-white px-3 py-2 text-sm text-cocoa-900 outline-none focus:border-honey-500"
    />
    <Button type="submit" variant="outline">{t(lang, "products.searchSubmit")}</Button>
  </form>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p class="text-lg font-semibold text-cocoa-600">{t(lang, "admin.products.empty")}</p>
    </div>
  {:else}
    <div class="mt-8 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment shadow-warm-sm">
      <table class="w-full min-w-[48rem] text-sm">
        <thead>
          <tr class="border-b border-cocoa-100 text-xs font-semibold text-cocoa-500">
            <th scope="col" class="px-4 py-3"></th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "account.name")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.products.category")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.order.unitPrice")}</th>
            <th scope="col" class="px-4 py-3 text-start">{t(lang, "admin.products.stock")}</th>
            <th scope="col" class="px-4 py-3 text-center">{t(lang, "admin.products.featured")}</th>
            <th scope="col" class="px-4 py-3 text-end"></th>
          </tr>
        </thead>
        <tbody>
          {#each data.items as product (product.id)}
            <tr class="border-b border-cocoa-50 last:border-b-0" data-testid="admin-product-row">
              <td class="px-4 py-3">
                {#if data.images[product.id]}
                  <img
                    src={data.images[product.id]}
                    alt={product.name}
                    loading="lazy"
                    class="h-12 w-12 rounded-xl object-cover"
                  />
                {:else}
                  <div
                    aria-hidden="true"
                    class="flex h-12 w-12 items-center justify-center rounded-xl border border-cocoa-100 bg-white text-cocoa-300"
                  >
                    <HoneycombIcon size={22} />
                  </div>
                {/if}
              </td>
              <td class="px-4 py-3 font-medium text-cocoa-800">{product.name}</td>
              <td class="px-4 py-3 text-cocoa-600">
                {product.categoryName === "" ? "—" : product.categoryName}
              </td>
              <td class="px-4 py-3 font-semibold text-cocoa-800">
                {formatEGP(product.price, lang)}
              </td>
              <td class="px-4 py-3">
                <span class={product.totalStock === 0 ? "badge-out" : "badge-neutral"}>
                  {product.totalStock}
                </span>
                <p class="mt-1 text-xs text-cocoa-400">
                  {t(lang, "admin.products.variantsCount", { count: product.variantCount })}
                </p>
              </td>
              <td class="px-4 py-3 text-center">
                <span class={product.featured ? "text-honey-600" : "text-cocoa-200"} aria-hidden="true">★</span>
                {#if product.featured}
                  <span class="sr-only">{t(lang, "admin.products.featured")}</span>
                {/if}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-3">
                  <a
                    href={`/admin/products/${product.id}`}
                    class="text-sm font-semibold text-honey-700 underline-offset-4 transition hover:text-honey-800 hover:underline"
                  >
                    {t(lang, "admin.products.edit")}
                  </a>
                  <button
                    type="button"
                    onclick={() => askDelete(product)}
                    class="text-sm font-semibold text-clay-700 underline-offset-4 transition hover:text-clay-900 hover:underline"
                  >
                    {t(lang, "admin.products.delete")}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if data.page > 1 || hasNextPage}
      <nav class="mt-10 flex items-center justify-center gap-4" aria-label={t(lang, "products.paginationAria")}>
        {#if data.page > 1}
          <a href={pageHref(data.page - 1)} class="btn-outline text-sm">{t(lang, "admin.products.prev")}</a>
        {/if}
        {#if hasNextPage}
          <a href={pageHref(data.page + 1)} class="btn-outline text-sm">{t(lang, "admin.products.next")}</a>
        {/if}
      </nav>
    {/if}
  {/if}
</section>

<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-cocoa-950/40 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-sm -translate-y-1/2 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-lg focus:outline-none"
      data-testid="delete-confirm-dialog"
    >
      <Dialog.Title class="headline text-xl text-cocoa-900">
        {t(lang, "admin.products.delete")}
      </Dialog.Title>
      <Dialog.Description class="sr-only">{deleting?.name ?? ""}</Dialog.Description>
      <p class="mt-3 text-sm text-cocoa-700">{t(lang, "admin.products.confirmDelete")}</p>
      <form
        method="POST"
        action="?/delete"
        use:enhance={() => {
          return async ({ result, update }) => {
            if (result.type === "success") confirmOpen = false;
            await update();
          };
        }}
        class="mt-5 flex items-center justify-end gap-2"
      >
        <input type="hidden" name="id" value={deleting?.id ?? ""} />
        <Dialog.Close class="btn-outline">{t(lang, "addresses.cancel")}</Dialog.Close>
        <Button type="submit" variant="primary">{t(lang, "admin.products.delete")}</Button>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
