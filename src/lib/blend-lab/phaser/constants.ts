import { ADDITIVE_KEYS, type AdditiveKey } from "$lib/blends";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;

export const SCENE_KEYS = {
  boot: "BootScene",
  lab: "LabScene",
} as const;

export const TEX = {
  goalPlaque: "goal-plaque",
  honeyJar: "honey-jar",
  cup: "ingredient-cup",
  bowl: "mixing-bowl",
  liquid: "liquid-fill",
  spoon: "spoon",
  pourJar: "pour-jar",
  glass: "glass",
  fillLevel: "fill-level",
  stream: "stream",
  drop: "drop",
  glow: "soft-glow",
} as const;

export const COLORS = {
  bg: 0x1c1410,
  woodDark: 0x4a3220,
  wood: 0x7a5230,
  parchment: 0xf5efe2,
  honey: 0xe8a020,
  glass: 0xdfe9ec,
} as const;

export const ADDITIVE_COLORS: Record<AdditiveKey, number> = {
  royalJelly: 0xf3e6c2,
  propolis: 0x6b3f10,
  ginseng: 0xc98f4e,
  palmPollen: 0xd8b24a,
  beePollen: 0xe3a72f,
};

export function hexColorToInt(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

export const LAYOUT = {
  goalRow: { startY: 220, spacingY: 112, x: 1080, plaqueW: 190, plaqueH: 96 },
  shelf: { boardY: 360, startX: 280, spacingX: 180 },
  bowl: { x: 640, y: 400, rx: 150, ry: 62 },
  cups: { y: 690, startX: 320, spacingX: 160, r: 46 },
  stir: { x: 640, y: 420, rx: 175, ry: 72 },
  pour: { jarX: 900, jarY: 420, glassX: 420, glassY: 590, glassW: 130, glassH: 190 },
} as const;

export const ADDITIVE_KEY_LIST: readonly AdditiveKey[] = ADDITIVE_KEYS;
