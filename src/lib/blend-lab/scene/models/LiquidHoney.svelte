<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import {
    ADDITIVE_KEYS,
    zeroDoses,
    type AdditiveKey,
    type BaseHoneyOption,
  } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { HONEY_COLORS, INGREDIENT_COLORS } from "$lib/blend-lab/benefits";
  import { mixIngredients, type WeightedColor } from "$lib/blend-lab/color-mix";

  const game = getBlendsGame();
  const { invalidate } = useThrelte();

  // Defaults mirror GlassBowl's defaults so unpaired usage still nests cleanly;
  // call sites pass the same radius/height as their paired GlassBowl.
  let { radius = 0.55, height = 0.5 }: { radius?: number; height?: number } = $props();
  const DEFAULT_BASE_ID: BaseHoneyOption["id"] = "clover";

  const uniforms = {
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

  interface MixSnapshot {
    baseId: BaseHoneyOption["id"] | null;
    doses: Record<AdditiveKey, number>;
    mixProgress: number;
  }

  const mixCache: MixSnapshot = {
    baseId: null,
    doses: zeroDoses(),
    mixProgress: -1,
  };

  function snapshotMatchesGame(baseId: BaseHoneyOption["id"]): boolean {
    if (mixCache.baseId !== baseId || mixCache.mixProgress !== game.mixProgress) {
      return false;
    }
    for (let i = 0; i < ADDITIVE_KEYS.length; i++) {
      const key = ADDITIVE_KEYS[i];
      if (mixCache.doses[key] !== game.doses[key]) return false;
    }
    return true;
  }

  function normalizedHexKey(hex: string): string {
    return hex.slice(hex.indexOf("#") + 1).toLowerCase();
  }

  function applyMixColors(baseId: BaseHoneyOption["id"], mixProgress: number): void {
    const baseHex = HONEY_COLORS[baseId];
    for (const dosed of dosedColors) {
      dosed.weight = game.doses[dosed.key];
      mixCache.doses[dosed.key] = game.doses[dosed.key];
    }
    const surfaceHex = mixIngredients(baseHex, dosedColors, mixProgress);
    const baseColor = uniforms.uBaseColor.value;
    if (baseColor.getHexString() !== normalizedHexKey(baseHex)) {
      baseColor.set(baseHex);
    }
    const surfaceColor = uniforms.uSurfaceColor.value;
    if (surfaceColor.getHexString() !== normalizedHexKey(surfaceHex)) {
      surfaceColor.set(surfaceHex);
    }
    mixCache.baseId = baseId;
    mixCache.mixProgress = mixProgress;
  }

  let mesh: THREE.Mesh | undefined = $state();

  // Honey hugs the bowl's lathe profile (same curve as GlassBowl) inset by a
  // wall margin, so the surface never clips through the glass; the last two
  // points close a flat top surface.
  function createLiquidGeometry(bowlRadius: number, bowlHeight: number): THREE.LatheGeometry {
    const segments = 24;
    const inset = 0.025;
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const wall = bowlRadius * Math.sin((t * Math.PI) / 2) ** 0.6;
      points.push(new THREE.Vector2(Math.max(wall - inset, 0.02), t * bowlHeight));
    }
    points.push(new THREE.Vector2(Math.max(bowlRadius * 0.5, 0.02), bowlHeight));
    points.push(new THREE.Vector2(0.01, bowlHeight));
    return new THREE.LatheGeometry(points, 48);
  }

  const geometry = $derived(createLiquidGeometry(radius, height));

  $effect(() => () => geometry.dispose());

  // Uniform/mesh mutations bypass Threlte's reactive props, so in on-demand
  // (reduced-motion) rendering this task invalidates frames itself — but only
  // while values are actually settling, so idle scenes render no extra frames.
  useTask(
    (delta) => {
      elapsed += delta;
      uniforms.uTime.value = elapsed;

      let dirty = false;

      const baseId = game.honeyId ?? DEFAULT_BASE_ID;
      if (!snapshotMatchesGame(baseId)) {
        applyMixColors(baseId, game.mixProgress);
        dirty = true;
      }

      const fillBefore = uniforms.uFill.value;
      uniforms.uFill.value = Math.min(
        1,
        Math.max(0, fillBefore + (game.jarFill - fillBefore) * delta * 4),
      );
      if (Math.abs(uniforms.uFill.value - fillBefore) > 1e-4) dirty = true;

      const stirBefore = uniforms.uStirVelocity.value;
      uniforms.uStirVelocity.value = Math.max(
        0,
        stirBefore + (game.stirTotal - lastTotal) * 8 - stirBefore * delta * 6,
      );
      if (Math.abs(uniforms.uStirVelocity.value - stirBefore) > 1e-4) dirty = true;
      lastTotal = game.stirTotal;

      if (mesh) {
        const f = Math.max(uniforms.uFill.value, 0.001);
        mesh.scale.y = f;
        mesh.position.y = 0.02 + (height * f) / 2;
      }

      if (dirty) invalidate();
    },
    { autoInvalidate: false },
  );

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uStirVelocity;
    varying vec2 vUv;
    varying vec3 vNormalV;

    void main() {
      vUv = uv;
      vec3 p = position;
      float ripple = sin(p.x * 18.0 + uTime * 4.0) *
                     cos(p.z * 15.0 - uTime * 3.0);
      p.y += ripple * 0.008 * (0.4 + uStirVelocity);
      vNormalV = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uSurfaceColor;
    uniform float uTime;
    uniform float uStirVelocity;
    varying vec2 vUv;
    varying vec3 vNormalV;

    void main() {
      float swirl = smoothstep(0.35, 0.65, sin(vUv.x * 40.0 +
        vUv.y * 12.0 + uTime * (1.5 + uStirVelocity * 2.0)) * 0.5 + 0.5);
      vec3 col = mix(uBaseColor, uSurfaceColor, clamp(swirl, 0.0, 1.0));
      float fresnel = pow(1.0 - abs(dot(normalize(vNormalV),
        vec3(0.0, 0.0, 1.0))), 2.0);
      col += fresnel * 0.25;
      gl_FragColor = vec4(col, 0.94);
    }
  `;
</script>

<T.Mesh bind:ref={mesh} position={[0, 0.02 + height / 2, 0]} {geometry}>
  <T.ShaderMaterial
    {uniforms}
    vertexShader={vertexShader}
    fragmentShader={fragmentShader}
    transparent
  />
</T.Mesh>
