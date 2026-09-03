<script lang="ts">
  import { page } from "$app/state";
  import CircleUserRound from "@lucide/svelte/icons/circle-user-round";
  import ShoppingBag from "@lucide/svelte/icons/shopping-bag";
  import MapPin from "@lucide/svelte/icons/map-pin";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import { t, type Lang, type MessageKey } from "$lib/i18n/messages";

  let { lang, onNavigate }: { lang: Lang; onNavigate?: () => void } = $props();

  const NAV_ITEMS: readonly {
    href: string;
    match: string;
    labelKey: MessageKey;
    icon: import("svelte").Component;
  }[] = [
    { href: "/account", match: "/account", labelKey: "account.nav.profile", icon: CircleUserRound },
    { href: "/account/orders", match: "/account/orders", labelKey: "account.nav.orders", icon: ShoppingBag },
    { href: "/account/addresses", match: "/account/addresses", labelKey: "account.nav.addresses", icon: MapPin },
    { href: "/account/security", match: "/account/security", labelKey: "account.nav.security", icon: LockKeyhole },
  ];

  function isActive(item: (typeof NAV_ITEMS)[number]): boolean {
    const path = page.url.pathname;
    if (item.match === "/account") return path === "/account" || path === "/account/";
    return path === item.match || path.startsWith(item.match + "/");
  }
</script>

<aside class="w-full shrink-0 lg:w-60" aria-label={t(lang, "account.nav.aria")}>
  <div
    class="flex gap-1 overflow-x-auto rounded-2xl border border-cocoa-100 bg-parchment p-1.5 shadow-warm-sm lg:flex-col lg:gap-1.5 lg:bg-transparent lg:p-0 lg:shadow-none lg:border-0"
  >
    {#each NAV_ITEMS as item (item.href)}
      {@const active = isActive(item)}
      {@const Icon = item.icon}
      <a
        href={item.href}
        onclick={onNavigate}
        aria-current={active ? "page" : undefined}
        class="flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors {active
          ? 'bg-honey-100 text-honey-800'
          : 'text-cocoa-600 hover:bg-cocoa-50 hover:text-cocoa-900'}"
      >
        <Icon class="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        <span>{t(lang, item.labelKey)}</span>
      </a>
    {/each}
  </div>
</aside>
