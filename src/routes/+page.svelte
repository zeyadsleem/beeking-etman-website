<script lang="ts">
  import ProductCard from "$lib/components/ProductCard.svelte";
  import SectionTitle from "$lib/components/SectionTitle.svelte";
  import { reveal } from "$lib/actions/reveal.svelte";
  import { countUp } from "$lib/actions/countup.svelte";
  import type { ProductSummary } from "$lib/server/store";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const bySlug = (slugs: string[]): ProductSummary[] => {
    const wanted = new Set(slugs);
    return data.products.filter((p) => wanted.has(p.slug));
  };

  const rails = [
    {
      title: "للمناعة والطاقة",
      note: "سدر، غذاء ملكات، بروبليس، حبة البركة",
      slugs: [
        "sidr-egyptian",
        "royal-jelly",
        "propolis",
        "blackseed",
        "six-blend",
        "ginseng",
        "palm-pollen",
        "bee-pollen",
      ],
    },
    {
      title: "للعائلة والإفطار",
      note: "برسيم، موالح، بردقوش، شمع بالعسل",
      slugs: ["clover", "citrus", "marjoram", "comb-honey", "comb-frame"],
    },
    {
      title: "سناكات صحية",
      note: "عسل مكسرات، لوز، فستق، كاجو",
      slugs: ["nuts-honey", "hazelnut", "pistachio", "almond", "cashew", "mixed-nuts", "nuts-extra"],
    },
  ];

  const categoryStories: Record<string, string> = {
    flowers: "أزهار الدلتا والوجه البحري — خفيف ومشرق، يليق بالإفطار",
    sidr: "من سفوح سيناء وجنوب الصعيد، أغلى أنواع العسل المصرية",
    blends: "حبة البركة والخلطات السداسية — قوة الطبيعة في جرة",
    comb: "طازج من الفرازات، يُقطع ويُؤكل كما هو",
    "bee-supplements": "غذاء ملكات وبروبليس وطلع النخل — كنوز الخلية",
    nuts: "سناكات صحية وملكية من أجود المحاصيل",
  };
</script>

<svelte:head><title>مملكة النحل — متجر العسل الطبيعي</title></svelte:head>

