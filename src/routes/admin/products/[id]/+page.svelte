<script lang="ts">
  import { enhance } from "$app/forms";
  import ProductForm from "$lib/components/admin/ProductForm.svelte";
  import VariantEditor from "$lib/components/admin/VariantEditor.svelte";
  import GalleryEditor from "$lib/components/admin/GalleryEditor.svelte";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  const lang = $derived(data.lang);
</script>

<svelte:head>
  <title>{data.product.name} — {t(lang, "admin.products.title")}</title>
</svelte:head>

<section class="mx-auto max-w-5xl">
  <div>
    <Button variant="ghost" href="/admin/products" class="text-sm">
      {t(lang, "admin.products.backToList")}
    </Button>
  </div>

  <SectionTitle as="h1" className="text-4xl">{data.product.name}</SectionTitle>
  <p class="mt-1 text-sm text-cocoa-400" dir="ltr">/{data.product.slug}</p>

  {#if form?.saved}
    <p class="mt-4 text-sm font-semibold text-honey-700">{form.saved}</p>
  {/if}
  {#if form?.uploaded}
    <p class="mt-4 text-sm font-semibold text-honey-700">{form.uploaded}</p>
  {/if}
  {#if form?.variantSaved}
    <p class="mt-4 text-sm font-semibold text-honey-700">{form.variantSaved}</p>
  {/if}
  {#if form?.variantDeleted}
    <p class="mt-4 text-sm font-semibold text-honey-700">{form.variantDeleted}</p>
  {/if}
  {#if form?.galleryAdded}
    <p class="mt-4 text-sm font-semibold text-honey-700">{form.galleryAdded}</p>
  {/if}
  {#if form?.galleryRemoved}
    <p class="mt-4 text-sm font-semibold text-honey-700">{form.galleryRemoved}</p>
  {/if}
  {#if form?.galleryOrdered}
    <p class="mt-4 text-sm font-semibold text-honey-700">{form.galleryOrdered}</p>
  {/if}
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
      value={{
        name: data.product.name,
        nameEn: data.nameEn,
        description: data.product.description,
        descriptionEn: data.product.descriptionEn,
        categoryId: data.categoryId,
        featured: data.product.featured,
        slug: data.product.slug,
        department: data.department,
      }}
      action="?/details"
      submitLabel={t(lang, "addresses.save")}
      department={data.department}
    />
  </div>

  <div
    class="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm"
  >
    <div>
      <p class="field-label">{t(lang, "admin.products.currentImage")}</p>
      {#if data.image !== ""}
        <img
          src={data.image}
          alt={data.product.name}
          loading="lazy"
          class="mt-2 h-24 w-24 rounded-xl object-cover"
        />
      {:else}
        <p class="mt-2 text-sm text-cocoa-400">—</p>
      {/if}
    </div>
    <form
      method="POST"
      action="?/uploadImage"
      enctype="multipart/form-data"
      use:enhance
      class="flex grow flex-wrap items-end gap-4"
    >
      <label class="field-label min-w-52 grow">
        {t(lang, "admin.products.imageFile")}
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          class="field mt-1"
        />
      </label>
      <Button type="submit" variant="outline">{t(lang, "admin.products.updateImage")}</Button>
    </form>
  </div>

  <GalleryEditor {lang} productId={data.product.id} images={data.images} />

  <VariantEditor {lang} productId={data.product.id} variants={data.variants} />
</section>
