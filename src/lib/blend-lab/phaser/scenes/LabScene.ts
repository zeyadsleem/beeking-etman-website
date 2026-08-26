import Phaser from "phaser";
import {
  ADDITIVE_KEYS,
  BASE_HONEY_OPTIONS,
  BLEND_GOALS,
  type AdditiveKey,
  type BaseHoneyOption,
} from "$lib/blends";
import { HONEY_COLORS } from "../../benefits";
import { mixIngredients, type WeightedColor } from "../../color-mix";
import type { BlendsBridge, GameSnapshot, SceneActions } from "../bridge";
import { ADDITIVE_COLORS, COLORS, LAYOUT, SCENE_KEYS, TEX, hexColorToInt } from "../constants";

const DEFAULT_HONEY_HEX = "#e8a020";
const POUR_TILT_MAX = Phaser.Math.DegToRad(35);

export class LabScene extends Phaser.Scene {
  private bridge!: BlendsBridge;
  private actions!: SceneActions;
  private reducedMotion = false;
  private unsubscribe?: () => void;
  private stepGroups = new Map<GameSnapshot["step"], Phaser.GameObjects.Container>();
  private snapshot: GameSnapshot | null = null;
  private pourCompleting = false;
  private stirLastAngle: number | null = null;
  private stirLiquid!: Phaser.GameObjects.Image;
  private orderJar!: Phaser.GameObjects.Image;
  private sparkleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super(SCENE_KEYS.lab);
  }

  create(): void {
    this.bridge = this.registry.get("bridge") as BlendsBridge;
    this.actions = this.registry.get("actions") as SceneActions;
    this.reducedMotion = Boolean(this.registry.get("reducedMotion"));

    this.buildAmbient();
    this.buildGoalStation();
    this.buildHoneyStation();
    this.buildPrepStation();
    this.buildStirStation();
    this.buildPourStation();
    this.buildOrderStation();

    this.unsubscribe = this.bridge.on((event) => {
      if (event.type === "snapshot") this.applySnapshot(event.snapshot);
    });

    const initial: GameSnapshot | null = this.bridge.snapshot;
    if (initial) this.applySnapshot(initial);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.input.removeAllListeners();
      this.tweens.killAll();
    });
  }

  private applySnapshot(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
    this.pourCompleting = false;
    if (snapshot.step !== "stir") this.stirLastAngle = null;
    for (const [step, group] of this.stepGroups) {
      const active = step === snapshot.step;
      group.setVisible(active);
      group.setActive(active);
    }
    this.stirLiquid.setTint(this.mixedColorHex());
    this.orderJar.setTint(this.mixedColorHex());
    if (snapshot.step === "order") {
      this.sparkleEmitter?.start();
    } else {
      this.sparkleEmitter?.stop();
    }
  }

  private buildAmbient(): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < 12; i += 1) {
      const mote = this.add.image(
        Phaser.Math.Between(60, 1220),
        Phaser.Math.Between(60, 740),
        TEX.glow,
      );
      mote.setScale(Phaser.Math.FloatBetween(0.2, 0.5));
      mote.setAlpha(Phaser.Math.FloatBetween(0.15, 0.4));
      this.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(30, 80),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 9000),
        repeat: -1,
        onRepeat: () => {
          mote.y = 780;
          mote.alpha = Phaser.Math.FloatBetween(0.15, 0.4);
        },
      });
    }
  }

  private buildGoalStation(): void {
    const group = this.add.container(0, 0);
    BLEND_GOALS.forEach((goal, index) => {
      const y = LAYOUT.goalRow.startY + index * LAYOUT.goalRow.spacingY;
      const plaque = this.add.image(LAYOUT.goalRow.x, y, TEX.goalPlaque);
      plaque.setInteractive({ useHandCursor: true });
      plaque.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => plaque.setTint(0xffe6b0));
      plaque.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => plaque.clearTint());
      plaque.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
        this.actions.selectGoal(goal.id),
      );
      group.add(plaque);
    });
    this.registerStep("goal", group);
  }

  private buildHoneyStation(): void {
    const group = this.add.container(0, 0);
    const board = this.add.rectangle(640, LAYOUT.shelf.boardY + 70, 1040, 24, COLORS.wood);
    group.add(board);
    BASE_HONEY_OPTIONS.forEach((option, index) => {
      const x = LAYOUT.shelf.startX + index * LAYOUT.shelf.spacingX;
      const jar = this.add.image(x, LAYOUT.shelf.boardY, TEX.honeyJar);
      jar.setTint(hexColorToInt(HONEY_COLORS[option.id]));
      jar.setInteractive({ useHandCursor: true });
      jar.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => jar.setScale(1.08));
      jar.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => jar.setScale(1));
      jar.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
        this.bridge.emit({ type: "inspectHoney", id: option.id }),
      );
      group.add(jar);
    });
    this.registerStep("honey", group);
  }

  private buildPrepStation(): void {
    const group = this.add.container(0, 0);
    const bench = this.add.rectangle(640, 620, 1160, 260, COLORS.woodDark, 0.55);
    group.add(bench);
    ADDITIVE_KEYS.forEach((key: AdditiveKey, index) => {
      const x = LAYOUT.cups.startX + index * LAYOUT.cups.spacingX;
      const cup = this.add.image(x, LAYOUT.cups.y, TEX.cup);
      cup.setTint(ADDITIVE_COLORS[key]);
      cup.setInteractive({ useHandCursor: true });
      cup.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.actions.addDose(key);
        this.bridge.emit({ type: "inspectAdditive", key });
      });
      group.add(cup);
    });
    this.registerStep("prep", group);
  }

  private buildStirStation(): void {
    const group = this.add.container(0, 0);
    const liquid = this.add.image(LAYOUT.stir.x, LAYOUT.stir.y + 6, TEX.liquid);
    liquid.setTint(this.mixedColorHex());
    const bowl = this.add.image(LAYOUT.stir.x, LAYOUT.stir.y, TEX.bowl);
    const spoon = this.add.image(LAYOUT.stir.x, LAYOUT.stir.y, TEX.spoon);
    spoon.setOrigin(0.5, 0.95);
    group.add([liquid, bowl, spoon]);

    const hitZone = this.add.zone(LAYOUT.stir.x, LAYOUT.stir.y, 460, 320);
    hitZone.setInteractive({ useHandCursor: "grab" });
    this.input.setDraggable(hitZone);
    hitZone.on(Phaser.Input.Events.DRAG_START, () => {
      this.stirLastAngle = null;
    });
    hitZone.on(Phaser.Input.Events.DRAG, (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - LAYOUT.stir.x;
      const dy = pointer.y - LAYOUT.stir.y;
      const angle = Math.atan2(dy, dx);
      if (this.stirLastAngle !== null) {
        let delta = angle - this.stirLastAngle;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        this.actions.recordStir(delta);
      }
      this.stirLastAngle = angle;
      spoon.setRotation(angle + Math.PI / 2);
      liquid.setTint(this.mixedColorHex());
    });
    hitZone.on(Phaser.Input.Events.DRAG_END, () => {
      this.stirLastAngle = null;
    });
    group.add(hitZone);
    this.stirLiquid = liquid;
    this.registerStep("stir", group);
  }

  private buildPourStation(): void {
    const group = this.add.container(0, 0);
    const { jarX, jarY, glassX, glassY, glassW, glassH } = LAYOUT.pour;
    const fill = this.add.image(glassX, glassY + glassH / 2 - 8, TEX.fillLevel);
    fill.setOrigin(0.5, 1);
    const fillBaseWidth = fill.width;
    fill.setDisplaySize(fillBaseWidth, 1);
    const glass = this.add.image(glassX, glassY, TEX.glass);
    const jar = this.add.image(jarX, jarY, TEX.pourJar);
    jar.setOrigin(0.5, 0.9);
    const stream = this.add.image(jarX - 46, jarY + 30, TEX.stream);
    stream.setOrigin(0.5, 0);
    stream.setVisible(false);
    group.add([fill, glass, jar, stream]);

    const zone = this.add.zone(glassX, glassY, glassW + 160, glassH + 120);
    zone.setInteractive({ useHandCursor: "grab" });
    this.input.setDraggable(zone);
    zone.on(Phaser.Input.Events.DRAG, (pointer: Phaser.Input.Pointer) => {
      if (this.pourCompleting) return;
      const progress = Phaser.Math.Clamp(pointer.y / 620, 0, 1);
      this.actions.setJarFill(progress);
      jar.setRotation(-POUR_TILT_MAX * progress);
      stream.setVisible(progress > 0.05);
      fill.setDisplaySize(fillBaseWidth, Math.max(1, Math.round(progress * (glassH - 20))));
      fill.setTint(this.mixedColorHex());
      if (progress >= 1) {
        this.pourCompleting = true;
        stream.setVisible(false);
        this.actions.completePour();
      }
    });
    group.add(zone);
    this.registerStep("pour", group);
  }

  private buildOrderStation(): void {
    const group = this.add.container(0, 0);
    const jar = this.add.image(LAYOUT.pour.jarX, LAYOUT.pour.jarY, TEX.pourJar);
    this.orderJar = jar;
    jar.setTint(this.mixedColorHex());
    group.add(jar);
    if (!this.reducedMotion) {
      const sparkle = this.add.particles(LAYOUT.pour.jarX, LAYOUT.pour.jarY - 110, TEX.drop, {
        speedY: { min: -60, max: -20 },
        speedX: { min: -25, max: 25 },
        lifespan: 1200,
        quantity: 1,
        frequency: 450,
        scale: { min: 0.5, max: 1 },
        alpha: { start: 0.9, end: 0 },
      });
      sparkle.stop();
      group.add(sparkle);
      this.sparkleEmitter = sparkle;
    }
    this.registerStep("order", group);
  }

  private registerStep(step: GameSnapshot["step"], group: Phaser.GameObjects.Container): void {
    group.setVisible(false);
    group.setActive(false);
    this.stepGroups.set(step, group);
  }

  private mixedColorHex(): number {
    const snapshot = this.snapshot;
    if (!snapshot) return COLORS.honey;
    const weights: WeightedColor[] = ADDITIVE_KEYS.map((key) => ({
      hex: this.additiveHex(key),
      weight: snapshot.doses[key],
    }));
    const baseHex =
      snapshot.honeyId !== null && snapshot.honeyId in HONEY_COLORS
        ? HONEY_COLORS[snapshot.honeyId as BaseHoneyOption["id"]]
        : DEFAULT_HONEY_HEX;
    const hex = mixIngredients(baseHex, weights, snapshot.mixProgress);
    return hexColorToInt(hex);
  }

  private additiveHex(key: AdditiveKey): string {
    return `#${ADDITIVE_COLORS[key].toString(16).padStart(6, "0")}`;
  }
}
