import type Phaser from "phaser";
import { COLORS, TEX } from "./constants";

export function generateCoreTextures(scene: Phaser.Scene): void {
  makeGoalPlaque(scene);
  makeHoneyJar(scene);
  makeCup(scene);
  makeBowl(scene);
  makeLiquid(scene);
  makeSpoon(scene);
  makePourJar(scene);
  makeGlass(scene);
  makeFillLevel(scene);
  makeStream(scene);
  makeDrop(scene);
  makeGlow(scene);
}

function makeGoalPlaque(scene: Phaser.Scene): void {
  const w = 190;
  const h = 96;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.parchment, 1);
  g.fillRoundedRect(0, 0, w, h, 14);
  g.lineStyle(4, COLORS.wood, 1);
  g.strokeRoundedRect(2, 2, w - 4, h - 4, 14);
  g.fillStyle(COLORS.honey, 1);
  g.fillCircle(34, h / 2, 20);
  g.generateTexture(TEX.goalPlaque, w, h);
  g.destroy();
}

function makeHoneyJar(scene: Phaser.Scene): void {
  const w = 110;
  const h = 150;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.glass, 1);
  g.fillRoundedRect(15, 30, w - 30, h - 40, 12);
  g.fillStyle(COLORS.woodDark, 1);
  g.fillRoundedRect(20, 6, w - 40, 26, 8);
  g.fillStyle(COLORS.parchment, 0.85);
  g.fillRoundedRect(24, 66, w - 48, 44, 6);
  g.generateTexture(TEX.honeyJar, w, h);
  g.destroy();
}

function makeCup(scene: Phaser.Scene): void {
  const d = 92;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(d / 2, d / 2, d / 2 - 6);
  g.lineStyle(6, 0xb9a58a, 1);
  g.strokeCircle(d / 2, d / 2, d / 2 - 6);
  g.generateTexture(TEX.cup, d, d);
  g.destroy();
}

function makeBowl(scene: Phaser.Scene): void {
  const w = 340;
  const h = 150;
  const cx = w / 2;
  const cy = h / 2;
  const g = scene.add.graphics();
  g.lineStyle(30, COLORS.woodDark, 1);
  g.strokeEllipse(cx, cy, w - 36, h - 36);
  g.lineStyle(8, COLORS.wood, 1);
  g.strokeEllipse(cx, cy, w - 4, h - 4);
  g.generateTexture(TEX.bowl, w, h);
  g.destroy();
}

function makeLiquid(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.honey, 1);
  g.fillEllipse(80, 45, 148, 56);
  g.generateTexture(TEX.liquid, 160, 90);
  g.destroy();
}

function makeSpoon(scene: Phaser.Scene): void {
  const w = 34;
  const h = 150;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.wood, 1);
  g.fillRoundedRect(w / 2 - 5, 34, 10, h - 44, 5);
  g.fillCircle(w / 2, 22, 18);
  g.generateTexture(TEX.spoon, w, h);
  g.destroy();
}

function makePourJar(scene: Phaser.Scene): void {
  const w = 150;
  const h = 190;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.glass, 1);
  g.fillRoundedRect(20, 36, w - 40, h - 50, 14);
  g.fillStyle(COLORS.woodDark, 1);
  g.fillRoundedRect(28, 8, w - 56, 30, 10);
  g.fillStyle(COLORS.honey, 0.9);
  g.fillRoundedRect(34, 88, w - 68, 52, 8);
  g.generateTexture(TEX.pourJar, w, h);
  g.destroy();
}

function makeGlass(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.lineStyle(6, 0xffffff, 0.75);
  g.strokeRoundedRect(3, 3, 124, 184, 10);
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(3, 3, 124, 184, 10);
  g.generateTexture(TEX.glass, 130, 190);
  g.destroy();
}

function makeFillLevel(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.honey, 1);
  g.fillRect(0, 0, 118, 10);
  g.generateTexture(TEX.fillLevel, 118, 10);
  g.destroy();
}

function makeStream(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.honey, 0.95);
  g.fillRoundedRect(0, 0, 8, 200, 4);
  g.generateTexture(TEX.stream, 8, 200);
  g.destroy();
}

function makeDrop(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.honey, 1);
  g.fillEllipse(6, 10, 10, 16);
  g.generateTexture(TEX.drop, 12, 20);
  g.destroy();
}

function makeGlow(scene: Phaser.Scene): void {
  const size = 128;
  const canvasTex = scene.textures.createCanvas(TEX.glow, size, size);
  if (!canvasTex) throw new Error(`Failed to create ${TEX.glow} canvas texture`);
  const ctx = canvasTex.getContext();
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(232,160,32,0.5)");
  gradient.addColorStop(1, "rgba(232,160,32,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  canvasTex.refresh();
}
