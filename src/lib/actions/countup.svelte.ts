interface CountUpOpts {
  target: number;
  lang?: string;
}

type CountUpInput = CountUpOpts | number;

function normalize(input: CountUpInput): CountUpOpts {
  return typeof input === "number" ? { target: input, lang: undefined } : input;
}

function formatter(lang?: string): (n: number) => string {
  return lang === "ar" ? (n) => new Intl.NumberFormat("ar-EG").format(n) : (n) => String(n);
}

export function countUp(node: HTMLElement, input: CountUpInput) {
  let opts = normalize(input);
  let fmt = formatter(opts.lang);
  let raf = 0;
  let started = false;
  let current = 0;
  const duration = 1200;

  const render = (value: number) => {
    current = value;
    node.textContent = fmt(value);
  };

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    render(opts.target);
  } else {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          render(Math.round(opts.target * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
          else render(opts.target);
        };
        raf = requestAnimationFrame(tick);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(node);
  }

  return {
    update(next: CountUpInput) {
      opts = normalize(next);
      fmt = formatter(opts.lang);
      render(current);
    },
    destroy: () => cancelAnimationFrame(raf),
  };
}
