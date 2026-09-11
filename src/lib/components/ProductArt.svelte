<script lang="ts">
  let {
    department = "honey",
    categorySlug = "",
    class: className = "",
  }: {
    department?: string;
    categorySlug?: string;
    class?: string;
  } = $props();

  type ArtFamily =
    | "jar"
    | "comb"
    | "nuts"
    | "hiveproduct"
    | "hive"
    | "frame"
    | "extractor"
    | "protection"
    | "tool"
    | "package";

  function resolveFamily(department: string, slug: string): ArtFamily {
    if (department === "honey") {
      if (slug === "comb-honey") return "comb";
      if (slug === "mixed-nuts" || slug === "single-nuts") return "nuts";
      if (slug === "royal-jelly" || slug === "pollen" || slug === "propolis") return "hiveproduct";
      return "jar";
    }
    if (slug === "frames") return "frame";
    if (slug === "extractors" || slug === "ripeners" || slug === "other-extraction") return "extractor";
    if (slug === "veils" || slug === "suits" || slug === "gloves" || slug === "other-protection") return "protection";
    if (slug === "foundation-local" || slug === "foundation-export" || slug === "comb-honey") return "comb";
    if (
      slug === "smokers" ||
      slug === "bee-brushes" ||
      slug === "traps" ||
      slug === "grafting" ||
      slug === "sprays" ||
      slug === "other-tools" ||
      slug === "feeders" ||
      slug === "queen-excluders"
    )
      return "tool";
    if (
      slug === "jars" ||
      slug === "cartons" ||
      slug === "lids" ||
      slug === "shrink-wrap" ||
      slug === "nut-netting" ||
      slug === "fridge-containers" ||
      slug === "empty-comb-containers" ||
      slug === "honey-spoons" ||
      slug === "fermentation-bags" ||
      slug === "tape-roll" ||
      slug === "drum-30kg"
    )
      return "package";
    return "hive";
  }

  const family = $derived(resolveFamily(department, categorySlug));
</script>

<div
  class={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-honey-50 via-cream to-cream-deep ${className}`}
  aria-hidden="true"
>
  <div class="honeycomb pointer-events-none absolute inset-0"></div>
  <svg
    class="relative h-[52%] w-[52%] text-honey-700/90"
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {#if family === "jar"}
      <path d="M23 19h18v27a5 5 0 0 1-5 5H28a5 5 0 0 1-5-5V19Z" />
      <path d="M20 12h24v7H20z" />
      <path d="M28 30h8" />
    {:else if family === "comb"}
      <path d="M32 11l8.66 5v10L32 31l-8.66-5V16L32 11Z" />
      <path d="M23.34 31l8.66 5v10l-8.66 5-8.66-5V36l8.66-5Z" />
      <path d="M40.66 31l8.66 5v10l-8.66 5-8.66-5V36l8.66-5Z" />
    {:else if family === "nuts"}
      <ellipse cx="24" cy="25" rx="7" ry="9.5" transform="rotate(-22 24 25)" />
      <ellipse cx="41" cy="27" rx="7" ry="9.5" transform="rotate(18 41 27)" />
      <ellipse cx="32.5" cy="45" rx="7" ry="9.5" />
    {:else if family === "hiveproduct"}
      <path d="M32 9l17 9.8v19.6L32 48 15 38.4V18.8L32 9Z" />
      <path
        d="M32 21c0 0 6.5 7.2 6.5 11.2a6.5 6.5 0 1 1-13 0C25.5 28.2 32 21 32 21Z"
        class="fill-honey-200/70"
        stroke="none"
      />
    {:else if family === "hive"}
      <path d="M17 21h30v9H17z" />
      <path d="M17 32h30v9H17z" />
      <path d="M22 43v5h7v-5" />
      <path d="M15 17h34" />
    {:else if family === "frame"}
      <rect x="16" y="16" width="32" height="32" rx="2" />
      <path d="M24 17v30M32 17v30M40 17v30" />
    {:else if family === "extractor"}
      <path d="M20 25h24v16a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V25Z" />
      <path d="M18 21h28" />
      <path d="M44 31h5a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5" />
      <circle cx="32" cy="34" r="4" />
    {:else if family === "protection"}
      <path d="M32 13c6.6 0 12 5.4 12 12v7H20v-7c0-6.6 5.4-12 12-12Z" />
      <path d="M17 34h30l-3 7H20l-3-7Z" />
      <path d="M25 32v-6a7 7 0 0 1 14 0v6" />
    {:else if family === "tool"}
      <path d="M24 27h13v18a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V27Z" />
      <path d="M22 21h17l2 6H20l2-6Z" />
      <path d="M37 31h5a4 4 0 0 1 4 4v5" />
    {:else}
      <path d="M32 13l16 8v22l-16 8-16-8V21l16-8Z" />
      <path d="M16 21l16 8 16-8M32 29v22" />
    {/if}
  </svg>
</div>
