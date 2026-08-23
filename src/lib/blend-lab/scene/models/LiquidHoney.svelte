<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import * as THREE from "three";
  import { ADDITIVE_KEYS, type AdditiveKey } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { HONEY_COLORS, INGREDIENT_COLORS } from "$lib/blend-lab/benefits";
  import { mixIngredients, type WeightedColor } from "$lib/blend-lab/color-mix";

  const game = getBlendsGame();
  const BOWL_R = 0.5;
  const BOWL_H = 0.42;

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(HONEY_COLORS.clover) },
    uSurfaceColor: { value: new THREE.Color(HONEY_COLORS.clover) },
    uFill: { value: 0 },
    uStirVelocity: { value: 0 },
  };

  let elapsed = 0;
  let lastTotal = 0;

  const dosedColors: (WeightedColor & { key: AdditiveKey })[] = ADDITIVE_KEYS.map(
    (key) => ({ key, hex: INGREDIENT_COLORS[key], weight: 0 }),
  );

  let mesh: THREE.Mesh | undefined = $state();

  const geometry = new THREE.CylinderGeometry(BOWL_R, BOWL_R * 0.7, BOWL_H, 40);

  onDestroy(() => {
    geometry.dispose();
  });

  useTask((delta) => {
    elapsed += delta;
    uniforms.uTime.value = elapsed;
    const baseId = game.honeyId ?? "clover";
    uniforms.uBaseColor.value.set(HONEY_COLORS[baseId]);

    for (const dosed of dosedColors) {
      dosed.weight = game.doses[dosed.key];
    }
    uniforms.uSurfaceColor.value.set(
      mixIngredients(HONEY_COLORS[baseId], dosedColors, game.mixProgress),
    );
    uniforms.uFill.value += (game.jarFill - uniforms.uFill.value) * delta * 4;
    uniforms.uStirVelocity.value +=
      (game.stirTotal - lastTotal) * 8 - uniforms.uStirVelocity.value * delta * 6;
    lastTotal = game.stirTotal;

    if (!mesh) return;
    const f = Math.max(uniforms.uFill.value, 0.001);
    mesh.scale.y = f;
    mesh.position.y = 0.02 + (BOWL_H * f) / 2;
  });

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uStirVelocity;
    varying vec2 vUv;
    varying vec3 vNormalW;

    void main() {
      vUv = uv;
      vec3 p = position;
      float ripple = sin(p.x * 18.0 + uTime * 4.0) *
                     cos(p.z * 15.0 - uTime * 3.0);
      p.y += ripple * 0.008 * (0.4 + uStirVelocity);
      vNormalW = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uSurfaceColor;
    uniform float uTime;
    uniform float uStirVelocity;
    varying vec2 vUv;
    varying vec3 vNormalW;

    void main() {
      float swirl = smoothstep(0.35, 0.65, sin(vUv.x * 40.0 +
        vUv.y * 12.0 + uTime * (1.5 + uStirVelocity * 2.0)) * 0.5 + 0.5);
      vec3 col = mix(uBaseColor, uSurfaceColor, clamp(swirl, 0.0, 1.0));
      float fresnel = pow(1.0 - abs(dot(normalize(vNormalW),
        vec3(0.0, 0.0, 1.0))), 2.0);
      col += fresnel * 0.25;
      gl_FragColor = vec4(col, 0.94);
    }
  `;
</script>

<T.Mesh bind:ref={mesh} position={[0, 0.02 + BOWL_H / 2, 0]} {geometry}>
  <T.ShaderMaterial
    {uniforms}
    vertexShader={vertexShader}
    fragmentShader={fragmentShader}
    transparent
  />
</T.Mesh>
