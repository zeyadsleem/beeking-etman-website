import Phaser from "phaser";
import { SCENE_KEYS } from "../constants";
import { generateCoreTextures } from "../textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    generateCoreTextures(this);
    this.scene.start(SCENE_KEYS.lab);
  }
}
