// Tiny Web Audio sound engine for the Blend Lab game.
//
// Synthesized with oscillator + gain envelopes (no audio assets), so it loads
// instantly. The context is created lazily on the first user gesture to comply
// with autoplay policies, and audio can be muted persistently via the toggle.

const MUTED_KEY = "honey_blend_muted";

class SoundFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted: boolean = false;

  constructor() {
    try {
      this._muted = localStorage.getItem(MUTED_KEY) === "1";
    } catch {
      this._muted = false;
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  toggleMuted(): boolean {
    this._muted = !this._muted;
    try {
      localStorage.setItem(MUTED_KEY, this._muted ? "1" : "0");
    } catch {
      // storage can be unavailable; the in-memory flag still applies
    }
    return this._muted;
  }

  private ensure(): AudioContext | null {
    if (this._muted) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private blip(
    freq: number,
    opts: {
      type?: OscillatorType;
      duration?: number;
      gain?: number;
      slideTo?: number;
      delay?: number;
    } = {},
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const { type = "triangle", duration = 0.09, gain = 0.2, slideTo, delay = 0 } = opts;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // A short "plink" whose pitch rises as the stir nears completion.
  stir(progress: number): void {
    const base = 340 + progress * 560;
    this.blip(base, { type: "triangle", duration: 0.06, gain: 0.16 });
    this.blip(base * 1.5, { type: "sine", duration: 0.05, gain: 0.07, delay: 0.02 });
  }

  // Upward chime when the blend is fully mixed.
  done(): void {
    this.blip(523.25, { type: "triangle", duration: 0.14, gain: 0.22 });
    this.blip(659.25, { type: "triangle", duration: 0.16, gain: 0.22, delay: 0.09 });
    this.blip(783.99, { type: "triangle", duration: 0.22, gain: 0.24, delay: 0.18 });
  }

  // A satisfying "pop" when an ingredient dose is added.
  pop(): void {
    this.blip(300, { type: "square", duration: 0.05, gain: 0.08, slideTo: 480 });
  }
}

export const sfx = new SoundFx();
