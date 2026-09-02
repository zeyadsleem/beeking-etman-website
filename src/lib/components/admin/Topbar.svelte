<script lang="ts">
  import { page } from "$app/state";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Menu from "@lucide/svelte/icons/menu";
  import Logo from "$lib/components/Logo.svelte";
  import Button from "$lib/components/Button.svelte";
  import { t, type Lang, type MessageKey } from "$lib/i18n/messages";

  let {
    lang,
    user,
    onMenu,
  }: {
    lang: Lang;
    user: { name?: string | null; email?: string | null } | null;
    onMenu?: () => void;
  } = $props();

  const CRUMBS: Record<string, MessageKey> = {
    "/admin": "admin.nav.dashboard",
    "/admin/orders": "admin.nav.orders",
    "/admin/products": "admin.nav.products",
    "/admin/customers": "admin.nav.customers",
    "/admin/users": "admin.nav.users",
    "/admin/inventory/warehouses": "admin.nav.warehouses",
    "/admin/inventory/transfers": "admin.nav.transfers",
    "/admin/inventory/alerts": "admin.nav.alerts",
    "/admin/inventory/reports": "admin.nav.inventoryReports",
  };

  const crumb = $derived.by(() => {
    const path = page.url.pathname;
    const match = CRUMBS[path];
    if (match) return t(lang, match);
    const base = "/" + path.split("/").slice(0, 3).join("/");
    const baseKey = CRUMBS[base];
    return baseKey ? t(lang, baseKey) : t(lang, "admin.nav.dashboard");
  });

  const initial = $derived((user?.name ?? user?.email ?? "A").charAt(0).toUpperCase() ?? "A");
</script>

<header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-cocoa-100 bg-parchment/90 px-4 backdrop-blur-md sm:px-6">
  <button
    type="button"
    onclick={onMenu}
    aria-label={t(lang, "admin.shell.menu")}
    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cocoa-600 transition-colors hover:bg-cocoa-100 lg:hidden"
  >
    <Menu class="h-5 w-5" strokeWidth={2} />
  </button>

  <div class="flex min-w-0 items-center gap-2 text-sm">
    <Logo alt={t(lang, "admin.shell.adminArea")} class="h-5 w-5 shrink-0" />
    <span class="truncate font-semibold text-cocoa-800">{crumb}</span>
  </div>

  <div class="ms-auto flex items-center gap-3">
    {#if user}
      <div class="hidden items-center gap-2.5 sm:flex">
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-honey-100 text-sm font-bold text-honey-800">
          {initial}
        </span>
        <div class="leading-tight">
          <p class="max-w-[12rem] truncate text-sm font-medium text-cocoa-800">
            {user.name ?? user.email}
          </p>
          {#if user.name && user.email}
            <p class="max-w-[12rem] truncate text-xs text-cocoa-400">{user.email}</p>
          {/if}
        </div>
      </div>
      <form method="POST" action="/admin/logout">
        <Button variant="ghost" type="submit">
          <LogOut class="h-4 w-4" strokeWidth={2} />
          <span class="hidden sm:inline">{t(lang, "admin.shell.signOut")}</span>
        </Button>
      </form>
    {/if}
  </div>
</header>
