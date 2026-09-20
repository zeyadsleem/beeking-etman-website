<script lang="ts">
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { Dialog } from "bits-ui";
  import { onMount } from "svelte";
  import { cartCount, openDrawer } from "$lib/cart-store.svelte";
  import { edgeForDir, isEdgeSwipe } from "$lib/edge-swipe";
  import { getDir, t, type Lang } from "$lib/i18n/messages";
  import Button from "./Button.svelte";
  import GlobeIcon from "./GlobeIcon.svelte";
  import Logo from "./Logo.svelte";
  import SearchSuggestions from "./SearchSuggestions.svelte";
  import UserIcon from "./UserIcon.svelte";

  const NAV_ITEMS = [
    { href: "/", labelKey: "nav.home" },
    { href: "/honey", labelKey: "nav.storeHoney" },
    { href: "/equipment", labelKey: "nav.storeEquipment" },
    { href: "/about", labelKey: "nav.about" },
  ] as const;

  let {
    user,
    lang = "ar",
  }: {
    user?: { name?: string | null; role?: string | null } | null;
    lang?: Lang;
  } = $props();

  let count = $state(0);
  let mobileOpen = $state(false);
  let touchStart: { x: number; y: number } | null = $state(null);
  const LG_BREAKPOINT = 1024;

  onMount(() => {
    const desktop = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    const closeOnDesktop = (): void => {
      if (desktop.matches) mobileOpen = false;
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  });

  function onTouchStart(event: TouchEvent) {
    if (mobileOpen || window.innerWidth >= LG_BREAKPOINT || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchStart;
    touchStart = null;
    if (!start || mobileOpen) return;
    const touch = event.changedTouches[0];
    if (
      touch &&
      isEdgeSwipe(start, { x: touch.clientX, y: touch.clientY }, {
        edge: edgeForDir(getDir(lang)),
        viewportWidth: window.innerWidth,
      })
    ) {
      mobileOpen = true;
    }
  }

  function onTouchCancel() {
    touchStart = null;
  }

  const q = $derived(String(page.url.searchParams.get("q") ?? ""));
  const storeSearchPaths = new Set(["/products", "/honey", "/equipment"]);
  const showHeaderSearch = $derived(!storeSearchPaths.has(page.url.pathname));

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
    } catch {
      // keep the current language on failure; nothing to undo
      return;
    }
    if (document.startViewTransition) {
      try {
        const transition = document.startViewTransition(() => invalidateAll());
        await transition.finished;
      } catch {
        // a transition is already running; re-render without it
        await invalidateAll();
      }
    } else {
      await invalidateAll();
    }
  }

  async function switchLanguageFromMenu() {
    closeMobile();
    await switchLanguage();
  }
</script>

<svelte:window ontouchstart={onTouchStart} ontouchend={onTouchEnd} ontouchcancel={onTouchCancel} />

