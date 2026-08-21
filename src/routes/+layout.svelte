<script lang="ts">
  import { beforeNavigate, onNavigate } from "$app/navigation";
  import { getDir, t } from "$lib/i18n/messages";
  import "./layout.css";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import CartDrawer from "$lib/components/CartDrawer.svelte";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();

  $effect(() => {
    document.documentElement.lang = data.lang;
    document.documentElement.dir = getDir(data.lang);
    // E2E hook: signals that hydration finished and the router is attached.
    (window as unknown as { __appReady?: boolean }).__appReady = true;
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

<svelte:window onclickcapture={onClick} />
<svelte:head>
  <link rel="icon" href="/images/logo.png" type="image/png" />
  <title>{t(data.lang, "brand.tagline")}</title>
</svelte:head>

<div class="flex min-h-screen flex-col overflow-x-clip">
  <Header user={data.user} lang={data.lang} />
  <main class="mx-auto w-full max-w-7xl flex-1 px-4">
    {@render children()}
  </main>
  <Footer lang={data.lang} />
  <CartDrawer lang={data.lang} />
</div>