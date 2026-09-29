<script lang="ts">
  import { t, type Lang } from "$lib/i18n/messages";
  import SearchSuggestions from "./SearchSuggestions.svelte";

  let { lang, initial = "", class: className = "", onSearch, onSelect }: {
    lang: Lang;
    initial?: string;
    class?: string;
    onSearch: (query: string) => void;
    onSelect: (value: string) => void;
  } = $props();
</script>

<SearchSuggestions
  {lang}
  {initial}
  class={`w-full ${className}`}
  placeholder={t(lang, "search.placeholder")}
  ariaLabel={t(lang, "search.aria")}
  inputClass="bg-parchment h-11 w-full"
  {onSearch}
  {onSelect}
/>
