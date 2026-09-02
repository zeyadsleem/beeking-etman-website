<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import Logo from "$lib/components/Logo.svelte";
  import Sidebar from "./Sidebar.svelte";
  import Topbar from "./Topbar.svelte";
  import { t, type Lang } from "$lib/i18n/messages";

  let {
    children,
    lang,
    user,
  }: {
    children: import("svelte").Snippet;
    lang: Lang;
    user: { name?: string | null; email?: string | null } | null;
  } = $props();

  let mobileOpen = $state(false);
</script>

<div class="lg:flex">
  <div class="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:shrink-0">
    <Sidebar {lang} />
  </div>

  {#if mobileOpen}
    <div class="fixed inset-0 z-50 lg:hidden">
      <div
        class="absolute inset-0 bg-cocoa-950/40 backdrop-blur-sm"
        role="presentation"
        onclick={() => (mobileOpen = false)}
      ></div>
      <div class="absolute inset-y-0 start-0 flex max-w-[18rem] flex-col bg-ink-950 shadow-warm-lg">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-2.5">
            <Logo alt={t(lang, "admin.shell.adminArea")} class="h-6 w-6 shrink-0" />
            <span class="text-xs font-semibold uppercase tracking-wider text-parchment/50">
              {t(lang, "admin.shell.overview")}
            </span>
          </div>
          <button
            type="button"
            onclick={() => (mobileOpen = false)}
            aria-label={t(lang, "admin.shell.closeMenu")}
            class="flex h-9 w-9 items-center justify-center rounded-xl text-parchment/70 transition-colors hover:bg-parchment/10 hover:text-parchment"
          >
            <X class="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <Sidebar {lang} onNavigate={() => (mobileOpen = false)} />
        </div>
      </div>
    </div>
  {/if}

  <div class="min-w-0 flex-1">
    <Topbar {lang} {user} onMenu={() => (mobileOpen = true)} />
    <main class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {@render children()}
    </main>
  </div>
</div>
