<script lang="ts">
  import { ArrowLeft, ArrowRight } from "@lucide/svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import Button from "./Button.svelte";

  let { lang = "ar", productCount }: { lang?: Lang; productCount: number } = $props();
  const seal = $derived(lang === "en" ? "/images/etman-wax-en.png" : "/images/etman-wax-ar.png");
  const Arrow = $derived(lang === "ar" ? ArrowLeft : ArrowRight);
</script>

<section class="store-hero">
  <div class="hero-copy">
    <div class="hero-top">
      <div class="hero-lockup">
        <div class="hero-identity">
          <svg class="crown" viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">
            <path d="M4.5 8.5 10 13l6-8.5 6 8.5 5.5-4.5-2.4 11H6.9L4.5 8.5Z" />
            <circle cx="4.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="16" cy="4.5" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="27.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
          </svg>
          <p>{t(lang, "brand.name")}</p>
        </div>
        <p class="hero-since">{t(lang, "hero.since")}</p>
      </div>
      <div class="hero-seal-mobile" aria-hidden="true"><img class="brand-seal" src={seal} alt="" width="384" height="384" /></div>
    </div>
    <h1 class="headline">{lang === "ar" ? "خير المناحل،" : "From the apiary,"}<br /><span>{lang === "ar" ? "لبيتك ولمنحلك." : "to your everyday."}</span></h1>
    <p class="hero-description">{lang === "ar" ? "عسل بطبيعته، ومنتجات خلية النحل، وأدوات يعتمد عليها النحّال. اكتشف كل ما تحتاجه في مكان واحد." : "Discover honey, hive products and dependable beekeeping equipment. Everything for your table and your apiary, in one place."}</p>
    <div class="hero-actions">
      <Button href="/honey" class="px-6 py-3.5">{t(lang, "nav.storeHoney")} <Arrow size={18} /></Button>
      <Button href="/equipment" variant="outline" class="px-6 py-3.5">{t(lang, "nav.storeEquipment")}</Button>
    </div>
    {#if productCount > 0}<p class="hero-caption">{lang === "ar" ? "اختيارات للعائلة، وتجهيزات لأهل الخبرة." : "For honey lovers. For the people who make it."}</p>{/if}
  </div>
  <div class="hero-visual">
    <img class="hero-product" src="/images/Beeking Etman/برطمان السدر المصرى.jpg" alt={t(lang, "hero.sidrAlt")} width="768" height="1024" fetchpriority="high" />
    <div data-testid="hero-brand" class="hero-seal"><img class="brand-seal" data-testid="hero-brand-img" src={seal} alt={t(lang, "brand.tagline")} width="384" height="384" /></div>
    <a class="hero-equipment" href="/equipment">
      <img src="/images/Beeking Etman/شمع اساس.jpg" alt={lang === "ar" ? "شمع أساس" : "Foundation wax sheets"} width="208" height="149" />
      <span><strong>{t(lang, "nav.storeEquipment")}</strong><small>{lang === "ar" ? "جهّز منحلك بثقة" : "Equip your apiary"}</small></span>
      <Arrow size={19} />
    </a>
  </div>
</section>

<style>
  .store-hero{display:grid;align-items:center;gap:4rem;padding:4rem 2rem 4.5rem;background:#fcf8ef;border-radius:0 0 2rem 2rem}
  .hero-copy{max-width:36rem}.hero-top{display:flex;align-items:center;justify-content:space-between;gap:1.5rem}.hero-lockup{display:flex;flex-direction:column;align-items:center;gap:.75rem}.hero-seal-mobile{display:none;width:7.5rem;flex-shrink:0;filter:drop-shadow(0 4px 8px #57381724)}.hero-seal-mobile img{width:100%;height:auto}.hero-identity{display:flex;align-items:center;gap:.6rem;color:#a56512}.crown{width:1.7rem;height:auto;flex-shrink:0}.hero-identity p{font-family:var(--font-display);font-size:1.65rem;font-weight:700}
  .hero-since{display:inline-block;padding:.3rem .85rem;border:1px solid #e4d5b7;border-radius:999px;font-size:.875rem;color:#786345;font-weight:600}
  h1{font-size:clamp(2.8rem,5vw,4.6rem);line-height:1.25;margin-top:1.6rem;color:#302419}h1 span{color:#9b6016}
  .hero-description{margin-top:1.3rem;max-width:32rem;color:#6a6053;line-height:1.95;font-size:1.05rem}.hero-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.7rem}.hero-caption{margin-top:1.8rem;color:#6a6053;font-size:.875rem}
  .hero-visual{position:relative;max-width:29rem;width:100%;justify-self:center;margin-bottom:1.5rem}.hero-product{width:100%;height:31rem;object-fit:cover;border-radius:13rem 13rem 1.5rem 1.5rem}.hero-seal{position:absolute;top:-1rem;inset-inline-end:-1rem;width:8.5rem;filter:drop-shadow(0 4px 8px #57381724)}.hero-seal img{width:100%;height:auto}
  .hero-equipment{display:flex;align-items:center;gap:1rem;position:absolute;bottom:-1.8rem;inset-inline-start:-1.5rem;inset-inline-end:1.5rem;background:white;border:1px solid #ede5d6;border-radius:1rem;padding:1rem;box-shadow:0 10px 30px #4834190c}.hero-equipment img{width:5rem;height:4rem;object-fit:contain}.hero-equipment span{flex:1}.hero-equipment strong{display:block;font-size:.9rem}.hero-equipment small{display:block;color:#625b4e;margin-top:.2rem;font-size:.8125rem}
  @media(min-width:900px){.store-hero{grid-template-columns:1.1fr 1fr}}
  @media(max-width:899px){.store-hero{padding:2.5rem 1.25rem 3.5rem;gap:2rem}.hero-copy{max-width:none}.hero-seal{display:none}.hero-seal-mobile{display:block}.hero-visual{max-width:25rem}.hero-product{height:26rem}.hero-caption{display:none}.hero-equipment{inset-inline-start:0;inset-inline-end:0}}
  @media(max-width:600px){.store-hero{padding:1.75rem 1rem 2.5rem;gap:2rem}h1{font-size:clamp(2.25rem,9vw,3rem);margin-top:1.25rem}.hero-description{font-size:.95rem;line-height:1.8}.hero-actions{gap:.6rem;margin-top:1.25rem}.hero-product{height:20rem}.crown{width:1.5rem}.hero-identity p{font-size:1.4rem}.hero-equipment{gap:.75rem;padding:.75rem}.hero-equipment img{width:4rem}}
</style>
