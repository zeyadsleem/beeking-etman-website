<script lang="ts">
  import { tick } from "svelte";
  import { t, type Lang } from "$lib/i18n/messages";
  import SearchSuggestions from "./SearchSuggestions.svelte";

  let {
    lang,
    initial = "",
    class: className = "",
    onSearch,
    onSelect,
  }: {
    lang: Lang;
    initial?: string;
    class?: string;
    onSearch: (query: string) => void;
    onSelect: (value: string) => void;
  } = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let toggle: HTMLButtonElement | undefined = $state();

  async function openSearch() {
    open = true;
    await tick();
    root?.querySelector("input")?.focus();
  }

  function close() {
    open = false;
  }

  function onFocusOut(event: FocusEvent) {
    if (!open) return;
    const next = event.relatedTarget;
    if (next instanceof Node && root?.contains(next)) return;
    close();
  }

  function onKeydown(event: KeyboardEvent) {
    if (!open || event.key !== "Escape") return;
    close();
    toggle?.focus();
  }

  function handleSearch(query: string) {
    close();
    onSearch(query);
  }

  function handleSelect(value: string) {
    close();
    onSelect(value);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div
  bind:this={root}
  class={`relative flex items-center ${className}`}
  onfocusout={onFocusOut}
>
  <button
    bind:this={toggle}
    type="button"
    onclick={() => (open ? close() : void openSearch())}
    class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cocoa-200 bg-paper text-cocoa-700 transition-colors hover:border-honey-700 hover:text-honey-700"
    aria-label={t(lang, "search.aria")}
    aria-expanded={open}
  >
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>
  <div
    class={`absolute end-full top-1/2 z-40 -translate-y-1/2 overflow-hidden pe-2 transition-[width,opacity] duration-200 ease-out ${
      open ? "w-56 opacity-100 lg:w-64" : "w-0 opacity-0"
    }`}
    inert={!open}
  >
    <SearchSuggestions
      lang={lang}
      initial={initial}
      placeholder={t(lang, "search.placeholder")}
      ariaLabel={t(lang, "search.aria")}
      inputClass="bg-parchment"
      onSearch={handleSearch}
      onSelect={handleSelect}
    />
  </div>
</div>
