<script lang="ts">
  let { size = 17 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" />
  <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
</svg>