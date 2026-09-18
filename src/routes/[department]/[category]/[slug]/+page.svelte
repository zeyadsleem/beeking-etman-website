<script lang="ts">
  import { PackageCheck, Truck, Layers } from "@lucide/svelte";
  import { productPhotos } from "$lib/product-media";
  import { AspectRatio, ToggleGroup } from "bits-ui";
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Button from "$lib/components/Button.svelte";
  import Price from "$lib/components/Price.svelte";
  import ProductArt from "$lib/components/ProductArt.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import ProductImageGallery from "$lib/components/ProductImageGallery.svelte";
  import QuantityPicker from "$lib/components/QuantityPicker.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { breadcrumbJsonLd, metaDescription, productJsonLd } from "$lib/seo";
  import { addToCart } from "$lib/cart-store.svelte";
  import { regularItemPayload } from "$lib/cart";
  import { formatEGP } from "$lib/currency";
  import { trackProductView } from "$lib/analytics-events";
  import { t } from "$lib/i18n/messages";
  import { categoryPath, departmentPath, productPath } from "$lib/storefront";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);
  const productUrl = $derived(productPath(data.product));
  const deptPath = $derived(departmentPath(data.product.department));
  const catPath = $derived(
    categoryPath(data.product.department, data.product.categorySlug),
  );
  const deptLabel = $derived(
    data.product.department === "honey"
      ? t(lang, "breadcrumb.honeyStore")
      : t(lang, "breadcrumb.equipmentStore"),
  );
  let selectedVariantId = $state<string | null>(null);
  let selectedVariant = $derived.by(() => {
    const id = selectedVariantId ?? data.product.variants[0].id;
    return data.product.variants.find((v) => v.id === id) ?? data.product.variants[0];
  });
  let quantity = $state(1);
  let adding = $state(false);

  $effect(() => {
    const p = data.product;
    trackProductView({
      id: p.id,
      name: p.name,
      slug: p.slug,
    });
  });

  // The gallery leads with the selected variant's photo, followed by the
  // product-wide gallery shots, without duplicates.
  const galleryImages = $derived(productPhotos(data.product, selectedVariant.image));
  const galleryIsPlaceholder = $derived(galleryImages.length === 0);

  function selectVariant(id: string) {
    const v = data.product.variants.find((x) => x.id === id);
    if (v) {
      selectedVariantId = v.id;
      quantity = 1;
    }
  }

  function handleAdd() {
    adding = true;
    addToCart(
      {
        ...regularItemPayload(data.product, selectedVariant),
        image: galleryImages[0] ?? "",
      },
      quantity,
    );
    setTimeout(() => { adding = false; }, 1500);
  }
</script>

<Seo
  title={t(lang, "detail.pageTitle", { name: data.product.name })}
  description={metaDescription(data.product.description)}
  path={productUrl}
  siteName={t(lang, "brand.name")}
  image={data.product.image}
  ogType="product"
  jsonLd={[
    productJsonLd({
      path: productUrl,
      name: data.product.name,
      description: data.product.description,
      image: data.product.image,
      minPrice: data.product.minPrice,
      inStock: data.product.variants.some((v) => v.stock > 0),
    }),
    breadcrumbJsonLd([
      { name: t(lang, "nav.home"), path: "/" },
      { name: deptLabel, path: deptPath },
      { name: data.categoryName, path: catPath },
      { name: data.product.name },
    ]),
  ]}
/>

{#key data.product.id}
<Breadcrumb
  lang={lang}
  className="my-6"
  items={[
    { label: t(lang, "nav.home"), href: "/" },
    { label: deptLabel, href: deptPath },
    { label: data.categoryName, href: catPath },
    { label: data.product.name },
  ]}
/>

<div class="grid gap-8 lg:grid-cols-2">
  <div class="lg:sticky lg:top-24 lg:self-start">
    {#if galleryIsPlaceholder}
      <div class="overflow-hidden rounded-3xl border border-honey-100 shadow-warm">
        <AspectRatio.Root ratio={1}>
          <ProductArt {lang} department={data.product.department} categorySlug={data.product.categorySlug} />
        </AspectRatio.Root>
      </div>
    {:else}
      <ProductImageGallery
        images={galleryImages}
        productName={data.product.name}
        lang={lang}
        viewTransitionName={`product-${data.product.id}`}
        activeKey={selectedVariant.id}
      />
    {/if}
  </div>

  <div class="flex flex-col gap-5">
    <div>
      <div class="flex items-center gap-3">
        <p class="eyebrow">{data.categoryName}</p>
      </div>
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
        <Button variant="primary" type="button" onclick={handleAdd} disabled={adding} class={adding ? '!bg-olive-600' : ''} data-testid="product-add-to-cart">
          {#if adding}
            <span class="spinner spinner-sm !border-t-white !border-cocoa-200/30"></span>
            {t(lang, "product.added")}
          {:else}
            {t(lang, "detail.addToCart")}
          {/if}
        </Button>
      </div>
      <p class="text-sm font-semibold text-cocoa-500">{t(lang, "detail.total", { total: formatEGP(selectedVariant.price * quantity, lang) })}</p>
    {/if}

    <dl class="mt-3 divide-y divide-cocoa-100 rounded-2xl border border-cocoa-100 bg-cocoa-50 px-5 text-sm">
      <div class="flex justify-between gap-4 py-4"><dt class="text-cocoa-500">{lang === "ar" ? "القسم" : "Category"}</dt><dd><a href={catPath} class="font-semibold text-honey-800">{data.categoryName}</a></dd></div>
      <div class="flex justify-between gap-4 py-4"><dt class="text-cocoa-500">{lang === "ar" ? "الاختيار الحالي" : "Selected option"}</dt><dd class="font-semibold">{selectedVariant.name}</dd></div>
      <div class="flex justify-between gap-4 py-4"><dt class="text-cocoa-500">{lang === "ar" ? "سعر الوحدة" : "Unit price"}</dt><dd class="font-semibold">{formatEGP(selectedVariant.price, lang)}</dd></div>
    </dl>
    <div class="grid gap-3 border-t border-cocoa-100 pt-5 text-sm text-cocoa-600">
      <p class="flex items-center gap-3"><Truck size={19} class="text-honey-700" />{lang === "ar" ? "احسب تكلفة التوصيل لمحافظتك عند إتمام الطلب." : "Delivery is calculated for your governorate at checkout."}</p>
      <p class="flex items-center gap-3"><PackageCheck size={19} class="text-honey-700" />{lang === "ar" ? "راجع المقاس أو الوزن والكمية قبل الإضافة للسلة." : "Check your selected size or weight and quantity before adding."}</p>
      <p class="flex items-center gap-3"><Layers size={19} class="text-honey-700" />{lang === "ar" ? "الصور المعروضة للاختيارات المتاحة من هذا المنتج." : "Photos show available options of this product."}</p>
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
