<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { STEP_CAMERAS } from "./cameras";

  const game = getBlendsGame();
  const { camera } = useThrelte();

  const currentTarget = new THREE.Vector3(...STEP_CAMERAS.goal.target);
  const tmpPos = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();

  const ease = (t: number): number => t * t * (3 - 2 * t);

  const instant = $derived(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useTask((delta) => {
    const pose = STEP_CAMERAS[game.step];
    if (!pose) return;
    const k = instant ? 1 : Math.min(1, delta * 2.5);
    camera.current.position.lerp(tmpPos.set(...pose.position), ease(k));
    currentTarget.lerp(tmpTarget.set(...pose.target), ease(k));
    camera.current.lookAt(currentTarget);
  });
</script>
