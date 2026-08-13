<script lang="ts">
  import { onMount } from "svelte";
  import { cartCount, openDrawer } from "$lib/cart-store.svelte";

  let {
    categories,
    user,
  }: {
    categories: { name: string; slug: string }[];
    user?: { name?: string | null } | null;
  } = $props();

  let query = $state("");
  let count = $state(0);

  onMount(() => {
    count = cartCount();
  });
  $effect(() => {
    count = cartCount();
  });

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLFormElement;
    const input = target.querySelector<HTMLInputElement>('input[name="q"]');
    const q = (input?.value ?? "").trim();
    window.location.assign(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }
</script>

<header class="sticky top-0 z-30 border-b border-stone-200 bg-cream/90 backdrop-blur">
  <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
    <a href="/" class="text-2xl font-extrabold text-honey-800">بيت العسل</a>

    <nav class="hidden items-center gap-5 text-sm font-medium text-stone-700 lg:flex">
      <a href="/" class="hover:text-honey-700">الرئيسية</a>
      <a href="/products" class="hover:text-honey-700">المتجر</a>
      {#each categories as cat}
        <a href={`/products?category=${cat.slug}`} class="hover:text-honey-700">{cat.name}</a>
      {/each}
    </nav>

    <form class="ms-auto flex flex-1 max-w-xs items-center gap-2" role="search" onsubmit={submitSearch}>
      <input
        type="search"
        name="q"
        bind:value={query}
        placeholder="ابحث عن عسل…"
        class="w-full rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-honey-500 focus:ring-honey-500"
      />
    </form>

    <div class="flex items-center gap-3">
      {#if user}
        <a href="/account/orders" class="hidden text-sm font-medium text-stone-700 hover:text-honey-700 sm:block">{user.name ?? "حسابي"}</a>
        <a href="/account/orders" class="rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:border-honey-500 sm:hidden">حسابي</a>
      {:else}
        <a href="/login" class="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium hover:border-honey-500 hover:text-honey-700">دخول</a>
      {/if}
      <button
        type="button"
        class="relative rounded-full bg-honey-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-honey-700"
        onclick={openDrawer}
        aria-label="فتح سلة التسوق"
      >
        السلة
        {#if count > 0}
          <span class="absolute -top-1.5 -end-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-stone-900 px-1 text-xs font-bold text-white" data-testid="cart-count">
            {count}
          </span>
        {/if}
      </button>
    </div>
  </div>
</header>