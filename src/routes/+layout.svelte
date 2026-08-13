<script lang="ts">
  import "@fontsource-variable/cairo";
  import "@fontsource/amiri/arabic-400.css";
  import "@fontsource/amiri/arabic-700.css";
  import "@fontsource/aref-ruqaa/arabic-400.css";
  import "@fontsource/aref-ruqaa/arabic-700.css";
  import { onNavigate } from "$app/navigation";
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import CartDrawer from "$lib/components/CartDrawer.svelte";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>مملكة النحل | عتمان الأصلي</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
  <Header categories={data.categories} user={data.user} />
  <main class="mx-auto w-full max-w-7xl flex-1 px-4">
    {@render children()}
  </main>
  <Footer />
  <CartDrawer />
</div>