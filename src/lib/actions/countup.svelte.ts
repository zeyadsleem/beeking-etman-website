export function countUp(node: HTMLElement, target: number) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    node.textContent = String(target);
    return;
  }
  const duration = 1200;
  let raf = 0;
  let started = false;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        node.textContent = String(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
        else node.textContent = String(target);
      };
      raf = requestAnimationFrame(tick);
      io.disconnect();
    },
    { threshold: 0.4 },
  );
  io.observe(node);
  return { destroy: () => cancelAnimationFrame(raf) };
}
