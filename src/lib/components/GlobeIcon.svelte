<script lang="ts">
  let { size = 17 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
  <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
</svg>