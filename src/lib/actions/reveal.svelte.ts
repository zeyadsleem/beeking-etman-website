export function reveal(node: HTMLElement, opts: { delay?: number } = {}) {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  node.classList.add("reveal-hidden");
  if (opts.delay) node.style.transitionDelay = `${opts.delay}ms`;
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        node.classList.add("reveal-visible");
        io.disconnect();
      }
    },
    { threshold: 0.12 },
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}
