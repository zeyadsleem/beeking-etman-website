<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowDown, ArrowLeft, ArrowRight, Pause, Play } from "@lucide/svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import HoneyScene from "./landing/HoneyScene.svelte";
  let { lang = "ar" }: { lang?: Lang; productCount: number } = $props();
  let root = $state<HTMLElement>();
  let cue = $state<HTMLSpanElement>();
  let progress = $state(0);
  let ready = $state(false);
  let unavailable = $state(false);
  let staticScene = $state(true);
  let paused = $state(false);
  let heldPosition = $state(0);
  let reduced = $state(false);
  let visible = $state(true);
  let lottie = $state.raw<import("lottie-web").AnimationItem>();
  const position = $derived(reduced || unavailable ? 0 : paused ? heldPosition : progress);
  const phase = $derived(position < .2 ? 0 : position < .45 ? 1 : position < .68 ? 2 : position < .9 ? 3 : 4);
  const Arrow = $derived(lang === "ar" ? ArrowLeft : ArrowRight);
  const chapters = $derived([
    {title:lang === "ar" ? "من قلب الخلية." : "From the heart of the hive.",body:lang === "ar" ? "عسل السدر من مملكة النحل. اكتشفه عن قرب، واختار عسلك على ذوقك." : "Sidr honey by Etman. Take a closer look, then find the honey for your table."},
    {title:lang === "ar" ? "نظرة أقرب." : "A closer look.",body:lang === "ar" ? "تفاصيل تستحق إنك تقف عندها. تعرّف على تشكيلة العسل ومنتجات الخلية." : "Details worth slowing down for. Explore our honey and hive products."},
    {title:lang === "ar" ? "لكل عسل، طابعه." : "Every honey has its character.",body:lang === "ar" ? "من السدر للبرسيم. أنواع وأوزان مختلفة، علشان تلاقي اختيارك." : "From sidr to clover. Different varieties and weights, so you can find your favourite."},
    {title:lang === "ar" ? "مملكة النحل. عتمان." : "The hive. The honey. Etman.",body:lang === "ar" ? "شوف المكونات والأوزان المتاحة في صفحة كل منتج، واختار اللي يناسبك." : "Find ingredients and available weights on each product page, and choose what suits you."},
    {title:lang === "ar" ? "والباقي، على ذوقك." : "The rest is up to your taste.",body:lang === "ar" ? "اختيارات لبيتك. وتجهيزات لمنحلك. اكتشف مملكتنا." : "For your home. For your apiary. Discover our world."},
  ]);
  $effect(() => { if (paused || reduced || !visible) lottie?.pause(); else lottie?.play(); });

  function toggleMotion() { if (!paused) heldPosition=position; paused=!paused; }
  function goToChapter(value:number) {
    if (!root) return;
    const header = Number.parseFloat(getComputedStyle(root).getPropertyValue("--hero-header"));
    const start = root.getBoundingClientRect().top + window.scrollY - header;
    const range = Math.max(0,root.offsetHeight-window.innerHeight+header);
    window.scrollTo({top:start+range*value,behavior:reduced?"instant":"smooth"});
  }
  onMount(() => {
    const element = root;
    const cueElement = cue;
    if (!element || !cueElement) return;
    const mobile = matchMedia("(max-width: 650px), (prefers-reduced-motion: reduce)");
    const syncScene = () => {
      staticScene = mobile.matches || document.documentElement.dataset.theme === "light";
      unavailable = staticScene;
      if (staticScene) ready = false;
    };
    syncScene(); mobile.addEventListener("change", syncScene);
    const themeObserver = new MutationObserver(syncScene);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    let disposed=false;
    let cleanTimeline=()=>{};
    const preference=matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference=()=>{reduced=preference.matches;};
    syncPreference();preference.addEventListener("change",syncPreference);
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});observer.observe(element);
    void Promise.all([import("gsap"),import("gsap/ScrollTrigger")]).then(([{gsap},{ScrollTrigger}])=>{
      if(disposed)return;
      gsap.registerPlugin(ScrollTrigger);
      const playhead={value:0};
      const tween=gsap.to(playhead,{value:1,ease:"none",onUpdate:()=>{progress=playhead.value;},scrollTrigger:{trigger:element,start:()=>`top ${getComputedStyle(element).getPropertyValue("--hero-header").trim()}`,end:"bottom bottom",scrub:.65,invalidateOnRefresh:true}});
      cleanTimeline=()=>{tween.scrollTrigger?.kill();tween.kill();};
    }).catch(()=>{unavailable=true;});
    void import("lottie-web").then(({default:player})=>{
      if(disposed)return;
      lottie=player.loadAnimation({container:cueElement,renderer:"svg",loop:true,autoplay:false,path:"/animations/scroll-cue.json"});
    }).catch(()=>{});
    return ()=>{disposed=true;cleanTimeline();lottie?.destroy();observer.disconnect();themeObserver.disconnect();preference.removeEventListener("change",syncPreference);mobile.removeEventListener("change",syncScene);};
  });
</script>

