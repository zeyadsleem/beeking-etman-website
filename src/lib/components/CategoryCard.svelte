<script lang="ts">
  let { name, slug }: { name: string; slug: string } = $props();
</script>

<a
  href={`/products?category=${slug}`}
  class="group relative flex h-32 items-end overflow-hidden rounded-2xl bg-gradient-to-br from-honey-200 to-honey-500 p-5 text-white shadow-sm transition hover:shadow-lg"
>
  <span class="text-lg font-bold drop-shadow-sm group-hover:underline">{name}</span>
</a>
