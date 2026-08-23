<script lang="ts">
  let { data }: { data: { user: { name?: string | null } | null } } = $props();

  // Section hub for the admin area; الإحصائيات lives here itself once the
  // placeholder is replaced by the stats dashboard.
  const SECTIONS: readonly { href: string; label: string }[] = [
    { href: "/admin/orders", label: "الطلبات" },
    { href: "/admin/products", label: "المنتجات" },
    { href: "/admin/categories", label: "الأصناف" },
    { href: "/admin", label: "الإحصائيات" },
  ];
</script>

<svelte:head><title>الأدمن</title></svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <h1 class="text-2xl font-bold text-cocoa-900">لوحة الأدمن</h1>
  <p class="mt-2 text-sm text-cocoa-700">مرحباً {data.user?.name}</p>

  <nav class="mt-6 flex flex-wrap gap-2" aria-label="أقسام الأدمن">
    {#each SECTIONS as section (section.href)}
      <a href={section.href} class="chip">{section.label}</a>
    {/each}
  </nav>
</section>
