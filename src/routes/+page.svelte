<script lang="ts">
  import { ArrowLeft, ArrowRight, Truck, PackageCheck, SlidersHorizontal, Wrench } from "@lucide/svelte";
  import Hero from "$lib/components/Hero.svelte";
  import ProductCard from "$lib/components/ProductCard.svelte";
  import Button from "$lib/components/Button.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { organizationJsonLd, websiteJsonLd } from "$lib/seo";
  import { productPhotos } from "$lib/product-media";
  import { t } from "$lib/i18n/messages";
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
  const lang = $derived(data.lang);
  const Arrow = $derived(lang === "ar" ? ArrowLeft : ArrowRight);
  const honey = $derived(data.honey.filter((p) => productPhotos(p).length).slice(0, 4));
  const equipment = $derived(data.equipment.filter((p) => productPhotos(p).length).slice(0, 4));
  const categories = $derived([
    { href: "/honey/clover", ar: "عسل البرسيم", en: "Clover honey", image: "برطمان عسل البرسيم رقم 1.png" },
    { href: "/honey/sidr", ar: "عسل السدر", en: "Sidr honey", image: "برطمان السدر المصرى.jpg" },
    { href: "/honey/nuts-honey", ar: "مكسرات بالعسل", en: "Nuts & honey", image: "علبة مكسرات بالعسل.jpg" },
    { href: "/equipment/smokers", ar: "أدوات النحال", en: "Apiary tools", image: "مدخن نحل استانليس.jpg" },
    { href: "/equipment/suits", ar: "ملابس الحماية", en: "Protective clothing", image: "بدلة النحالين سحاب امامي.jpg" },
    { href: "/equipment/extractors", ar: "فرازات العسل", en: "Honey extractors", image: "فراز يدوي 4 برواز ستانلس.jpg" },
  ]);
  const faqs = $derived([
    { q: lang === "ar" ? "إزاي أختار الحجم المناسب؟" : "How do I choose a size?", a: lang === "ar" ? "افتح صفحة المنتج لعرض الأوزان أو المقاسات المتاحة. السعر والصورة والكمية المتاحة بيتحدثوا مع اختيارك." : "Open a product to see available weights or sizes. The price, photo and available quantity update with your selection." },
    { q: lang === "ar" ? "تكلفة الشحن بتتحسب إزاي؟" : "How is delivery calculated?", a: lang === "ar" ? "اختار محافظتك في صفحة إتمام الطلب، وهتشوف تكلفة الشحن والإجمالي قبل تأكيد الطلب." : "Select your governorate at checkout to see the delivery cost and order total before confirming." },
    { q: lang === "ar" ? "هل أقدر أطلب عسل وأدوات مع بعض؟" : "Can I order honey and equipment together?", a: lang === "ar" ? "أيوه، ضيف المنتجات من القسمين لنفس السلة، وراجع الكميات والاختيارات قبل إتمام الطلب." : "Yes. Add products from both departments to the same cart, then review your selections and quantities at checkout." },
  ]);
</script>

<Seo title={t(lang, "home.title")} description={t(lang, "meta.home.description")} path="/" siteName={t(lang, "brand.name")} jsonLd={[organizationJsonLd(lang), websiteJsonLd(lang)]} />
<Hero {lang} productCount={data.honey.length + data.equipment.length} />
<div class="service-strip">
  <p><Truck size={21} />{t(lang, "home.benefitShipping")}</p>
  <p><SlidersHorizontal size={21} />{lang === "ar" ? "أوزان ومقاسات تناسب احتياجك" : "Sizes to suit your needs"}</p>
  <p><PackageCheck size={21} />{t(lang, "home.benefitGift")}</p>
</div>

