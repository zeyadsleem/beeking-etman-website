<script lang="ts">
  import "@fontsource-variable/cairo";
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import CartDrawer from "$lib/components/CartDrawer.svelte";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>بيت العسل</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
  <Header categories={data.categories} user={data.user} />
  <main class="mx-auto w-full max-w-7xl flex-1 px-4">
    {@render children()}
  </main>
  <Footer />
  <CartDrawer />
</div>