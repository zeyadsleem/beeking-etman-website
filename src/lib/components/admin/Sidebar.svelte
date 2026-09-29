<script lang="ts">
  import { page } from "$app/state";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import ShoppingCart from "@lucide/svelte/icons/shopping-cart";
  import Package from "@lucide/svelte/icons/package";
  import Users from "@lucide/svelte/icons/users";
  import UserCog from "@lucide/svelte/icons/user-cog";
  import Warehouse from "@lucide/svelte/icons/warehouse";
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Store from "@lucide/svelte/icons/store";
  import Logo from "$lib/components/Logo.svelte";
  import { t, type Lang, type MessageKey } from "$lib/i18n/messages";

  let { lang, onNavigate }: { lang: Lang; onNavigate?: () => void } = $props();

  const NAV_ITEMS: readonly {
    href: string;
    match: string;
    labelKey: MessageKey;
    icon: import("svelte").Component;
  }[] = [
    { href: "/admin", match: "/admin", labelKey: "admin.nav.dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", match: "/admin/orders", labelKey: "admin.nav.orders", icon: ShoppingCart },
    { href: "/admin/products", match: "/admin/products", labelKey: "admin.nav.products", icon: Package },
    { href: "/admin/customers", match: "/admin/customers", labelKey: "admin.nav.customers", icon: Users },
    { href: "/admin/users", match: "/admin/users", labelKey: "admin.nav.users", icon: UserCog },
    { href: "/admin/inventory/warehouses", match: "/admin/inventory/warehouses", labelKey: "admin.nav.warehouses", icon: Warehouse },
    { href: "/admin/inventory/transfers", match: "/admin/inventory/transfers", labelKey: "admin.nav.transfers", icon: ArrowLeftRight },
    { href: "/admin/inventory/alerts", match: "/admin/inventory/alerts", labelKey: "admin.nav.alerts", icon: AlertTriangle },
    { href: "/admin/inventory/reports", match: "/admin/inventory/reports", labelKey: "admin.nav.inventoryReports", icon: ChartColumn },
  ];

  function isActive(item: (typeof NAV_ITEMS)[number]): boolean {
    const path = page.url.pathname;
    if (item.match === "/admin") return path === "/admin" || path === "/admin/";
    return path === item.match || path.startsWith(item.match + "/");
  }
</script>

<aside class="flex h-full w-64 shrink-0 flex-col bg-ink-950 text-parchment" aria-label={t(lang, "admin.nav.aria")}>
  <a
    href="/admin"
    onclick={onNavigate}
    class="flex items-center gap-2.5 px-5 py-5 hover:bg-parchment/5"
  >
    <Logo alt={t(lang, "admin.shell.adminArea")} onDark class="h-8 w-8 shrink-0" />
    <div class="leading-tight">
      <p class="text-sm font-bold tracking-wide text-honey-300">{t(lang, "admin.shell.adminArea")}</p>
      <p class="text-[11px] text-parchment/50">{t(lang, "admin.shell.overview")}</p>
    </div>
  </a>

  <nav class="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
    {#each NAV_ITEMS as item (item.href)}
      {@const active = isActive(item)}
      {@const Icon = item.icon}
      <a
        href={item.href}
        onclick={onNavigate}
        aria-current={active ? "page" : undefined}
        class:active={active}
        class="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors {active ? 'bg-honey-500/15 text-honey-300' : 'text-parchment/70 hover:bg-parchment/5 hover:text-parchment'}"
      >
        {#if active}
          <span class="absolute start-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-e-full bg-honey-400" aria-hidden="true"></span>
        {/if}
        <Icon class="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        <span>{t(lang, item.labelKey)}</span>
      </a>
    {/each}
  </nav>

  <div class="border-t border-parchment/10 p-3">
    <a
      href="/"
      onclick={onNavigate}
      class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-parchment/70 transition-colors hover:bg-parchment/5 hover:text-parchment"
    >
      <Store class="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      <span>{t(lang, "admin.shell.viewStore")}</span>
    </a>
  </div>
</aside>
