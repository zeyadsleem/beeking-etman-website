<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { cartCount, openDrawer } from "$lib/cart-store.svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import Button from "./Button.svelte";
  import SearchSuggestions from "./SearchSuggestions.svelte";

  let {
    categories,
    user,
    lang = "ar",
  }: {
    categories: { name: string; slug: string }[];
    user?: { name?: string | null } | null;
    lang?: Lang;
  } = $props();

  let count = $state(0);

  $effect(() => {
    count = cartCount();
  });

  function search(q: string) {
    void goto(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  // Persist the new language via the API, then re-render all routes inside a
  // view transition so the direction/language swap cross-fades smoothly
  // instead of a hard reload. On failure the current language is kept.
  async function switchLanguage() {
    const target = lang === "ar" ? "en" : "ar";
    try {
      await fetch(`/api/lang?lang=${target}`, { method: "POST" });
      if (document.startViewTransition) {
        const transition = document.startViewTransition(() => invalidateAll());
        await transition.finished;
      } else {
        await invalidateAll();
      }
    } catch {
      // keep the current language on failure; nothing to undo
    }
  }
</script>

<header class="sticky top-0 z-30 border-b border-cocoa-100 bg-paper/85 backdrop-blur">
  <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
    <a href="/" class="flex items-center gap-2.5 transition-colors hover:opacity-80">
      <img src="/images/logo.png" alt={t(lang, "brand.tagline")} class="h-10 w-10 object-contain" />
      <span class="sr-only">{t(lang, "brand.tagline")}</span>
    </a>

    <nav class="hidden items-center gap-5 text-sm font-semibold text-cocoa-700 lg:flex" aria-label={t(lang, "nav.main")}>
      <a href="/" class="shrink-0 transition-colors hover:text-honey-700">{t(lang, "nav.home")}</a>
      <a href="/products" class="shrink-0 transition-colors hover:text-honey-700">{t(lang, "nav.store")}</a>
      {#each categories as cat}
        <a href={`/products?category=${cat.slug}`} class="hidden shrink-0 transition-colors hover:text-honey-700 xl:inline">{cat.name}</a>
      {/each}
    </nav>

    <SearchSuggestions
      lang={lang}
      placeholder={t(lang, "search.placeholder")}
      ariaLabel={t(lang, "search.aria")}
      inputClass="bg-parchment"
      class="ms-auto hidden min-w-40 flex-1 max-w-xs items-center gap-2 sm:flex"
      onSearch={search}
      onSelect={(value) => goto(value)}
    />

    <div class="ms-auto flex items-center gap-3 sm:ms-0">
      <button type="button" onclick={switchLanguage} class="hidden shrink-0 text-sm font-semibold text-cocoa-500 transition-colors hover:text-honey-700 sm:block">
        {t(lang, "lang.switchTo")}
      </button>
      {#if user}
        <a href="/account/orders" class="hidden text-sm font-semibold text-cocoa-700 hover:text-honey-700 sm:block">{user.name ?? t(lang, "nav.account")}</a>
        <Button variant="outline" href="/account/orders" class="sm:hidden">{t(lang, "nav.account")}</Button>
      {:else}
        <Button variant="outline" href="/login">{t(lang, "nav.login")}</Button>
      {/if}
      <Button variant="primary" type="button" onclick={openDrawer} class="relative px-5 py-2.5" aria-label={t(lang, "cart.open")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 6h2l1.2 8.1A2 2 0 0 0 8.2 16h8.4a2 2 0 0 0 2-1.6L20 8H5"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="10" cy="20" r="1.4" fill="currentColor" />
          <circle cx="17" cy="20" r="1.4" fill="currentColor" />
        </svg>
        {t(lang, "cart.title")}
        {#if count > 0}
          <span
            class="absolute -top-1.5 -end-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-honey-700 px-1.5 text-xs font-bold text-parchment shadow-warm-sm"
            data-testid="cart-count"
          >
            {count}
          </span>
        {/if}
      </Button>
    </div>
  </div>
</header>