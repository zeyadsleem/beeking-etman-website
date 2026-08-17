<script lang="ts">
  import { t, type Lang } from "$lib/i18n/messages";

  let { lang = "ar" }: { lang?: Lang } = $props();

  const year = new Date().getFullYear();
</script>

<footer class="mt-16 border-t border-cocoa-200 bg-cocoa-50">
  <div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <a href="/" class="flex items-center gap-2.5 transition-colors hover:opacity-80">
        <img src="/images/logo.png" alt={t(lang, "brand.tagline")} class="h-10 w-10 object-contain" />
        <span class="sr-only">{t(lang, "brand.tagline")}</span>
      </a>
      <p class="mt-3 max-w-xs text-sm text-cocoa-600">{t(lang, "footer.tagline")}</p>
    </div>
    <nav class="flex flex-col gap-2 text-sm" aria-label={t(lang, "footer.navAria")}>
      <span class="mb-1 font-bold text-cocoa-800">{t(lang, "footer.site")}</span>
      <a href="/" class="transition-colors text-cocoa-600 hover:text-honey-700">{t(lang, "nav.home")}</a>
      <a href="/products" class="transition-colors text-cocoa-600 hover:text-honey-700">{t(lang, "nav.store")}</a>
      <a href="/blends" class="transition-colors text-cocoa-600 hover:text-honey-700">{t(lang, "blends.nav")}</a>
      <a href="/cart" class="transition-colors text-cocoa-600 hover:text-honey-700">{t(lang, "nav.cart")}</a>
    </nav>
    <div class="text-sm">
      <span class="mb-1 block font-bold text-cocoa-800">{t(lang, "footer.about")}</span>
      <p class="max-w-xs text-cocoa-600">
        {t(lang, "footer.aboutBody")}
      </p>
    </div>
  </div>
  <div class="border-t border-cocoa-200 py-4 text-center text-xs text-cocoa-500">
    {t(lang, "footer.copyright", { year })}
  </div>
</footer>