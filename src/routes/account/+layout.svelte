<script lang="ts">
  import AccountSidebar from "$lib/components/account/AccountSidebar.svelte";
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>

<div class="mx-auto w-full max-w-5xl px-4 py-6">
  <div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
    <div class="lg:pt-2 lg:w-60">
      <AccountSidebar lang={data.lang} />
    </div>
    <div class="min-w-0 flex-1">
      {@render children()}
    </div>
  </div>
</div>
