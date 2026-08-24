<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import * as THREE from "three";
  import { ADDITIVE_KEYS } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { HONEY_COLORS, INGREDIENT_COLORS } from "$lib/blend-lab/benefits";
  import { mixIngredients } from "$lib/blend-lab/color-mix";
  import GlassBowl from "../models/GlassBowl.svelte";
  import LiquidHoney from "../models/LiquidHoney.svelte";
  import HoneyJar from "../models/HoneyJar.svelte";

  const game = getBlendsGame();
  const JAR_POS = new THREE.Vector3(1.6, 0.44, 0);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const POUR_SECONDS = reducedMotion ? 1.2 : 4;

  let elapsed = $state(0);
  let tilt = $state(0); // radians

  const jarColor = $derived(
    mixIngredients(
      HONEY_COLORS[game.honeyId ?? "clover"],
      ADDITIVE_KEYS.map((key) => ({ hex: INGREDIENT_COLORS[key], weight: game.doses[key] })),
      1,
    ),
  );

  // Pour/tilt state is reactive ($state read by the template), so those
  // mutations invalidate frames themselves; disabling auto-invalidation stops
  // this idle task from forcing continuous rendering in on-demand mode.
  useTask(
    (delta) => {
      if (game.step === "pour") {
        elapsed += delta;
        const t = Math.min(1, elapsed / POUR_SECONDS);
        tilt = Math.min(Math.PI / 2.2, tilt + delta * 1.8);
        game.setJarFill(t);
        if (t >= 1 && game.jarFill >= 0.999) {
          game.completePour();
        }
      } else if (game.step !== "order") {
        elapsed = 0;
        tilt = Math.max(0, tilt - delta * 3);
      }
    },
    { autoInvalidate: false },
  );
</script>

<T.Group>
  <T.Mesh position={[JAR_POS.x - 0.25, 0.22, JAR_POS.z]} receiveShadow castShadow>
    <T.BoxGeometry args={[0.5, 0.44, 0.5]} />
    <T.MeshStandardMaterial color="#6f4a20" roughness={0.75} />
  </T.Mesh>

  <T.Group position={[JAR_POS.x, 0.44, JAR_POS.z]}>
    <HoneyJar scale={0.9} fillLevel={game.jarFill} color={jarColor} />
  </T.Group>

  {#if game.step === "pour"}
    <!-- honey bowl flying over the jar -->
    <T.Group
      position={[
        THREE.MathUtils.lerp(0, JAR_POS.x + 0.05, Math.min(1, elapsed / 0.8)),
        THREE.MathUtils.lerp(0.44, 1.15, Math.min(1, elapsed / 0.8)),
        0,
      ]}
      rotation={[0, 0, -tilt]}
    >
      <GlassBowl radius={0.45} height={0.42} />
      <LiquidHoney radius={0.45} height={0.42} />
    </T.Group>

    <!-- stream -->
    <T.Mesh position={[JAR_POS.x, 0.95, JAR_POS.z]}>
      <T.CylinderGeometry args={[0.02, 0.03, 0.5, 12]} />
      <T.MeshStandardMaterial color="#e8a020" roughness={0.2} transparent opacity={0.9} />
    </T.Mesh>
  {/if}
</T.Group>
