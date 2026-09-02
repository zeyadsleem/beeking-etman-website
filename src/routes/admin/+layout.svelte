<script lang="ts">
  import AdminShell from "$lib/components/admin/AdminShell.svelte";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: import("svelte").Snippet; data: LayoutData } = $props();

  const lang = $derived(data.lang);
  const user = $derived(data.user);
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>

<AdminShell {lang} {user}>{@render children()}</AdminShell>