<section id="categories" class="home-section">
  <div class="section-heading"><h2 class="headline">{lang === "ar" ? "من الخلية… وإليها" : "From the hive. For the hive."}</h2><a href="/products">{t(lang, "home.allProducts")} <Arrow size={17} /></a></div>
  <div class="category-grid">
    {#each categories as category (category.href)}
      <a href={category.href} class="category-item"><div><img src={`/images/Beeking Etman/${category.image}`} alt="" width="180" height="180" loading="lazy" /></div><h3>{lang === "ar" ? category.ar : category.en}</h3></a>
    {/each}
  </div>
</section>

{#if honey.length}
<section class="home-section">
  <div class="section-heading"><h2 class="headline">{t(lang, "nav.storeHoney")}</h2><a href="/honey">{lang === "ar" ? "تسوق العسل" : "Shop honey"} <Arrow size={17} /></a></div>
  <div class="product-grid">{#each honey as product (product.id)}<ProductCard {lang} {product} />{/each}</div>
</section>
{/if}

<section class="equipment-feature home-section">
  <div class="equipment-copy"><span class="feature-icon"><Wrench size={26} /></span><p class="eyebrow">{lang === "ar" ? "لأهل المنحل" : "For the beekeeper"}</p><h2 class="headline">{lang === "ar" ? "كل أداة، ليها دور." : "Every tool has a purpose."}</h2><p>{lang === "ar" ? "من أول زيارة للخلية لحد موسم الفرز. اكتشف ملابس الحماية، أدوات الفحص، وفرازات العسل، واختار التجهيز المناسب لشغلك." : "From your first hive inspection to harvest day. Explore protective clothing, inspection tools and extractors for your apiary."}</p><Button href="/equipment" class="mt-6">{t(lang, "nav.storeEquipment")} <Arrow size={18} /></Button></div>
  <div class="equipment-photos"><img src="/images/Beeking Etman/فراز يدوي 4 برواز ستانلس.jpg" alt={lang === "ar" ? "فراز عسل يدوي أربع براويز" : "Four-frame manual honey extractor"} width="320" height="340" loading="lazy" /><img src="/images/Beeking Etman/بدلة النحالين سحاب امامي.jpg" alt={lang === "ar" ? "بدلة حماية النحال بسحاب أمامي" : "Front-zip beekeeping suit"} width="260" height="320" loading="lazy" /></div>
</section>

{#if equipment.length}
<section class="home-section">
  <div class="section-heading"><h2 class="headline">{lang === "ar" ? "تجهيزات وأدوات النحالين" : "Beekeeping tools & equipment"}</h2><a href="/equipment">{t(lang, "home.allProducts")} <Arrow size={17} /></a></div>
  <div class="product-grid">{#each equipment as product (product.id)}<ProductCard {lang} {product} />{/each}</div>
</section>
{/if}

<section class="home-section faq-section"><div><p class="eyebrow">{lang === "ar" ? "قبل ما تطلب" : "Before you order"}</p><h2 class="headline">{lang === "ar" ? "تسوق بسهولة" : "Shopping made simple"}</h2><p class="mt-4 text-cocoa-600">{lang === "ar" ? "إجابات سريعة تساعدك تختار وتطلب بثقة." : "A few helpful answers for a confident order."}</p></div><div>{#each faqs as faq (faq.q)}<details><summary>{faq.q}</summary><p>{faq.a}</p></details>{/each}</div></section>

<style>
  .home-section{margin-top:4.5rem;scroll-margin-top:7rem}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.8rem}.section-heading h2,.home-section h2{font-size:clamp(1.8rem,3vw,2.5rem);line-height:1.4;margin-top:.5rem}.section-heading>a{display:flex;align-items:center;gap:.5rem;white-space:nowrap;color:#93590f;font-size:.9375rem;font-weight:600}
  .service-strip{display:grid;grid-template-columns:repeat(3,1fr);padding:1.5rem 0;border-bottom:1px solid #ece6da;gap:1rem}.service-strip p{display:flex;align-items:center;justify-content:center;gap:.65rem;font-size:.875rem;line-height:1.7;color:var(--color-cocoa-700)}.service-strip :global(svg){color:#a86c20;flex-shrink:0}
  .category-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:1.5rem}.category-item{text-align:center}.category-item>div{aspect-ratio:1;border-radius:50%;background:#fff;border:1px solid #eee7db;padding:1.2rem;overflow:hidden;transition:border-color .2s}.category-item:hover>div{border-color:#b58037}.category-item img{width:100%;height:100%;object-fit:contain;border-radius:50%}.category-item h3{font-weight:600;font-size:.9rem;margin-top:1rem}
  .product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.2rem}.equipment-feature{display:grid;grid-template-columns:1fr 1.1fr;align-items:center;background:#f5f3ec;border-radius:1.5rem;overflow:hidden;padding:3rem;gap:3rem}.equipment-copy>p:not(.eyebrow){color:#756b5e;line-height:1.9;margin-top:1rem;max-width:30rem}.feature-icon{display:grid;place-items:center;border-radius:50%;width:3.5rem;height:3.5rem;background:white;color:#9b681c;margin-bottom:1.4rem}.equipment-photos{display:flex;gap:1rem;align-items:center}.equipment-photos img{width:50%;height:20rem;object-fit:contain;mix-blend-mode:multiply}.equipment-photos img+img{height:16rem}
  .faq-section{display:grid;grid-template-columns:1fr 1.4fr;gap:4rem;padding:2rem 0}details{border-bottom:1px solid #e8e2d7;padding:1.25rem 0}summary{cursor:pointer;font-weight:600;font-size:.95rem}details p{font-size:.9rem;line-height:1.9;color:#756b5e;margin-top:1rem}
  @media(max-width:900px){.category-grid{gap:1rem;grid-template-columns:repeat(3,1fr)}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.equipment-feature{gap:1.5rem;padding:2rem}.equipment-photos img{height:15rem}.faq-section{gap:2rem}}
  @media(max-width:600px){.home-section{margin-top:3rem}.section-heading{align-items:start;flex-direction:column;gap:.75rem}.category-item>div{padding:.75rem}.category-item h3{font-size:.875rem}.product-grid{gap:.65rem}.service-strip{grid-template-columns:1fr;gap:.6rem;padding:1.25rem 0}.service-strip p{flex-direction:row;justify-content:flex-start;text-align:start;font-size:.9375rem;line-height:1.6;color:var(--color-cocoa-700)}.equipment-feature,.faq-section{grid-template-columns:1fr;padding:1.5rem;gap:1.5rem}.equipment-photos img{height:13rem}.faq-section{padding:0}}
  .section-heading>a{min-height:2.75rem;color:var(--color-honey-800)}
  .section-heading h2{margin-top:0}
  .category-item h3{line-height:1.6}
  summary{line-height:1.7;padding-inline-end:.5rem}
  @media(max-width:600px){.equipment-feature{padding:1.25rem}.category-grid{gap:1.25rem .75rem;grid-template-columns:repeat(2,1fr)}.category-item h3{margin-top:.65rem}.section-heading{gap:.25rem;margin-bottom:1.25rem}}
</style>
