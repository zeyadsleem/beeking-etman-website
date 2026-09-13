<script lang="ts">
  import { t, type Lang } from "$lib/i18n/messages";
  import Logo from "./Logo.svelte";

  let { lang = "ar" }: { lang?: Lang } = $props();

  const year = new Date().getFullYear();
</script>

<footer class="mt-16 border-t border-honey-100 bg-cream">
  <div class="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
    <!-- Brand -->
    <div class="sm:col-span-2 lg:col-span-1">
      <a href="/" class="flex items-center gap-3 transition-opacity hover:opacity-90">
        <Logo alt={t(lang, "brand.tagline")} class="h-16 w-16 shrink-0" />
        <span class="flex flex-col leading-none">
          <span class="font-display text-xl font-bold text-cocoa-900">{t(lang, "brand.name")}</span>
        </span>
      </a>
      <p class="mt-4 max-w-xs text-sm leading-relaxed text-cocoa-600">{lang === "ar" ? "عسل ومنتجات خلية النحل، وأدوات لكل مرحلة في المنحل." : "Honey, hive products and equipment for every stage of beekeeping."}</p>
    </div>

    <!-- Site links -->
    <nav class="flex flex-col gap-2.5 text-sm" aria-label={t(lang, "footer.navAria")}>
      <span class="mb-1 font-bold text-cocoa-800">{t(lang, "footer.siteTitle")}</span>
      <a href="/" class="w-fit text-cocoa-600 transition-colors hover:text-honey-700">{t(lang, "nav.home")}</a>
      <a href="/honey" class="w-fit text-cocoa-600 transition-colors hover:text-honey-700">{t(lang, "nav.storeHoney")}</a>
      <a href="/equipment" class="w-fit text-cocoa-600 transition-colors hover:text-honey-700">{t(lang, "nav.storeEquipment")}</a>
      <a href="/blends" class="w-fit text-cocoa-600 transition-colors hover:text-honey-700">{t(lang, "blends.nav")}</a>
      <a href="/about" class="w-fit text-cocoa-600 transition-colors hover:text-honey-700">{t(lang, "nav.about")}</a>
      <a href="/cart" class="w-fit text-cocoa-600 transition-colors hover:text-honey-700">{t(lang, "nav.cart")}</a>
    </nav>

    <!-- About -->
    <div class="flex flex-col gap-2.5 text-sm">
      <span class="mb-1 font-bold text-cocoa-800">{t(lang, "footer.aboutTitle")}</span>
      <p class="max-w-xs leading-relaxed text-cocoa-600">{lang === "ar" ? "تعرّف على قصتنا وخبرتنا في العسل وتجهيز المناحل." : "Discover our story and experience in honey and apiary supplies."}</p>
      <a href="/about" class="mt-1 inline-flex w-fit items-center gap-1 font-semibold text-honey-700 transition-colors hover:text-honey-800">
        {t(lang, "footer.about")}
      </a>
    </div>

    <!-- Contact / location -->
    <div class="flex flex-col gap-2.5 text-sm">
      <span class="mb-1 font-bold text-cocoa-800">{t(lang, "footer.contactTitle")}</span>
      <p class="max-w-xs leading-relaxed text-cocoa-600">{t(lang, "footer.contactBody")}</p>
      <a href="/about" class="mt-1 inline-flex w-fit items-center gap-1 font-semibold text-honey-700 transition-colors hover:text-honey-800">
        {t(lang, "footer.contactCta")}
      </a>
    </div>
  </div>
  <div class="border-t border-honey-100 py-4 text-center text-xs text-cocoa-500">
    {t(lang, "footer.copyright", { year })}
  </div>
</footer>
