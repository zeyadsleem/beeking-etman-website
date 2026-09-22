<script lang="ts">
  let { alt, class: klass = "" }: { alt: string; class?: string } = $props();
</script>

<img
  src="/images/logo.png"
  {alt}
  draggable="false"
  class={`select-none object-contain brand-logo ${klass}`}
/>