<section bind:this={root} class="cinema" class:unavailable aria-label={t(lang,"brand.name")}>
  <div class="cinema-stage">
    <div class="stage-heading"><span>{lang === "ar" ? "العسل ومنتجات الخلية" : "HONEY & HIVE PRODUCTS"}</span><a href="#categories">{lang === "ar" ? "انتقل للمتجر" : "Skip to the shop"}<Arrow size={15}/></a></div>
    <h1 class="cinema-word" style:opacity={Math.max(.08,1-position*4)} style:transform={`translateY(${-position*100}px) scale(${1-position*.15})`}><span class="sr-only">{t(lang,"brand.name")} — </span><span aria-hidden="true">ETMAN</span></h1>
    <div class="product-stage">
      <img class="studio-poster" class:loaded={ready && !staticScene} src="/images/editorial/sidr-jar-cutout.png" alt={t(lang,"hero.sidrAlt")} width="1024" height="1536" fetchpriority="high"/>
      {#if !staticScene}<HoneyScene progress={position} onReady={()=>ready=true} onUnavailable={()=>{unavailable=true;ready=false;staticScene=true;}}/>{/if}
    </div>
    <div class="studio-copy">
      {#each chapters as chapter,i}
        <div class="chapter-copy" class:active={phase===i} aria-hidden={phase!==i} inert={phase!==i}>
          <h2>{chapter.title}</h2><p>{chapter.body}</p>
        </div>
      {/each}
    </div>
    <div class="studio-actions"><a class="shop-honey" href="/honey">{t(lang,"nav.storeHoney")}<Arrow size={17}/></a><a class="shop-equipment" href="/equipment">{t(lang,"nav.storeEquipment")}</a></div>
    <div class="studio-bottom">
      <div class="scroll-prompt"><span bind:this={cue} aria-hidden="true"></span><span>{lang === "ar" ? "اسحب لتكتشف" : "SCROLL TO DISCOVER"}</span><ArrowDown size={14}/></div>
      <nav class="camera-chapters" aria-label={lang === "ar" ? "زوايا المشهد" : "Scene viewpoints"}>
        {#each [0,.3,.55,.8] as point,i}<button type="button" class:current={(phase===4?0:phase)===i} aria-label={`${lang==="ar"?"الزاوية":"View"} ${i+1}`} aria-current={(phase===4?0:phase)===i?"step":undefined} onclick={()=>goToChapter(point)}><span></span></button>{/each}
      </nav>
      <button class="motion-toggle" type="button" onclick={toggleMotion} aria-pressed={paused} aria-label={lang==="ar"?(paused?"تشغيل الحركة":"إيقاف الحركة"):(paused?"Play animation":"Pause animation")}>{#if paused}<Play size={15}/>{:else}<Pause size={15}/>{/if}</button>
    </div>
    <div class="scene-note">{lang === "ar" ? "عسل سدر · مملكة النحل" : "SIDR HONEY · BEEKING ETMAN"}</div>
  </div>
</section>

<style>
  .cinema{--hero-header:73px;position:relative;height:360svh;background:var(--color-ink-950);color:var(--color-cocoa-900)}
  .cinema-stage{position:sticky;top:var(--hero-header);height:calc(100svh - var(--hero-header));min-height:580px;isolation:isolate;overflow:hidden}
  .stage-heading{position:absolute;z-index:5;top:2rem;inset-inline:4rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;font-size:.75rem;color:var(--color-cocoa-600)}.stage-heading>a{display:flex;align-items:center;gap:.5rem;min-height:44px}
  .cinema-word{position:absolute;z-index:0;top:10%;inset-inline:0;text-align:center;font-family:"Manrope Variable",ui-sans-serif,system-ui,sans-serif;font-size:clamp(8rem,24vw,23rem);font-weight:800;letter-spacing:-.04em;line-height:1;color:var(--color-honey-400);transform-origin:center;pointer-events:none}
  .product-stage{position:absolute;z-index:1;inset:0;pointer-events:none}.studio-poster{position:absolute;top:18%;height:65%;width:36%;inset-inline-start:32%;object-fit:contain;filter:drop-shadow(0 32px 30px rgb(0 0 0 / .35));transition:opacity .35s}.studio-poster.loaded{opacity:0}
  .studio-copy{position:absolute;z-index:3;top:47%;inset-inline-start:5%;width:24%;max-width:300px;min-height:190px;pointer-events:none}.chapter-copy{position:absolute;inset:0;visibility:hidden;opacity:0;transform:translateY(14px);transition:opacity .45s,transform .6s cubic-bezier(.2,.7,.2,1)}.chapter-copy.active{visibility:visible;opacity:1;transform:none}.chapter-copy h2{font-size:clamp(1.5rem,2.4vw,2.5rem);font-weight:600;line-height:1.5;text-wrap:balance}.chapter-copy p{margin-top:1rem;max-width:24rem;font-size:.9rem;line-height:1.9;color:var(--color-cocoa-600)}
  .studio-actions{position:absolute;z-index:4;bottom:20%;inset-inline-end:5%;display:flex;align-items:flex-start;flex-direction:column;gap:.75rem}.shop-honey{display:inline-flex;align-items:center;justify-content:space-between;gap:2rem;min-height:48px;padding:.8rem 1.4rem;background:var(--color-honey-600);color:var(--color-ink-950);font-weight:700;font-size:.9rem;border-radius:3px;transition:background .2s}.shop-honey:hover{background:var(--color-honey-700)}.shop-equipment{padding:.3rem 0;min-height:44px;border-bottom:1px solid var(--color-cocoa-400);color:var(--color-cocoa-800);font-size:.8rem}
  .studio-bottom{position:absolute;z-index:5;bottom:2rem;inset-inline:4rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}.scroll-prompt{display:flex;align-items:center;gap:.5rem;font-size:.68rem;color:var(--color-cocoa-600)}.scroll-prompt>span:first-child{width:20px;height:30px}.camera-chapters{display:flex;gap:.6rem}.camera-chapters button{width:50px;height:44px;display:grid;place-items:center}.camera-chapters button span{width:100%;height:2px;background:var(--color-cocoa-300);transition:background .3s}.camera-chapters .current span{background:var(--color-honey-600)}.motion-toggle{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--color-cocoa-300);border-radius:50%;color:var(--color-cocoa-800)}.motion-toggle:hover{border-color:var(--color-honey-600)}.scene-note{position:absolute;z-index:3;bottom:12%;inset-inline:35%;text-align:center;font-size:.62rem;color:var(--color-cocoa-500)}
  .unavailable{height:calc(100svh - var(--hero-header));min-height:680px}.unavailable .cinema-stage{position:relative;top:0}.unavailable .camera-chapters{visibility:hidden}
  @media(max-width:1023px){.cinema{--hero-header:69px}.stage-heading,.studio-bottom{inset-inline:1.5rem}.studio-copy{inset-inline-start:3%;width:27%}.chapter-copy h2{font-size:1.5rem}.chapter-copy p{font-size:.8rem}.studio-actions{inset-inline-end:3%}}
  @media(max-width:650px){.product-stage{top:29%;bottom:24%}.product-stage .studio-poster{inset:0;width:100%;height:100%}.cinema{height:calc(100svh - var(--hero-header));min-height:640px}.cinema-stage{min-height:640px}.stage-heading{top:.75rem;inset-inline:1rem;font-size:.65rem}.cinema-word{top:30%;font-size:26vw}.studio-copy{top:12%;inset-inline:1.25rem;max-width:none;width:auto;min-height:100px}.chapter-copy h2{font-size:1.6rem}.chapter-copy p{font-size:.8rem;line-height:1.75;margin-top:.4rem;max-width:19rem}.studio-actions{bottom:13%;inset-inline:1.25rem;flex-direction:row;align-items:center;justify-content:space-between;gap:.8rem}.shop-honey{font-size:.8rem;min-height:44px;padding:.6rem .9rem;gap:.8rem}.shop-equipment{font-size:.7rem}.studio-bottom{bottom:1rem;inset-inline:1.25rem}.scroll-prompt{font-size:.6rem}.camera-chapters{gap:.4rem}.camera-chapters button{width:22px}.scene-note{display:none}.studio-poster{top:30%;height:45%;width:70%;inset-inline-start:15%}.unavailable{height:calc(100svh - var(--hero-header));min-height:640px}}
  @media(max-height:720px){.cinema-stage{min-height:0}.studio-copy{top:35%}.studio-bottom{bottom:.5rem}.studio-actions{bottom:17%}}
  @media(max-width:650px) and (max-height:720px){.studio-copy{top:11%}.chapter-copy h2{font-size:1.25rem}.chapter-copy p{font-size:.72rem;line-height:1.6}.product-stage{top:32%;bottom:27%}.studio-actions{bottom:15%}.scroll-prompt{font-size:.55rem}}
  @media(prefers-reduced-motion:reduce){.cinema{height:calc(100svh - var(--hero-header));min-height:640px}.cinema-stage{position:relative;top:0}.chapter-copy,.studio-poster{transition:none}.camera-chapters,.scroll-prompt,.motion-toggle{visibility:hidden}}
  :global(html[data-theme="light"]) .cinema{background:#f6f1e6;color:#2a2620}
  :global(html[data-theme="light"]) .cinema-word{color:#bf9b52}
  :global(html[data-theme="light"]) .stage-heading,
  :global(html[data-theme="light"]) .scroll-prompt,
  :global(html[data-theme="light"]) .scene-note{color:#51483a}
  :global(html[data-theme="light"]) .chapter-copy h2{color:#2a2620}
  :global(html[data-theme="light"]) .chapter-copy p{color:#4d4539}
  :global(html[data-theme="light"]) .shop-honey{background:#303923;color:#fffdf5}
  :global(html[data-theme="light"]) .shop-honey:hover{background:#465331}
  :global(html[data-theme="light"]) .shop-equipment{color:#332f26;border-color:#716856}
  @media(max-width:650px){.chapter-copy p{font-size:.95rem}}
  @media(max-width:650px) and (max-height:720px){.chapter-copy p{font-size:.875rem}}
</style>
