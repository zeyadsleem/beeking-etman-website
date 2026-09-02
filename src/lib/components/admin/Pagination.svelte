<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let {
    page,
    total,
    pageSize,
    path = "/admin",
    additional = {},
    ariaLabel,
  }: {
    page: number;
    total: number;
    pageSize: number;
    path?: string;
    additional?: Record<string, string | number | undefined>;
    ariaLabel: string;
  } = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

  function href(p: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(additional)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  const pageNumbers = $derived.by(() => {
    const nums: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  });
</script>

{#if totalPages > 1}
  <nav class="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label={ariaLabel}>
    {#if page > 1}
      <a
        href={href(page - 1)}
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cocoa-100 bg-parchment text-cocoa-600 transition-colors hover:border-honey-300 hover:text-honey-700"
        aria-label="previous"
      >
        <ChevronLeft class="h-4 w-4 rtl:rotate-180" />
      </a>
    {/if}

    {#each pageNumbers as p}
      <a
        href={href(p)}
        aria-current={p === page ? "page" : undefined}
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors {p === page
          ? 'bg-ink-950 text-parchment'
          : 'border border-cocoa-100 bg-parchment text-cocoa-600 hover:border-honey-300 hover:text-honey-700'}"
      >
        {p}
      </a>
    {/each}

    {#if page < totalPages}
      <a
        href={href(page + 1)}
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cocoa-100 bg-parchment text-cocoa-600 transition-colors hover:border-honey-300 hover:text-honey-700"
        aria-label="next"
      >
        <ChevronRight class="h-4 w-4 rtl:rotate-180" />
      </a>
    {/if}
  </nav>
{/if}
