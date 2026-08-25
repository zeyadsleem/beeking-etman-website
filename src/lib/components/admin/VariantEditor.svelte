<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/components/Button.svelte";
  import HoneycombIcon from "$lib/components/HoneycombIcon.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import type { VariantInput } from "$lib/server/admin/products";

  let {
    lang,
    productId,
    variants,
  }: {
    lang: Lang;
    productId: string;
    variants: Array<VariantInput & { id: string }>;
  } = $props();

  // Row inputs are intentionally unbound: progressive enhancement serializes
  // the live DOM on submit, and a failed action refetches fresh rows — so
  // initial values only need to seed the markup.
  const emptyVariant = {
    name: "",
    price: "" as number | "",
    stock: 0,
    sortOrder: 0,
    image: "",
  };
</script>

<section class="mt-10">
  <h2 class="headline text-2xl text-cocoa-900">{t(lang, "admin.products.variantsTitle")}</h2>

  {#if variants.length === 0}
    <p class="mt-3 text-sm text-cocoa-500">{t(lang, "admin.products.noVariants")}</p>
  {/if}

  <ul class="mt-4 space-y-4">
    {#each variants as variant (variant.id)}
      <li class="rounded-2xl border border-cocoa-200 bg-parchment p-5" data-testid="variant-row">
        <form method="POST" action="?/variantSave" use:enhance class="flex flex-wrap items-end gap-x-4 gap-y-3">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={variant.id} />
          <input type="hidden" name="nameEn" value={variant.nameEn} />
          {#if variant.image !== ""}
            <img
              src={variant.image}
              alt={variant.name}
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
          <label class="field-label min-w-40 grow">
            {t(lang, "admin.products.variantName")}
            <input name="name" value={variant.name} required maxlength="80" class="field mt-1" />
          </label>
          <label class="field-label w-32">
            {t(lang, "admin.order.unitPrice")}
            <input
              name="price"
              type="number"
              value={variant.price / 100}
              required
              min="0.01"
              step="0.01"
              inputmode="decimal"
              dir="ltr"
              class="field mt-1"
            />
          </label>
          <label class="field-label w-24">
            {t(lang, "admin.products.stock")}
            <input
              name="stock"
              type="number"
              value={variant.stock}
              required
              min="0"
              step="1"
              dir="ltr"
              class="field mt-1"
            />
          </label>
          <label class="field-label w-24">
            {t(lang, "admin.products.sortOrder")}
            <input
              name="sortOrder"
              type="number"
              value={variant.sortOrder}
              step="1"
              dir="ltr"
              class="field mt-1"
            />
          </label>
          <label class="field-label min-w-52 grow">
            {t(lang, "admin.products.imageUrl")}
            <input
              name="imageUrl"
              value={variant.image}
              maxlength="500"
              dir="ltr"
              placeholder="https://…"
              class="field mt-1"
            />
          </label>
          <Button type="submit" variant="outline">{t(lang, "addresses.save")}</Button>
        </form>
        <div class="mt-3 flex justify-end">
          <form method="POST" action="?/variantDelete" use:enhance>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="variantId" value={variant.id} />
            <Button type="submit" variant="ghost" class="text-clay-700">{t(lang, "admin.products.delete")}</Button>
          </form>
        </div>
      </li>
    {/each}

    <li class="rounded-2xl border border-dashed border-cocoa-200 bg-parchment p-5">
      <h3 class="text-sm font-bold text-cocoa-700">{t(lang, "admin.products.addVariant")}</h3>
      <form method="POST" action="?/variantSave" use:enhance class="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        <input type="hidden" name="productId" value={productId} />
        <label class="field-label min-w-40 grow">
          {t(lang, "admin.products.variantName")}
          <input
            name="name"
            value=""
            required
            maxlength="80"
            placeholder={t(lang, "admin.products.variantName")}
            class="field mt-1"
          />
        </label>
        <label class="field-label w-32">
          {t(lang, "admin.order.unitPrice")}
          <input
            name="price"
            type="number"
            value={emptyVariant.price}
            required
            min="0.01"
            step="0.01"
            inputmode="decimal"
            dir="ltr"
            class="field mt-1"
          />
        </label>
        <label class="field-label w-24">
          {t(lang, "admin.products.stock")}
          <input
            name="stock"
            type="number"
            value={emptyVariant.stock}
            required
            min="0"
            step="1"
            dir="ltr"
            class="field mt-1"
          />
        </label>
        <label class="field-label w-24">
          {t(lang, "admin.products.sortOrder")}
          <input
            name="sortOrder"
            type="number"
            value={emptyVariant.sortOrder}
            step="1"
            dir="ltr"
            class="field mt-1"
          />
        </label>
        <label class="field-label min-w-52 grow">
          {t(lang, "admin.products.imageUrl")}
          <input
            name="imageUrl"
            maxlength="500"
            dir="ltr"
            placeholder="https://…"
            class="field mt-1"
          />
        </label>
        <Button type="submit" variant="primary">{t(lang, "addresses.save")}</Button>
      </form>
    </li>
  </ul>
</section>
