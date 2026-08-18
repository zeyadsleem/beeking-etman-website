<script lang="ts">
  import { ToggleGroup } from "bits-ui";
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Button from "$lib/components/Button.svelte";
  import Price from "$lib/components/Price.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import ProductImageGallery from "$lib/components/ProductImageGallery.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { addToCart } from "$lib/cart-store.svelte";
  import { formatEGP } from "$lib/currency";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);
  let selectedVariantId = $state<string | null>(null);
  let selectedVariant = $derived.by(() => {
    const id = selectedVariantId ?? data.product.variants[0].id;
    return data.product.variants.find((v) => v.id === id) ?? data.product.variants[0];
  });
  let quantity = $state(1);

  // The gallery leads with the selected variant's photo, followed by the
  // product-wide gallery shots, without duplicates.
  let galleryImages = $derived(
    [selectedVariant.image, ...data.product.images].filter(
      (url, index, all) => all.indexOf(url) === index,
    ),
  );

  function selectVariant(id: string) {
    const v = data.product.variants.find((x) => x.id === id);
    if (v) {
      selectedVariantId = v.id;
      quantity = 1;
    }
  }

  function handleAdd() {
    addToCart(
      {
        variantId: selectedVariant.id,
        productId: data.product.id,
        name: data.product.name,
        variantName: selectedVariant.name,
        slug: data.product.slug,
        image: selectedVariant.image,
        price: selectedVariant.price,
        stock: selectedVariant.stock,
      },
      quantity,
    );
  }
</script>

<svelte:head><title>{t(lang, "detail.pageTitle", { name: data.product.name })}</title></svelte:head>

{#key data.product.id}
<Breadcrumb
    lang={lang}
    className="my-6"
    items={[
      { label: t(lang, "nav.home"), href: "/" },
      { label: t(lang, "nav.store"), href: "/products" },
      { label: data.product.name },
    ]}
  />

<div class="grid gap-8 lg:grid-cols-2">
  <ProductImageGallery
    images={galleryImages}
    productName={data.product.name}
    lang={lang}
    viewTransitionName={`product-${data.product.id}`}
    activeKey={selectedVariant.id}
  />

  <div class="flex flex-col gap-5">
    <div>
      <p class="eyebrow">{t(lang, "detail.eyebrow")}</p>
      <h1 class="headline mt-2 text-4xl leading-tight text-cocoa-900">{data.product.name}</h1>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col">
        <Price amount={selectedVariant.price} lang={lang} className="text-3xl font-extrabold text-cocoa-900" />
        <span class="mt-1.5 h-[3px] w-10 rounded-full bg-honey-600" aria-hidden="true"></span>
      </div>
      {#if selectedVariant.stock === 0}
        <span class="badge-out">{t(lang, "product.outOfStock")}</span>
      {:else}
        <span class="badge-neutral">{t(lang, "detail.inStock", { count: selectedVariant.stock })}</span>
      {/if}
    </div>

    {#if data.product.variants.length > 1}
      <ToggleGroup.Root
        type="single"
        value={selectedVariant.id}
        onValueChange={selectVariant}
        class="flex flex-wrap items-center gap-2"
        aria-label={t(lang, "detail.sizeAria")}
      >
        <span class="text-sm font-semibold text-cocoa-700">{t(lang, "detail.sizeLabel")}</span>
        {#each data.product.variants as v (v.id)}
          <ToggleGroup.Item
            value={v.id}
            disabled={v.stock === 0}
            class="chip data-[state=on]:chip-active"
          >
            {v.name}{v.stock === 0 ? t(lang, "detail.sizeSoldOut") : ""}
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    {/if}

    <p class="leading-relaxed text-cocoa-600">{data.product.description}</p>

    {#if selectedVariant.stock > 0}
      <div class="mt-2 flex flex-wrap items-center gap-4">
        <QuantityPicker lang={lang} value={quantity} max={selectedVariant.stock} onChange={(q) => (quantity = q)} />
        <Button variant="primary" type="button" onclick={handleAdd}>{t(lang, "detail.addToCart")}</Button>
      </div>
      <p class="text-sm font-semibold text-cocoa-500">{t(lang, "detail.total", { total: formatEGP(selectedVariant.price * quantity, lang) })}</p>
    {/if}

    <div class="mt-4 grid grid-cols-3 gap-3 border-t border-cocoa-100 pt-5 text-center">
      <div>
        <svg class="mx-auto h-7 w-7 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4.5c2.6 0 4.5 1.9 4.5 4.5h-9C7.5 6.4 9.4 4.5 12 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M7.5 9h9v1.5a4.5 4.5 0 0 1-9 0V9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M12 15v3.5M9.5 18.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <p class="mt-1.5 text-xs font-semibold text-cocoa-700">{t(lang, "detail.benefitRaw")}</p>
      </div>
      <div>
        <svg class="mx-auto h-7 w-7 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l2.1 4.3 4.7.7-3.4 3.3.8 4.7L12 13.9l-4.2 2.1.8-4.7L5.2 8l4.7-.7L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
        </svg>
        <p class="mt-1.5 text-xs font-semibold text-cocoa-700">{t(lang, "detail.benefitPure")}</p>
      </div>
      <div>
        <svg class="mx-auto h-7 w-7 text-honey-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h11v9H3zM14 9h3l3 3v3h-6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <circle cx="7" cy="18.5" r="1.8" stroke="currentColor" stroke-width="1.6" />
          <circle cx="17" cy="18.5" r="1.8" stroke="currentColor" stroke-width="1.6" />
        </svg>
        <p class="mt-1.5 text-xs font-semibold text-cocoa-700">{t(lang, "detail.benefitFast")}</p>
      </div>
    </div>
  </div>
</div>

{#if data.related.length > 0}
  <section class="mt-16">
    <SectionTitle className="text-3xl">{t(lang, "detail.related")}</SectionTitle>
    <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {#each data.related as product (product.id)}
        <ProductCard lang={lang} {product} />
      {/each}
    </div>
  </section>
{/if}
{/key}