<section class="relative mt-6 overflow-hidden rounded-[2rem] bg-ink-950 text-parchment shadow-warm-lg">
  <div
    class="absolute inset-0"
    style="background:
      radial-gradient(120% 90% at 85% 10%, rgb(229 168 46 / 0.28), transparent 55%),
      radial-gradient(90% 80% at 0% 100%, rgb(184 119 23 / 0.22), transparent 60%)"
  ></div>
  <div class="honeycomb-bg absolute inset-0 opacity-25"></div>
  <div class="grain-bg absolute inset-0 opacity-40"></div>

  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <svg class="animate-drip absolute -top-4 start-[12%]" width="10" height="26" viewBox="0 0 10 26" style="animation-delay: 0.2s">
      <ellipse cx="5" cy="5" rx="4.5" ry="5" fill="#e5a82e" opacity="0.7" />
      <path d="M5 26C3 18 5 14 5 14s2 4 0 12Z" fill="#e5a82e" opacity="0.55" />
    </svg>
    <svg class="animate-drip absolute -top-4 start-[38%]" width="8" height="22" viewBox="0 0 8 22" style="animation-delay: 1.3s">
      <ellipse cx="4" cy="4" rx="3.5" ry="4" fill="#ecc153" opacity="0.6" />
      <path d="M4 22C2.5 16 4 12 4 12s1.5 4 0 10Z" fill="#ecc153" opacity="0.45" />
    </svg>
    <svg class="animate-drip absolute -top-4 start-[64%]" width="12" height="28" viewBox="0 0 12 28" style="animation-delay: 2.4s">
      <ellipse cx="6" cy="6" rx="5.5" ry="6" fill="#d18f1f" opacity="0.55" />
      <path d="M6 28C3.5 19 6 14 6 14s2.5 5 0 14Z" fill="#d18f1f" opacity="0.4" />
    </svg>
  </div>

  <div class="relative grid items-center gap-10 px-6 py-14 sm:px-10 lg:grid-cols-2 lg:py-16">
    <div class="motion-safe:animate-fade-up">
      <p class="wordmark text-lg text-gold-400">مملكة النحل</p>
      <h1 class="headline mt-3 text-5xl leading-[1.1] text-parchment sm:text-6xl">
        عسل نقي<br />
        من <span class="text-gold-300">قلب المناحل</span>
      </h1>
      <p class="mt-5 max-w-md text-lg leading-relaxed text-parchment/70">
        من مناحلنا في مصر إلى بيتك — عسل خام 100% بلا إضافات، بعبوات تناسب كل بيت.
      </p>
      <div class="mt-8 flex flex-wrap items-center gap-4">
        <a href="/products" class="btn-gold">
          تسوق الآن
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
        <a href="#categories" class="btn-outline">اكتشف الأصناف</a>
      </div>

      <dl class="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-gold-500/20 pt-6">
        <div>
          <dd class="headline text-3xl text-gold-300" use:countUp={data.products.length}>0</dd>
          <dt class="mt-1 text-xs text-parchment/60">صنف وعسل</dt>
        </div>
        <div>
          <dd class="headline text-3xl text-gold-300" use:countUp={27}>0</dd>
          <dt class="mt-1 text-xs text-parchment/60">محافظة نوصلها</dt>
        </div>
        <div>
          <dd class="headline text-3xl text-gold-300" use:countUp={12000}>0</dd>
          <dt class="mt-1 text-xs text-parchment/60">عميل سعيد</dt>
        </div>
      </dl>
    </div>

    <div class="relative mx-auto hidden w-full max-w-sm lg:block motion-safe:animate-fade-up">
      <div class="absolute -inset-4 -z-0 rounded-[3rem] border border-gold-500/30"></div>
      <figure class="arch-frame-lg relative overflow-hidden border-4 border-gold-500/70 bg-ink-950 shadow-warm-lg">
        <img
          src={data.featured[0]?.variants[0]?.image ?? data.featured[0]?.image}
          alt="عسل طبيعي من مملكة النحل"
          class="aspect-[4/5] h-full w-full object-cover"
        />
        <figcaption class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent p-5 pt-16 text-center">
          <span class="wordmark text-2xl text-gold-300">اختيار النحّال</span>
          <span class="mt-1 block text-xs text-parchment/70">عسل سدر مصري — درة التاج</span>
        </figcaption>
      </figure>
      <div class="animate-float absolute -end-4 -top-6 text-gold-400" aria-hidden="true">
        <svg width="46" height="52" viewBox="0 0 32 32" fill="none">
          <path d="M16 1.5 30 9v14L16 30.5 2 23V9L16 1.5Z" fill="#1a1a13"/>
          <path d="M16 5.5 27.4 12v8L16 26.5 4.6 20v-8L16 5.5Z" fill="#e5a82e"/>
          <path d="M12 13h8M16 9.5v9" stroke="#1a1a13" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="animate-float absolute -start-6 bottom-10 text-gold-500" style="animation-delay: 1.4s" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
          <path d="M16 1.5 30 9v14L16 30.5 2 23V9L16 1.5Z" fill="none" stroke="#e5a82e" stroke-width="1.6"/>
        </svg>
      </div>
    </div>
  </div>
</section>

