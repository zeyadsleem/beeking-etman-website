<script lang="ts">
  import { Combobox } from "bits-ui";
  import { formatEGP } from "$lib/currency";
  import { getDir, t, type Lang } from "$lib/i18n/messages";
  import Button from "./Button.svelte";

  interface SuggestionItem {
    value: string;
    label: string;
    kind: "product" | "category";
    image?: string;
    minPrice?: number;
  }

  let {
    lang = "ar",
    placeholder = "ابحث…",
    ariaLabel = "بحث",
    initial = "",
    submitLabel = "",
    inputClass = "",
    class: wrapperClass = "",
    onSearch,
    onSelect,
  }: {
    lang?: Lang;
    placeholder?: string;
    ariaLabel?: string;
    initial?: string;
    submitLabel?: string;
    inputClass?: string;
    class?: string;
    onSearch: (query: string) => void;
    onSelect: (value: string) => void;
  } = $props();

  let query = $state("");
  let open = $state(false);
  let loading = $state(false);
  let highlighted = $state<string | null>(null);
  let items: SuggestionItem[] = $state([]);
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  $effect.pre(() => {
    query = initial;
  });

  function onInput(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).value;
    query = value;
    clearTimeout(debounce);
    controller?.abort();
    highlighted = null;
    const q = value.trim();
    if (q.length < 2) {
      items = [];
      loading = false;
      open = false;
      return;
    }
    open = true;
    loading = true;
    debounce = setTimeout(() => void fetchSuggestions(q), 200);
  }

  async function fetchSuggestions(q: string) {
    controller = new AbortController();
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("search suggestions failed");
      const data = await res.json();
      if (query.trim() !== q) return;
      items = [
        ...data.products.map(
          (p: { name: string; slug: string; image: string; minPrice: number }) => ({
            value: `/products/${p.slug}`,
            label: p.name,
            kind: "product",
            image: p.image,
            minPrice: p.minPrice,
          }),
        ),
        ...data.categories.map((c: { name: string; slug: string }) => ({
          value: `/products?category=${c.slug}`,
          label: c.name,
          kind: "category",
        })),
      ];
    } catch (err) {
      if ((err as Error).name !== "AbortError") items = [];
    } finally {
      loading = false;
    }
  }

  function onValueChange(value: string) {
    query = "";
    items = [];
    open = false;
    onSelect(value);
  }

  function onClear() {
    query = "";
    items = [];
    highlighted = null;
    open = false;
  }

  function submit() {
    const q = query.trim();
    items = [];
    open = false;
    onSearch(q);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" || event.isComposing) return;
    // If an item is highlighted, bits-ui selects it (navigating via onValueChange).
    // Otherwise the listbox is idle — submit the typed query instead.
    const willSelect = highlighted !== null;
    setTimeout(() => {
      if (!willSelect) submit();
    }, 0);
  }
</script>

<div class={wrapperClass} role="search">
  <div class="relative flex-1">
    <svg
      class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-cocoa-400"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <Combobox.Root
      type="single"
      inputValue={query}
      open={open}
      onOpenChange={(v) => (open = v)}
      onValueChange={onValueChange}
    >
      <Combobox.Input
        class={`field rounded-full ps-10 ${inputClass}`}
        placeholder={placeholder}
        aria-label={ariaLabel}
        oninput={onInput}
        onkeydown={onKeydown}
      />
      <Combobox.Portal>
        <Combobox.Content
          dir={getDir(lang)}
          class="z-50 max-h-80 w-[var(--bits-combobox-anchor-width)] min-w-[var(--bits-combobox-anchor-width)] overflow-y-auto rounded-2xl border border-cocoa-200 bg-parchment p-1.5 shadow-warm-lg"
          sideOffset={8}
          align="start"
        >
          <Combobox.Viewport>
            {#if loading}
              <p class="px-4 py-3 text-sm text-cocoa-500">{t(lang, "search.searching")}</p>
            {:else if items.length === 0}
              <p class="px-4 py-3 text-sm text-cocoa-500">{t(lang, "search.noMatches")}</p>
            {:else}
              {#each items as item, i (item.value)}
                <Combobox.Item
                  value={item.value}
                  label={item.label}
                  class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none data-highlighted:bg-honey-50"
                  onHighlight={() => (highlighted = item.value)}
                  onUnhighlight={() => (highlighted = null)}
                >
                  {#snippet children({ highlighted })}
                    {#if item.kind === "product" && item.image}
                      <img
                        src={item.image}
                        alt=""
                        class="h-9 w-9 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    {:else}
                      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cocoa-100 text-cocoa-500" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                        </svg>
                      </span>
                    {/if}
                    <span class="min-w-0 flex-1">
                      <span class={`block truncate text-sm font-semibold text-cocoa-800 ${highlighted ? "text-honey-800" : ""}`}>
                        {item.label}
                      </span>
                      <span class="block text-xs text-cocoa-400">
                        {item.kind === "product" && item.minPrice
                          ? `${t(lang, "search.from")} ${formatEGP(item.minPrice)}`
                          : t(lang, "search.browseCategory")}
                      </span>
                    </span>
                  {/snippet}
                </Combobox.Item>
              {/each}
            {/if}
          </Combobox.Viewport>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox.Root>
    {#if query}
      <button
        type="button"
        class="absolute end-3 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-cocoa-400 transition hover:bg-cocoa-100 hover:text-cocoa-700"
        onclick={onClear}
        aria-label={t(lang, "search.clear")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    {/if}
  </div>
  {#if submitLabel}
    <Button variant="primary" type="button" onclick={submit} class="shrink-0 px-5 py-2.5 text-sm">
      {submitLabel}
    </Button>
  {/if}
</div>
