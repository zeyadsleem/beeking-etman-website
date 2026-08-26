import { BlendsBridge, type SceneActions } from "./bridge";
import { GAME_HEIGHT, GAME_WIDTH } from "./constants";

export interface CreateGameOptions {
  readonly container: HTMLElement;
  readonly bridge: BlendsBridge;
  readonly actions: SceneActions;
  readonly reducedMotion: boolean;
}

export interface CreatedGame {
  readonly destroy: () => void;
}

export async function createGame(options: CreateGameOptions): Promise<CreatedGame> {
  const Phaser = await import("phaser");
  const { BootScene } = await import("./scenes/BootScene");
  const { LabScene } = await import("./scenes/LabScene");

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.container,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#1c1410",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    audio: { noAudio: true },
    scene: [],
  });

  game.scene.add("BootScene", BootScene, false);
  game.scene.add("LabScene", LabScene, false);
  game.registry.set("bridge", options.bridge);
  game.registry.set("actions", options.actions);
  game.registry.set("reducedMotion", options.reducedMotion);
  game.scene.start("BootScene");

  return {
    destroy: () => {
      game.destroy(true);
    },
  };
}
