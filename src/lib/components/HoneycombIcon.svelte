<script lang="ts">
  let { size = 40, stroke = "currentColor", class: className = "" }: { size?: number; stroke?: string; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 26 30" fill="none" class={className} aria-hidden="true">
  <path d="M13 1l11 6.5v13L13 27 2 20.5v-13L13 1Z" fill="none" stroke={stroke} stroke-width="1.6" />
</svg>