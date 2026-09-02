<script lang="ts">
  let {
    label,
    value,
    hint,
    icon,
    tone = "honey",
    valueTestId,
  }: {
    label: string;
    value: string;
    hint?: string;
    icon: import("svelte").Component;
    tone?: "honey" | "clay" | "olive" | "cocoa";
    valueTestId?: string;
  } = $props();

  const toneClasses = $derived(
    {
      honey: "bg-honey-50 text-honey-700",
      clay: "bg-clay-50 text-clay-700",
      olive: "bg-olive-50 text-olive-700",
      cocoa: "bg-cocoa-100 text-cocoa-700",
    }[tone],
  );

  const Icon = $derived(icon);
</script>

<div
  class="group relative overflow-hidden rounded-2xl border border-cocoa-100 bg-parchment p-5 shadow-warm-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-warm"
>
  <div class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <p class="truncate text-xs font-semibold tracking-wide text-cocoa-400">{label}</p>
      <p class="mt-1.5 truncate text-2xl font-extrabold text-cocoa-900" data-testid={valueTestId}>{value}</p>
      {#if hint}
        <p class="mt-1.5 truncate text-xs font-medium text-cocoa-500">{hint}</p>
      {/if}
    </div>
    <span class={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}>
      <Icon class="h-5 w-5" strokeWidth={2} />
    </span>
  </div>
</div>