<div class="mt-10 overflow-hidden border-y border-gold-500/30 bg-ink-950 py-3">
  <div class="animate-marquee flex w-max whitespace-nowrap text-sm font-semibold text-gold-200" aria-hidden="true">
    {#each [0, 1] as _ ( _ )}
      <span class="flex items-center gap-3 px-4">
        <span>عسل طبيعي 100%</span><span class="text-gold-500">•</span>
        <span>شحن لجميع المحافظات</span><span class="text-gold-500">•</span>
        <span>دفع عند الاستلام</span><span class="text-gold-500">•</span>
        <span>تغليف فاخر</span><span class="text-gold-500">•</span>
        <span>خام بلا إضافات</span><span class="text-gold-500">•</span>
      </span>
    {/each}
  </div>
</div>

<section class="mt-16">
  <div class="flex items-end justify-between gap-4" use:reveal>
    <SectionTitle className="text-3xl">اختير لك</SectionTitle>
    <a href="/products" class="btn-outline text-sm">كل المنتجات</a>
  </div>
  <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
    {#each data.featured as product, i (product.id)}
      <div use:reveal={{ delay: i * 60 }}>
        <ProductCard {product} />
      </div>
    {/each}
  </div>
</section>

<section id="categories" class="mt-16">
  <div use:reveal><SectionTitle className="text-3xl">قصة كل كنز</SectionTitle></div>
  <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.categories as cat, i (cat.id)}
      <a
        href={`/products?category=${cat.slug}`}
        class="group relative overflow-hidden rounded-[1.8rem] border border-gold-500/30 bg-ink-950 p-6 text-parchment shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-warm"
        use:reveal={{ delay: i * 70 }}
      >
        <div class="honeycomb-bg absolute inset-0 opacity-20"></div>
        <span class="relative text-xs font-bold uppercase tracking-widest text-gold-400">مملكة النحل</span>
        <h3 class="headline relative mt-2 text-2xl text-gold-200">{cat.name}</h3>
        <p class="relative mt-2 text-sm leading-relaxed text-parchment/70">{categoryStories[cat.slug]}</p>
        <span class="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-300 transition group-hover:gap-2">
          تسوق الآن
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </a>
    {/each}
  </div>
</section>

{#each rails as rail, r (rail.title)}
  {#if bySlug(rail.slugs).length > 0}
    <section class="mt-16">
      <div class="flex items-end justify-between gap-4" use:reveal>
        <div>
          <SectionTitle className="text-3xl">{rail.title}</SectionTitle>
          <p class="mt-1 text-sm text-cocoa-500">{rail.note}</p>
        </div>
        <a href="/products" class="btn-outline text-sm">تصفح الكل</a>
      </div>
      <div class="mt-6 grid grid-cols-2 gap-4 overflow-x-auto sm:grid-cols-3 lg:grid-cols-4">
        {#each bySlug(rail.slugs) as product, i (product.id)}
          <div use:reveal={{ delay: i * 60 }}>
            <ProductCard {product} />
          </div>
        {/each}
      </div>
    </section>
  {/if}
{/each}

<section class="mt-16 rounded-[2rem] border border-gold-500/30 bg-ink-950 px-6 py-10 text-center shadow-warm-sm">
  <SectionTitle className="mx-auto text-3xl text-parchment">لماذا مملكة النحل؟</SectionTitle>
  <div class="mx-auto mt-8 grid max-w-4xl gap-8 sm:grid-cols-3">
    <div use:reveal>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-400/15 text-gold-300">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v3M6.2 5.6l2 2M17.8 5.6l-2 2M4 12h3M17 12h3M6.2 18.4l2-2M17.8 18.4l-2-2M12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.8" />
        </svg>
      </div>
      <h3 class="headline mt-3 text-lg text-gold-200">مصدر موثوق</h3>
      <p class="mt-1 text-sm leading-relaxed text-parchment/60">تعاون مباشر مع مناحل مصرية، بلا وسطاء ولا شوائب.</p>
    </div>
    <div use:reveal={{ delay: 120 }}>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-400/15 text-gold-300">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21c-4-3-7-6.2-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5c0 3.3-3 6.5-7 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 class="headline mt-3 text-lg text-gold-200">توصيل سريع</h3>
      <p class="mt-1 text-sm leading-relaxed text-parchment/60">لكل المحافظات خلال 2-4 أيام عمل، ومجاني فوق 600 ج.م.</p>
    </div>
    <div use:reveal={{ delay: 240 }}>
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-400/15 text-gold-300">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3l-4.8 2.6.9-5.4L4.2 7.7l5.4-.8L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      </div>
      <h3 class="headline mt-3 text-lg text-gold-200">جودة نقيّة</h3>
      <p class="mt-1 text-sm leading-relaxed text-parchment/60">عسل خام غير مبستر، يُعبأ بأيدي نحّالينا وقلوبهم.</p>
    </div>
  </div>
</section>