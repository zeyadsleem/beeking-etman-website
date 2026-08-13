<script lang="ts">
  let { name, slug }: { name: string; slug: string } = $props();
</script>

<a
  href={`/products?category=${slug}`}
  class="group relative flex h-36 items-end overflow-hidden rounded-[1.4rem] border border-honey-200 bg-gradient-to-br from-honey-200 via-honey-400 to-honey-600 p-5 text-white shadow-warm-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-warm-lg"
>
  <div class="honeycomb-bg absolute inset-0 opacity-50"></div>
  <div class="dot-bg absolute inset-0 opacity-40"></div>
  <div class="absolute -end-4 -top-4 h-16 w-16 rounded-full bg-white/15"></div>
  <div
    class="absolute -start-6 bottom-2 h-14 w-14 rotate-12 rounded-2xl border border-white/20 opacity-0 transition duration-500 group-hover:rotate-0 group-hover:opacity-100"
  ></div>
  <span class="relative flex w-full items-end justify-between">
    <span class="headline text-xl drop-shadow-sm">{name}</span>
    <span
      class="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-honey-100 transition duration-300 group-hover:bg-white/30 group-hover:text-white"
      aria-hidden="true"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </span>
</a>