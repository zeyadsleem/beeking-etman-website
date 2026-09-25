<script lang="ts">
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { Dialog } from "bits-ui";
  import { onMount } from "svelte";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import { cartCount, openDrawer } from "$lib/cart-store.svelte";
  import { edgeForDir, isEdgeSwipe } from "$lib/edge-swipe";
  import { getDir, t, type Lang } from "$lib/i18n/messages";
  import Button from "./Button.svelte";
  import GlobeIcon from "./GlobeIcon.svelte";
  import HeaderSearch from "./HeaderSearch.svelte";
  import Logo from "./Logo.svelte";
  import SearchSuggestions from "./SearchSuggestions.svelte";
  import UserIcon from "./UserIcon.svelte";

  const NAV_ITEMS = [
    { href: "/", labelKey: "nav.home" },
    { href: "/honey", labelKey: "nav.storeHoney" },
    { href: "/equipment", labelKey: "nav.storeEquipment" },
    { href: "/about", labelKey: "nav.about" },
  ] as const;

  const ICON_BUTTON =
    "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cocoa-200 bg-paper text-cocoa-700 transition-colors hover:border-honey-700 hover:text-honey-700";
  const SIDEBAR_ITEM =
    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-cocoa-800 transition-colors hover:bg-honey-50 hover:text-honey-800";

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
  const isAdmin = $derived(user?.role === "admin");

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

<header class:cinematic={page.url.pathname === "/"} class="sticky top-0 z-30 border-b border-cocoa-200 bg-paper">
  <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
    <div class="flex min-w-0 items-center gap-4 lg:gap-5">
      <a href="/" class="flex shrink-0 items-center transition-opacity hover:opacity-90" aria-label={t(lang, "brand.tagline")}>
        <Logo alt={t(lang, "brand.tagline")} class="h-11 w-11 lg:h-12 lg:w-12" />
      </a>

      <nav class="hidden min-w-0 items-center gap-3 text-sm font-semibold text-cocoa-700 lg:flex xl:gap-4" aria-label={t(lang, "nav.main")}>
        {#each NAV_ITEMS as item (item.href)}
          {@const active = item.href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(item.href)}
          <a
            href={item.href}
            aria-current={active ? "page" : undefined}
            class="inline-flex min-h-11 shrink-0 items-center border-b-2 transition-colors hover:text-honey-700 {active ? "border-honey-700 font-bold text-honey-700" : "border-transparent"}"
          >{t(lang, item.labelKey)}</a>
        {/each}
      </nav>
    </div>

    <div class="ms-auto flex items-center gap-2">
      {#if showHeaderSearch}
        <div class="header-search max-lg:hidden">
          <HeaderSearch
            {lang}
            initial={q}
            onSearch={search}
            onSelect={(value) => goto(value)}
          />
        </div>
      {/if}

      <button
        type="button"
        onclick={switchLanguage}
        class={`${ICON_BUTTON} max-lg:hidden`}
        aria-label={t(lang, "lang.switchTo")}
      >
        <GlobeIcon size={19} />
      </button>

      {#if isAdmin}
        <a href="/admin" class={`${ICON_BUTTON} max-lg:hidden`} aria-label={t(lang, "nav.admin")}>
          <LayoutDashboard class="h-[19px] w-[19px]" strokeWidth={2} />
        </a>
      {/if}

      <a
        href={user ? "/account" : "/login"}
        class={ICON_BUTTON}
        aria-label={user ? t(lang, "nav.account") : t(lang, "nav.login")}
      >
        <UserIcon size={19} />
      </a>

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
        class={`${ICON_BUTTON} lg:hidden`}
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
      </div>

      <div class="border-t border-cocoa-200 bg-paper p-4">
        <div class="flex flex-col gap-1">
          {#if user}
            <a href="/account" onclick={closeMobile} class={SIDEBAR_ITEM}>
              <UserIcon size={18} />
              <span class="truncate">{user.name ?? t(lang, "nav.account")}</span>
            </a>
            {#if isAdmin}
              <a href="/admin" onclick={closeMobile} class={SIDEBAR_ITEM}>
                <LayoutDashboard class="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                <span>{t(lang, "nav.admin")}</span>
              </a>
            {/if}
          {:else}
            <a href="/login" onclick={closeMobile} class={SIDEBAR_ITEM}>
              <UserIcon size={18} />
              <span>{t(lang, "nav.login")}</span>
            </a>
          {/if}
          <button type="button" onclick={switchLanguageFromMenu} class={SIDEBAR_ITEM}>
            <GlobeIcon size={18} />
            <span>{t(lang, "lang.switchTo")}</span>
          </button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
.cinematic{background:#141611;border-color:#34372b;color:#e3decc}
.cinematic :global(nav a){color:#ccc8b9}
.cinematic :global(nav a[aria-current="page"]){color:#dbc38c;border-color:#dbc38c}
.cinematic :global(button.rounded-full),.cinematic :global(a.rounded-full){background:#22251c;border-color:#555943;color:#e3decc}
.cinematic :global(.btn-primary){background:#d3b87b;color:#171a11;border-color:#d3b87b}
</style>
