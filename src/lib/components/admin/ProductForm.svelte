<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/components/Button.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { ProductInput } from "$lib/server/admin/products";

  let {
    lang,
    categories,
    value = null,
    action,
    submitLabel,
  }: {
    lang: Lang;
    categories: Array<{ id: string; name: string }>;
    /** Prefill for edits; `price` is integer qirsh and `slug` the stored one. */
    value?: (ProductInput & { slug?: string }) | null;
    action: string;
    submitLabel: string;
  } = $props();

  // Seeded once per mount: each page renders exactly one form with static
  // server data, so there is nothing to keep two-way in sync afterwards.
  // The column stores integer qirsh; admins think in EGP. Display divides by
  // 100 here, and the server converts ×100 on submit — so the no-JS path
  // (plain multipart POST) validates exactly like the enhanced one.
  let model = $state(
    // svelte-ignore state_referenced_locally — capturing the initial prefill is the point.
    value === null
      ? {
          name: "",
          nameEn: "",
          slug: "",
          description: "",
          descriptionEn: "",
          categoryId: "",
          featured: false,
          priceEgp: "" as number | "",
        }
      : {
          name: value.name,
          nameEn: value.nameEn,
          slug: value.slug ?? "",
          description: value.description,
          descriptionEn: value.descriptionEn,
          categoryId: value.categoryId,
          featured: value.featured,
          priceEgp: value.price / 100 as number | "",
        },
  );

  let submitting = $state(false);
</script>

<form
  method="POST"
  {action}
  enctype="multipart/form-data"
  class="grid gap-4"
  use:enhance={() => {
    submitting = true;
    return async ({ update }) => {
      submitting = false;
      await update();
    };
  }}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <label class="field-label">
      {t(lang, "admin.products.name")}
      <input name="name" bind:value={model.name} required maxlength="200" class="field mt-1" />
    </label>
    <label class="field-label">
      {t(lang, "admin.products.nameEn")}
      <input name="nameEn" bind:value={model.nameEn} maxlength="200" dir="ltr" class="field mt-1" />
    </label>
  </div>

  <label class="field-label">
    {t(lang, "admin.categories.slug")}
    <input name="slug" bind:value={model.slug} maxlength="120" dir="ltr" class="field mt-1" />
    <span class="mt-1 block text-xs text-cocoa-400">
      {t(lang, "admin.products.slugAutoHint")}
    </span>
  </label>

  <label class="field-label">
    {t(lang, "admin.products.description")}
    <textarea
      name="description"
      bind:value={model.description}
      required
      maxlength="5000"
      rows="4"
      class="field mt-1"
    ></textarea>
  </label>
  <label class="field-label">
    {t(lang, "admin.products.descriptionEn")}
    <textarea
      name="descriptionEn"
      bind:value={model.descriptionEn}
      maxlength="5000"
      rows="3"
      dir="ltr"
      class="field mt-1"
    ></textarea>
  </label>

  <div class="grid gap-4 sm:grid-cols-2">
    <label class="field-label">
      {t(lang, "admin.products.priceEgp")}
      <input
        name="price"
        type="number"
        bind:value={model.priceEgp}
        required
        min="0.01"
        max="10000000"
        step="0.01"
        inputmode="decimal"
        dir="ltr"
        class="field mt-1"
      />
    </label>
    <label class="field-label">
      {t(lang, "admin.products.category")}
      <select name="categoryId" bind:value={model.categoryId} required class="field mt-1">
        <option value="" disabled>{t(lang, "admin.products.chooseCategory")}</option>
        {#each categories as category (category.id)}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <label class="flex w-fit items-center gap-2 text-sm font-semibold text-cocoa-800">
    <input type="checkbox" name="featured" value="1" bind:checked={model.featured} class="h-4 w-4 accent-honey-600" />
    {t(lang, "admin.products.featured")}
  </label>

  <div class="grid gap-4 sm:grid-cols-2">
    <label class="field-label">
      {t(lang, "admin.products.imageFile")}
      <input
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="field mt-1"
      />
    </label>
    <label class="field-label">
      {t(lang, "admin.products.imageUrl")}
      <input
        name="imageUrl"
        maxlength="500"
        dir="ltr"
        placeholder="https://…"
        class="field mt-1"
      />
    </label>
  </div>

  <footer class="flex items-center justify-end">
    <Button type="submit" variant="primary" disabled={submitting} aria-busy={submitting}>
      {submitLabel}
    </Button>
  </footer>
</form>
