export interface WeightedColor {
  hex: string;
  weight: number;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function hexToRgb(hex: string): [number, number, number] {
  if (!HEX_RE.test(hex)) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(rgb: [number, number, number]): string {
  const part = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

export function mixIngredients(
  baseHex: string,
  additives: WeightedColor[],
  progress: number,
): string {
  const p = clamp01(progress);
  const base = hexToRgb(baseHex);
  const valid = additives.filter((a) => a.weight > 0);
  if (valid.length === 0 || p === 0) return rgbToHex(base);
  const totalWeight = valid.reduce((s, a) => s + a.weight, 0);
  const avg: [number, number, number] = [0, 0, 0];
  for (const a of valid) {
    const c = hexToRgb(a.hex);
    const w = a.weight / totalWeight;
    avg[0] += c[0] * w;
    avg[1] += c[1] * w;
    avg[2] += c[2] * w;
  }
  const mixed: [number, number, number] = [
    base[0] + (avg[0] - base[0]) * p,
    base[1] + (avg[1] - base[1]) * p,
    base[2] + (avg[2] - base[2]) * p,
  ];
  return rgbToHex(mixed);
}
