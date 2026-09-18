<script lang="ts">
  import ProductForm from "$lib/components/admin/ProductForm.svelte";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);
</script>

<svelte:head>
  <title>{t(lang, "admin.products.new")} — {t(lang, "brand.name")}</title>
</svelte:head>

<section class="mx-auto max-w-3xl">
  <div>
    <Button variant="ghost" href="/admin/products" class="text-sm">
      {t(lang, "admin.products.backToList")}
    </Button>
  </div>

  <SectionTitle as="h1" className="text-4xl">{t(lang, "admin.products.new")}</SectionTitle>

  {#if form?.message}
    <p role="alert" class="mt-2 text-sm font-semibold text-red-700">{form.message}</p>
  {/if}

  <div
    class="mt-6 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm"
    data-testid="admin-product-form"
  >
    <ProductForm
      {lang}
      categories={data.categories}
      action="/admin/products/new"
      submitLabel={t(lang, "admin.products.create")}
      department="honey"
    />
  </div>
</section>
