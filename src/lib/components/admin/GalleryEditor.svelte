<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/components/Button.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { t } from "$lib/i18n/messages";
  import type { Lang } from "$lib/i18n/messages";
  import type { AdminGalleryImage } from "$lib/server/admin/product-images";

  let {
    lang,
    productId,
    images,
  }: {
    lang: Lang;
    productId: string;
    images: AdminGalleryImage[];
  } = $props();

  // Local copy so up/down moves can reorder before "Save order" persists
  // them. The prop only changes after an enhance revalidation (add/delete),
  // at which point any unpinned move is moot — mirror the fresh server order.
  // svelte-ignore state_referenced_locally — capturing the initial order is the point.
  let reorder = $state(images.map((image) => image.id));
  $effect(() => {
    reorder = images.map((image) => image.id);
  });

  function move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= reorder.length) return;
    const next = [...reorder];
    [next[index], next[target]] = [next[target], next[index]];
    reorder = next;
  }
</script>

<section class="mt-6 rounded-2xl border border-cocoa-100 bg-parchment p-6 shadow-warm-sm">
  <SectionTitle as="h2" className="text-xl">{t(lang, "admin.products.galleryTitle")}</SectionTitle>

  {#if images.length === 0}
    <p class="mt-3 text-sm text-cocoa-400">{t(lang, "admin.products.noGalleryImages")}</p>
  {:else}
    <ul class="mt-4 space-y-2" data-testid="gallery-list">
      {#each images as image, index (image.id)}
        <li
          class="flex flex-wrap items-center gap-3 rounded-xl border border-cocoa-100 bg-white px-3 py-2"
          data-testid="gallery-row"
        >
          <img
            src={image.url}
            alt=""
            loading="lazy"
            class="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
          <div class="flex flex-col">
            <button
              type="button"
              aria-label={t(lang, "admin.products.moveUp")}
              disabled={index === 0}
              onclick={() => move(index, -1)}
              class="h-6 w-6 rounded text-cocoa-500 hover:bg-cocoa-100 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={t(lang, "admin.products.moveDown")}
              disabled={index === images.length - 1}
              onclick={() => move(index, 1)}
              class="h-6 w-6 rounded text-cocoa-500 hover:bg-cocoa-100 disabled:opacity-30"
            >
              ↓
            </button>
          </div>
          <span class="min-w-0 flex-1 truncate text-xs text-cocoa-400" dir="ltr">
            {image.url}
          </span>
          <form method="POST" action="?/galleryDelete" use:enhance>
            <input type="hidden" name="imageId" value={image.id} />
            <Button type="submit" variant="ghost" class="text-sm">
              {t(lang, "admin.products.removeImage")}
            </Button>
          </form>
        </li>
      {/each}
    </ul>

    {#if images.length > 1}
      <form
        method="POST"
        action="?/galleryReorder"
        use:enhance
        class="mt-4 flex items-center gap-3"
        data-testid="gallery-reorder-form"
      >
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="order" value={reorder.join(",")} />
        <Button type="submit" variant="outline">{t(lang, "admin.products.saveOrder")}</Button>
        <span class="text-xs text-cocoa-400">{t(lang, "admin.products.galleryOrderHint")}</span>
      </form>
    {/if}
  {/if}

  <form
    method="POST"
    action="?/galleryAdd"
    enctype="multipart/form-data"
    use:enhance
    class="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-dashed border-cocoa-200 bg-white/60 p-4"
    data-testid="gallery-add-form"
  >
    <label class="field-label min-w-52 grow">
      {t(lang, "admin.products.imageFile")}
      <input
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="field mt-1"
      />
    </label>
    <p class="self-center text-xs text-cocoa-400">{t(lang, "admin.products.or")}</p>
    <label class="field-label min-w-64 grow">
      {t(lang, "admin.products.imageUrl")}
      <input
        name="imageUrl"
        type="text"
        maxlength="500"
        dir="ltr"
        placeholder="https://…"
        class="field mt-1"
      />
    </label>
    <Button type="submit" variant="primary">{t(lang, "admin.products.addImage")}</Button>
  </form>
</section>