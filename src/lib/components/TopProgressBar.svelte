<script lang="ts">
  import { afterNavigate, beforeNavigate } from "$app/navigation";

  let visible = $state(false);
  let progress = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  beforeNavigate(() => {
    visible = true;
    progress = 0;
    clearInterval(timer);
    // Simulate incremental progress
    timer = setInterval(() => {
      if (progress < 0.9) {
        progress += 0.05 + Math.random() * 0.08;
      }
    }, 120);
  });

  afterNavigate(() => {
    clearInterval(timer);
    progress = 1;
    setTimeout(() => {
      visible = false;
      progress = 0;
    }, 250);
  });
</script>

{#if visible}
  <div
    class="fixed top-0 left-0 z-[9999] h-[3px] w-full overflow-hidden bg-transparent"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(progress * 100)}
  >
    <div
      class="h-full rounded-full bg-honey-500 transition-all duration-200 ease-out"
      style:width="{Math.min(progress * 100, 99)}%"
    ></div>
  </div>
{/if}
