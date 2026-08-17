<script lang="ts">
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { Dialog } from "bits-ui";
  import { cartCount, openDrawer } from "$lib/cart-store.svelte";
  import { getDir, t, type Lang } from "$lib/i18n/messages";
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
  let mobileOpen = $state(false);

  const q = $derived(String(page.url.searchParams.get("q") ?? ""));
  const isHome = $derived(page.url.pathname === "/");
  const showHeaderSearch = $derived(isHome || page.url.pathname.startsWith("/products/"));

  $effect(() => {
    count = cartCount();
  });

  function search(q: string) {
    void goto(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  function closeMobile() {
    mobileOpen = false;
  }

  function onMobileSearch(query: string) {
    closeMobile();
    search(query);
  }

  function onMobileSelect(value: string) {
    closeMobile();
    void goto(value);
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

  async function switchLanguageFromMenu() {
    closeMobile();
    await switchLanguage();
  }
</script>

<header class="sticky top-0 z-30 border-b border-cocoa-100 bg-paper/85 backdrop-blur">
  <div class="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3">
    <div class="col-start-1 flex min-w-0 items-center gap-5 justify-self-start">
      <a href="/" class="flex items-center gap-2.5 transition-colors hover:opacity-80" aria-label={t(lang, "brand.tagline")}>
        <img src="/images/logo.png" alt={t(lang, "brand.tagline")} class="h-10 w-10 object-contain" />
      </a>

      <nav class="hidden items-center gap-5 text-sm font-semibold text-cocoa-700 lg:flex" aria-label={t(lang, "nav.main")}>
        <a href="/" class="shrink-0 transition-colors hover:text-honey-700">{t(lang, "nav.home")}</a>
        <a href="/products" class="shrink-0 transition-colors hover:text-honey-700">{t(lang, "nav.store")}</a>
        <a href="/blends" class="shrink-0 font-bold text-honey-700 transition-colors hover:text-honey-800">{t(lang, "blends.nav")}</a>
        {#each categories as cat}
          <a href={`/products?category=${cat.slug}`} class="hidden shrink-0 transition-colors hover:text-honey-700 xl:inline">{cat.name}</a>
        {/each}
      </nav>
    </div>

    {#if showHeaderSearch}
      <div class="col-start-2 hidden w-full max-w-lg justify-self-center lg:block">
        <SearchSuggestions
          lang={lang}
          initial={q}
          placeholder={t(lang, "search.placeholder")}
          ariaLabel={t(lang, "search.aria")}
          inputClass="bg-parchment"
          class="w-full"
          onSearch={search}
          onSelect={(value) => goto(value)}
        />
      </div>
    {/if}

    <div class="col-start-3 flex items-center gap-2 justify-self-end">
      <Button
        variant="outline"
        type="button"
        onclick={switchLanguage}
        class="hidden shrink-0 items-center gap-2 px-4 py-2.5 lg:inline-flex"
        aria-label={t(lang, "lang.switchTo")}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <span class="text-sm font-semibold">{t(lang, "lang.short")}</span>
      </Button>

      {#if user}
        <Button
          variant="outline"
          href="/account/orders"
          class="hidden shrink-0 items-center gap-2 px-4 py-2.5 lg:inline-flex"
          aria-label={t(lang, "nav.account")}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" />
            <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span class="max-w-28 truncate text-sm font-semibold">{user.name ?? t(lang, "nav.account")}</span>
        </Button>
      {:else}
        <Button
          variant="outline"
          href="/login"
          class="hidden shrink-0 items-center gap-2 px-4 py-2.5 lg:inline-flex"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" />
            <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span class="text-sm font-semibold">{t(lang, "nav.login")}</span>
        </Button>
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

      <button
        type="button"
        class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cocoa-200 bg-paper text-cocoa-700 transition-colors hover:border-honey-700 hover:text-honey-700 lg:hidden"
        aria-label={t(lang, "nav.menu")}
        aria-expanded={mobileOpen}
        onclick={() => (mobileOpen = true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</header>

<Dialog.Root bind:open={mobileOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-40 bg-cocoa-950/40 backdrop-blur-sm" />
    <Dialog.Content
      dir={getDir(lang)}
      class="fixed inset-y-0 start-0 z-50 flex w-80 max-w-[85vw] flex-col border-e border-cocoa-100 bg-parchment shadow-warm-lg focus:outline-none"
    >
      <Dialog.Title class="sr-only">{t(lang, "nav.main")}</Dialog.Title>
      <header class="flex items-center justify-between border-b border-cocoa-200 px-4 py-3">
        <a href="/" class="flex items-center gap-2.5" onclick={closeMobile}>
          <img src="/images/logo.png" alt={t(lang, "brand.tagline")} class="h-9 w-9 object-contain" />
        </a>
        <Dialog.Close
          class="grid h-9 w-9 place-items-center rounded-full text-cocoa-400 transition-colors hover:bg-cocoa-100 hover:text-cocoa-900"
          aria-label={t(lang, "nav.closeMenu")}
        >✕</Dialog.Close>
      </header>

      <div class="flex-1 overflow-y-auto p-4">
        <SearchSuggestions
          lang={lang}
          initial={q}
          placeholder={t(lang, "search.placeholder")}
          ariaLabel={t(lang, "search.aria")}
          inputClass="bg-paper"
          class="flex flex-col gap-2"
          onSearch={onMobileSearch}
          onSelect={onMobileSelect}
        />

        <nav class="mt-4 flex flex-col" aria-label={t(lang, "nav.main")}>
          <a href="/" onclick={closeMobile} class="rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800">{t(lang, "nav.home")}</a>
          <a href="/products" onclick={closeMobile} class="rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800">{t(lang, "nav.store")}</a>
          <a href="/blends" onclick={closeMobile} class="rounded-xl px-4 py-3 text-sm font-bold text-honey-700 transition-colors hover:bg-honey-50 hover:text-honey-800">{t(lang, "blends.nav")}</a>
          {#each categories as cat}
            <a href={`/products?category=${cat.slug}`} onclick={closeMobile} class="rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800">{cat.name}</a>
          {/each}
        </nav>

        <div class="mt-4 space-y-1 border-t border-cocoa-200 pt-4">
          <button
            type="button"
            onclick={switchLanguageFromMenu}
            class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
              <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            {t(lang, "lang.switchTo")}
          </button>
          {#if user}
            <a href="/account/orders" onclick={closeMobile} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" />
                <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
              {user.name ?? t(lang, "nav.account")}
            </a>
          {:else}
            <a href="/login" onclick={closeMobile} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" />
                <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
              {t(lang, "nav.login")}
            </a>
          {/if}
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>