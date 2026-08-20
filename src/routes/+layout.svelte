<script lang="ts">
  import "@fontsource-variable/cairo";
  import "@fontsource-variable/manrope";
  import "@fontsource-variable/newsreader";
  import "@fontsource/amiri/arabic-400.css";
  import "@fontsource/amiri/arabic-700.css";
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
  });

  beforeNavigate((navigation) => {
    // Skip same-page clicks, but never popstate (back/forward): the browser
    // updates location.href before firing popstate, so the URL already equals
    // the target and cancelling would block every back/forward navigation.
    if (navigation.type !== "popstate" && navigation.to && navigation.to.url.href === location.href) {
      navigation.cancel();
      return;
    }
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

<svelte:head>
  <link rel="icon" href="/images/logo.png" type="image/png" />
  <title>{t(data.lang, "brand.tagline")}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
  <Header user={data.user} lang={data.lang} />
  <main class="mx-auto w-full max-w-7xl flex-1 px-4">
    {@render children()}
  </main>
  <Footer lang={data.lang} />
  <CartDrawer lang={data.lang} />
</div>