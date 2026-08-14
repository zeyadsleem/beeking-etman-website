<script lang="ts">
  import { goto } from "$app/navigation";
  import { cartCount, openDrawer } from "$lib/cart-store.svelte";

  let {
    categories,
    user,
  }: {
    categories: { name: string; slug: string }[];
    user?: { name?: string | null } | null;
  } = $props();

  let count = $state(0);

  $effect(() => {
    count = cartCount();
  });

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLFormElement;
    const input = target.querySelector<HTMLInputElement>('input[name="q"]');
    const q = (input?.value ?? "").trim();
    void goto(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }
</script>

<header class="sticky top-0 z-30 border-b border-honey-200/70 bg-paper/90 backdrop-blur">
  <div class="honeycomb-bg absolute inset-x-0 top-0 h-1.5 opacity-70"></div>
  <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
    <a href="/" class="flex items-center gap-2 transition hover:opacity-90">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 1.5 30 9v14L16 30.5 2 23V9L16 1.5Z" fill="#1a1a13"/>
        <path d="M16 5.5 27.4 12v8L16 26.5 4.6 20v-8L16 5.5Z" fill="#e5a82e"/>
        <path d="M12 13h8M16 9.5v9" stroke="#1a1a13" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <span class="leading-tight">
        <span class="wordmark block text-2xl text-gold-600">مملكة النحل</span>
        <span class="block text-[0.7rem] font-semibold tracking-widest text-cocoa-500">عتمان الأصلي</span>
      </span>
    </a>

    <nav class="hidden items-center gap-6 text-sm font-semibold text-cocoa-700 lg:flex" aria-label="القائمة الرئيسية">
      <a href="/" class="transition-colors hover:text-honey-700">الرئيسية</a>
      <a href="/products" class="transition-colors hover:text-honey-700">المتجر</a>
      {#each categories as cat}
        <a href={`/products?category=${cat.slug}`} class="transition-colors hover:text-honey-700">{cat.name}</a>
      {/each}
    </nav>

    <form class="ms-auto hidden flex-1 max-w-xs items-center gap-2 sm:flex" role="search" onsubmit={submitSearch}>
      <div class="relative flex-1">
        <svg
          class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-cocoa-400"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          type="search"
          name="q"
          placeholder="ابحث عن عسل…"
          aria-label="بحث عن منتج"
          class="field rounded-full bg-white/70 ps-10"
        />
      </div>
    </form>

    <div class="ms-auto flex items-center gap-3 sm:ms-0">
      {#if user}
        <a href="/account/orders" class="hidden text-sm font-semibold text-cocoa-700 hover:text-honey-700 sm:block">{user.name ?? "حسابي"}</a>
        <a href="/account/orders" class="btn-outline sm:hidden">حسابي</a>
      {:else}
        <a href="/login" class="btn-outline">دخول</a>
      {/if}
      <button
        type="button"
        class="btn-honey relative"
        onclick={openDrawer}
        aria-label="فتح سلة التسوق"
      >
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
        السلة
        {#if count > 0}
          <span
            class="absolute -top-1.5 -end-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-cocoa-900 px-1.5 text-xs font-bold text-honey-200 shadow-warm-sm"
            data-testid="cart-count"
          >
            {count}
          </span>
        {/if}
      </button>
    </div>
  </div>
</header>