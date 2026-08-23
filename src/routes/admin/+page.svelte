<script lang="ts">
  let { data }: { data: { user: { name?: string | null } | null } } = $props();
</script>

<svelte:head><title>الأدمن</title></svelte:head>

<section class="mx-auto max-w-6xl px-4 py-10">
  <h1 class="text-2xl font-bold text-cocoa-900">لوحة الأدمن</h1>
  <p class="mt-2 text-sm text-cocoa-700">مرحباً {data.user?.name}</p>
</section>