<header class="sticky top-0 z-30 border-b border-cocoa-200 bg-paper">
  <div class="header-grid mx-auto max-w-7xl px-4 py-3" class:has-search={showHeaderSearch}>
    <div class="header-brand flex min-w-0 items-center gap-4 lg:gap-5">
      <a href="/" class="flex shrink-0 items-center transition-opacity hover:opacity-90" aria-label={t(lang, "brand.tagline")}>
        <Logo alt={t(lang, "brand.tagline")} class="h-11 w-11 lg:h-14 lg:w-14" />
      </a>
    </div>

    <nav class="header-nav hidden min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-cocoa-700 lg:flex" aria-label={t(lang, "nav.main")}>
      {#each NAV_ITEMS as item (item.href)}
        {@const active = item.href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(item.href)}
        <a
          href={item.href}
          aria-current={active ? "page" : undefined}
          class="inline-flex min-h-11 shrink-0 items-center border-b-2 transition-colors hover:text-honey-700 {active ? "border-honey-700 font-bold text-honey-700" : "border-transparent"}"
        >{t(lang, item.labelKey)}</a>
      {/each}
    </nav>

    {#if showHeaderSearch}
      <div class="header-search hidden min-w-0 lg:block">
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

    <div class="header-actions flex min-w-0 flex-wrap items-center justify-end gap-2">
      <Button
        variant="outline"
        type="button"
        onclick={switchLanguage}
        class="hidden shrink-0 items-center gap-2 px-4 py-2.5 lg:inline-flex"
        aria-label={t(lang, "lang.switchTo")}
      >
        <GlobeIcon size={17} />
        <span class="text-sm font-semibold">{t(lang, "lang.short")}</span>
      </Button>

      {#if user}
        {#if user.role === "admin"}
          <Button
            variant="outline"
            href="/admin"
            class="hidden shrink-0 items-center gap-2 px-4 py-2.5 lg:inline-flex"
            aria-label={t(lang, "nav.admin")}
          >
            <span class="max-w-28 truncate text-sm font-semibold">{t(lang, "nav.admin")}</span>
          </Button>
        {/if}
        <Button
          variant="outline"
          href="/account"
          class="hidden shrink-0 items-center gap-2 px-4 py-2.5 lg:inline-flex"
          aria-label={t(lang, "nav.account")}
        >
          <UserIcon size={17} />
          <span class="max-w-28 truncate text-sm font-semibold">{user.name ?? t(lang, "nav.account")}</span>
        </Button>
      {:else}
        <Button
          variant="outline"
          href="/login"
          class="hidden shrink-0 items-center gap-2 px-4 py-2.5 lg:inline-flex"
        >
          <UserIcon size={17} />
          <span class="text-sm font-semibold">{t(lang, "nav.login")}</span>
        </Button>
      {/if}

      <Button variant="primary" type="button" onclick={openDrawer} class="relative h-11 w-11 shrink-0 px-0 py-0" aria-label={t(lang, "cart.open")}>
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
        {#if count > 0}
          <span
            class="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-honey-700 px-1 text-xs font-bold text-parchment ring-2 ring-paper"
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
      aria-describedby={undefined}
      class="fixed inset-y-0 end-0 z-50 flex w-80 max-w-[85vw] flex-col border-s border-cocoa-100 bg-parchment shadow-warm-lg focus:outline-none"
      onCloseAutoFocus={(event) => {
        if (window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`).matches) {
          event.preventDefault();
          document.getElementById("main-content")?.focus({ preventScroll: true });
        }
      }}
    >
      <Dialog.Title class="sr-only">{t(lang, "nav.main")}</Dialog.Title>
      <header class="flex items-center justify-between border-b border-cocoa-200 px-4 py-3">
        <a href="/" class="flex items-center gap-2.5" onclick={closeMobile}>
          <Logo alt={t(lang, "brand.tagline")} class="h-11 w-11" />
        </a>
        <Dialog.Close
          class="grid h-11 w-11 place-items-center rounded-full text-cocoa-600 transition-colors hover:bg-cocoa-100 hover:text-cocoa-900"
          aria-label={t(lang, "nav.closeMenu")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </Dialog.Close>
      </header>

      <div class="flex-1 overflow-y-auto p-4">
        {#if showHeaderSearch}
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
        {/if}

        <nav class="mt-4 flex flex-col" aria-label={t(lang, "nav.main")}>
        {#each NAV_ITEMS as item (item.href)}
          {@const active = item.href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(item.href)}
          <a
            href={item.href}
            onclick={closeMobile}
            aria-current={active ? "page" : undefined}
            class="rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800 {active ? "bg-honey-50 font-bold text-honey-700" : ""}"
          >{t(lang, item.labelKey)}</a>
        {/each}
        </nav>

        <div class="mt-4 space-y-1 border-t border-cocoa-200 pt-4">
          <button
            type="button"
            onclick={switchLanguageFromMenu}
            class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800"
          >
            <GlobeIcon size={18} />
            {t(lang, "lang.switchTo")}
          </button>
          {#if user}
            {#if user.role === "admin"}
              <a
                href="/admin"
                onclick={closeMobile}
                class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800"
              >
                {t(lang, "nav.admin")}
              </a>
            {/if}
            <a href="/account" onclick={closeMobile} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800">
              <UserIcon size={18} />
              {user.name ?? t(lang, "nav.account")}
            </a>
          {:else}
            <a href="/login" onclick={closeMobile} class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800">
              <UserIcon size={18} />
              {t(lang, "nav.login")}
            </a>
          {/if}
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .header-grid {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem 1.5rem;
  }
  .header-brand {
    grid-column: 1;
    grid-row: 1;
  }
  .header-actions {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
  }
  @media (min-width: 64rem) {
    .header-grid {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .header-nav {
      grid-column: 1;
      grid-row: 2;
    }
    .header-search {
      grid-column: 2;
      grid-row: 2;
      inline-size: clamp(14rem, 22vw, 20rem);
    }
    .header-grid:not(.has-search) .header-nav {
      grid-column: 1 / -1;
    }
  }
  @media (min-width: 80rem) {
    .header-grid {
      grid-template-columns: auto minmax(0, 1fr) auto auto;
    }
    .header-brand {
      grid-column: 1;
    }
    .header-nav {
      grid-column: 2;
      grid-row: 1;
    }
    .header-grid:not(.has-search) .header-nav {
      grid-column: 2;
    }
    .header-search {
      grid-column: 3;
      grid-row: 1;
    }
    .header-actions {
      grid-column: 4;
      grid-row: 1;
    }
    .header-grid:not(.has-search) {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .header-grid:not(.has-search) .header-actions {
      grid-column: 3;
    }
  }
</style>
