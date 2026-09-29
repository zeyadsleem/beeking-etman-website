<script lang="ts">
  let { alt, class: klass = "", onDark = false }: { alt: string; class?: string; onDark?: boolean } = $props();
</script>

<img
  src="/images/logo.png"
  {alt}
  draggable="false"
  class={`select-none object-contain brand-logo ${onDark ? "brand-logo-on-dark" : ""} ${klass}`}
/>

<style>
  /* The transparent raster stays the single source for header, footer and admin. */
  .brand-logo {
    filter: brightness(0) saturate(100%) invert(20%) sepia(17%) saturate(792%) hue-rotate(44deg) brightness(93%) contrast(89%);
  }
  .brand-logo-on-dark,
  :global(html:has(.storefront-shell):not([data-theme="light"])) .brand-logo {
    filter: brightness(0) saturate(100%) invert(78%) sepia(20%) saturate(598%) hue-rotate(357deg) brightness(95%) contrast(89%);
  }
</style>
