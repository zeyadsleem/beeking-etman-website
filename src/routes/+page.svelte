<script lang="ts">
  import ProductCard from "$lib/components/ProductCard.svelte";
  import CategoryCard from "$lib/components/CategoryCard.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>بيت العسل — متجر العسل الطبيعي</title></svelte:head>

<section class="relative mt-6 overflow-hidden rounded-[2rem] bg-cocoa-900 text-parchment shadow-warm-lg">
  <div
    class="absolute inset-0"
    style="background:
      radial-gradient(120% 90% at 85% 10%, rgb(197 111 15 / 0.55), transparent 55%),
      radial-gradient(90% 80% at 0% 100%, rgb(133 64 21 / 0.5), transparent 60%)"
  ></div>
  <div class="honeycomb-bg absolute inset-0 opacity-40"></div>
  <div class="grain-bg absolute inset-0 opacity-30"></div>

  <div class="relative grid items-center gap-10 px-6 py-14 sm:px-10 lg:grid-cols-2 lg:py-16">
    <div class="motion-safe:animate-fade-up">
      <p class="inline-flex items-center gap-2 rounded-full border border-honey-400/40 bg-honey-500/15 px-4 py-1.5 text-sm font-semibold text-honey-200">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 1l2.6 5.4L20 7.2l-4 4 1 5.8-5-2.6-5 2.6 1-5.8-4-4 5.4-.8L12 1Z" />
        </svg>
        من مناحلنا مباشرة إلى بابك
      </p>
      <h1 class="headline mt-5 text-5xl leading-[1.1] text-parchment sm:text-6xl">
        عسل طبيعي<br />
        نقي <span class="text-honey-300">100%</span>
      </h1>
      <p class="mt-5 max-w-md text-lg leading-relaxed text-parchment/70">
        اختر من تشكيلة عسل السدر، زهر البرتقال، والأصناف البرية — بجودة مضمونة وتوصيل سريع لكل المحافظات.
      </p>
      <div class="mt-8 flex flex-wrap items-center gap-4">
        <a href="/products" class="btn-honey">تسوق الآن
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
        <a href="#categories" class="text-sm font-semibold text-honey-200 underline decoration-honey-400/50 underline-offset-4 transition hover:text-honey-100">
          تصفح الفئات
        </a>
      </div>
    </div>

    <div class="relative mx-auto hidden w-full max-w-sm lg:block motion-safe:animate-fade-up">
      <div class="absolute -inset-4 -z-0 rounded-[3rem] border border-honey-400/25"></div>
      <figure class="arch-frame-lg relative overflow-hidden border-4 border-honey-500/70 bg-honey-100 shadow-warm-lg">
        <img
          src={data.featured[0]?.image}
          alt="عسل طبيعي من بيت العسل"
          class="aspect-[4/5] h-full w-full object-cover"
        />
        <figcaption class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cocoa-950/80 to-transparent p-5 pt-16 text-center">
          <span class="wordmark text-2xl text-honey-200">اختيار النحّال</span>
          <span class="mt-1 block text-xs text-parchment/70">القطرة الأولى — عسل السدر البري</span>
        </figcaption>
      </figure>
      <div class="animate-float absolute -end-4 -top-6 text-honey-400" aria-hidden="true">
        <svg width="46" height="52" viewBox="0 0 26 30" fill="none">
          <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="#f3da99" stroke="#a35110" stroke-width="1.6" />
          <path d="M8 12.5h10M13 7.5v10" stroke="#a35110" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </div>
      <div class="animate-float absolute -start-6 bottom-10 text-honey-500" style="animation-delay: 1.4s" aria-hidden="true">
        <svg width="34" height="38" viewBox="0 0 26 30" fill="none">
          <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke="#e5a82e" stroke-width="1.6" />
        </svg>
      </div>
    </div>
  </div>
</section>

<section class="mt-16">
  <div class="flex items-end justify-between gap-4">
    <h2 class="rule-flourish headline text-3xl text-cocoa-900">
      <i aria-hidden="true"></i>
      اختير لك
    </h2>
    <a href="/products" class="btn-outline text-sm">كل المنتجات
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </a>
  </div>
  <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {#each data.featured as product (product.id)}
      <ProductCard {product} />
    {/each}
  </div>
</section>

<section id="categories" class="mt-16">
  <h2 class="rule-flourish headline text-3xl text-cocoa-900">
    <i aria-hidden="true"></i>
    تصفح حسب الفئات
  </h2>
  <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.categories as cat (cat.id)}
      <CategoryCard name={cat.name} slug={cat.slug} />
    {/each}
  </div>
</section>

<section class="mt-16 rounded-[2rem] border border-honey-200 bg-gradient-to-b from-parchment to-honey-50 px-6 py-10 text-center shadow-warm-sm">
  <h2 class="rule-flourish headline mx-auto text-3xl text-cocoa-900">
    <i aria-hidden="true"></i>
    لماذا بيت العسل؟
  </h2>
  <div class="mx-auto mt-8 grid max-w-4xl gap-8 sm:grid-cols-3">
    <div>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-honey-100 text-honey-700">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v3M6.2 5.6l2 2M17.8 5.6l-2 2M4 12h3M17 12h3M6.2 18.4l2-2M17.8 18.4l-2-2M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.8" />
        </svg>
      </div>
      <h3 class="headline mt-3 text-lg text-cocoa-800">مصدر موثوق</h3>
      <p class="mt-1 text-sm leading-relaxed text-cocoa-500">تعاون مباشر مع مناحل مصرية، بلا وسطاء ولا شوائب.</p>
    </div>
    <div>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-honey-100 text-honey-700">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21c-4-3-7-6.2-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5c0 3.3-3 6.5-7 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 class="headline mt-3 text-lg text-cocoa-800">توصيل سريع</h3>
      <p class="mt-1 text-sm leading-relaxed text-cocoa-500">لكل المحافظات خلال 2-4 أيام عمل، ومجاني فوق 600 ج.م.</p>
    </div>
    <div>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-honey-100 text-honey-700">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3l-4.8 2.6.9-5.4L4.2 7.7l5.4-.8L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 class="headline mt-3 text-lg text-cocoa-800">جودة نقيّة</h3>
      <p class="mt-1 text-sm leading-relaxed text-cocoa-500">عسل خام غير مبستر، محفوظ في برطمانات زجاجية بأيدي نحّالينا.</p>
    </div>
  </div>
</section>