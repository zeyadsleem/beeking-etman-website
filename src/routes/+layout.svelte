<script lang="ts">
  import { afterNavigate, beforeNavigate, onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { getDir, t } from "$lib/i18n/messages";
  import { initPostHog, setPersonProperties, getPostHog } from "$lib/analytics";
  import { posthogKey } from "$lib/site";
  import "./layout.css";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import CartDrawer from "$lib/components/CartDrawer.svelte";
  import ScrollToTop from "$lib/components/ScrollToTop.svelte";
  import TopProgressBar from "$lib/components/TopProgressBar.svelte";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();

  const isAdminRoute = $derived(
    page.url.pathname === "/admin" || page.url.pathname.startsWith("/admin/"),
  );

  $effect(() => {
    document.documentElement.lang = data.lang;
    document.documentElement.dir = getDir(data.lang);
    // E2E hook: signals that hydration finished and the router is attached.
    (window as unknown as { __appReady?: boolean }).__appReady = true;

    // Initialise PostHog (no-op if key is missing).
    void initPostHog(posthogKey()).then(() => {
      setPersonProperties({ lang: data.lang });
    });
  });

  // Track client-side navigations as pageviews for SPA routing.
  afterNavigate(() => {
    const ph = getPostHog();
    if (ph) {
      ph.capture("$pageview");
    }
  });

  // Same-page anchor clicks (same origin/path/search, no hash) are true
  // no-ops: preventDefault at the click level. Cancelling inside
  // beforeNavigate is not an option — a cancelled link-click navigation falls
  // through to the browser's native navigation, causing a full page reload.
  function onClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest("a") : null;
    if (!target) return;
    const url = new URL(target.href, location.href);
    if (
      url.origin === location.origin &&
      url.pathname === location.pathname &&
      url.search === location.search &&
      !url.hash &&
      !location.hash
    ) {
      event.preventDefault();
    }
  }

  // Prevent images from opening in a new tab (right-click / long-press) or
  // being dragged (desktop + mobile). Scoped to <img> only so nav/UI menus stay intact.
  function onContextMenu(event: MouseEvent) {
    if (event.target instanceof HTMLImageElement) event.preventDefault();
  }
  function onDragStart(event: DragEvent) {
    if (event.target instanceof HTMLImageElement) event.preventDefault();
  }

  beforeNavigate(() => {
    // Entrance animations only play on the initial full page load; on
    // client-side navigations the view transition already handles the fade.
    document.documentElement.classList.add("has-nav");
  });

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    (window as any).__vtCalls = ((window as any).__vtCalls ?? 0) + 1;
    return new Promise((resolve, reject) => {
      try {
        const vt = document.startViewTransition(async () => {
          try {
            resolve();
            await navigation.complete;
          } catch (e) {
            (window as any).__vtNavCompleteRej = ((window as any).__vtNavCompleteRej ?? 0) + 1;
          }
        });
        vt.finished.catch(() => {
          (window as any).__vtFinishedRej = ((window as any).__vtFinishedRej ?? 0) + 1;
        });
      } catch (e) {
        (window as any).__vtSyncThrow = `${e}`;
        reject(e);
      }
    });
  });
</script>

<svelte:window onclickcapture={onClick} oncontextmenu={onContextMenu} ondragstart={onDragStart} />
<svelte:head>
  <link rel="icon" href="/images/logo.png" type="image/png" />
  <title>{t(data.lang, "brand.tagline")}</title>
</svelte:head>

<div class="{isAdminRoute ? 'min-h-screen' : 'flex min-h-screen flex-col overflow-x-clip'}">
  <TopProgressBar />
  {#if isAdminRoute}
    {@render children()}
  {:else}
    <a href="#main-content" class="skip-link">{data.lang === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}</a>
    <Header user={data.user} lang={data.lang} />
    <main id="main-content" tabindex="-1" class="storefront mx-auto w-full max-w-7xl flex-1 px-4">
      {@render children()}
    </main>
    <Footer lang={data.lang} />
  {/if}
  <CartDrawer lang={data.lang} />
  <ScrollToTop lang={data.lang} />
</div>
