<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { onMount } from "svelte";
  import Logo from "$lib/components/Logo.svelte";
  import Sidebar from "./Sidebar.svelte";
  import Topbar from "./Topbar.svelte";
  import { getDir, t, type Lang } from "$lib/i18n/messages";

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
  let main: HTMLElement;

  onMount(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (): void => {
      if (desktop.matches) mobileOpen = false;
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  });
</script>

<Dialog.Root bind:open={mobileOpen}>
<div class="lg:flex">
  <div class="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:shrink-0">
    <Sidebar {lang} />
  </div>

  <Dialog.Portal>
      <Dialog.Overlay class="fixed inset-0 z-40 bg-cocoa-950/40" />
      <Dialog.Content
        dir={getDir(lang)}
        aria-describedby={undefined}
        class="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col bg-ink-950 shadow-warm-lg"
        onCloseAutoFocus={(event) => {
          if (window.matchMedia("(min-width: 1024px)").matches) {
            event.preventDefault();
            main?.focus({ preventScroll: true });
          }
        }}
      >
        <Dialog.Title class="sr-only">{t(lang, "admin.shell.menu")}</Dialog.Title>
        <div class="flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-2.5">
            <Logo alt={t(lang, "admin.shell.adminArea")} onDark class="h-6 w-6 shrink-0" />
            <span class="text-xs font-semibold uppercase tracking-wider text-parchment/50">
              {t(lang, "admin.shell.overview")}
            </span>
          </div>
          <Dialog.Close
            aria-label={t(lang, "admin.shell.closeMenu")}
            class="flex h-11 w-11 items-center justify-center rounded-xl text-parchment transition-colors hover:bg-parchment/10"
          >
            <X class="h-5 w-5" strokeWidth={2} />
          </Dialog.Close>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <Sidebar {lang} onNavigate={() => (mobileOpen = false)} />
        </div>
      </Dialog.Content>
  </Dialog.Portal>

  <div class="min-w-0 flex-1">
    <Topbar {lang} {user} onMenu={() => (mobileOpen = true)} />
    <main bind:this={main} tabindex="-1" class="admin-content mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {@render children()}
    </main>
  </div>
</div>
</Dialog.Root>
