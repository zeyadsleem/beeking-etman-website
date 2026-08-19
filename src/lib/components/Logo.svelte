<script lang="ts">
  let { alt, class: klass = "" }: { alt: string; class?: string } = $props();
</script>

<div
  role="img"
  aria-label={alt}
  class={klass}
  style="background: linear-gradient(135deg, var(--color-honey-500), var(--color-honey-700)); -webkit-mask-image: url('/images/logo.png'); mask-image: url('/images/logo.png'); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-position: center; mask-position: center; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;"
></div>
