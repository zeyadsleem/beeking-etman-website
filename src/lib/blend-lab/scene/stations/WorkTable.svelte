<script module lang="ts">
  import type { PageData } from "../../../../routes/blends/$types";
  import type { AdditiveKey } from "$lib/blends";

  export type AdditiveEntry = PageData["additives"][number];

  export interface IngredientInspection {
    key: AdditiveKey;
    title: string;
    body: string;
  }
</script>

<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import * as THREE from "three";
  import { Spring } from "svelte/motion";
  import { ADDITIVE_KEYS, ADDITIVE_LABELS } from "$lib/blends";
  import { getBlendsGame } from "$lib/blend-lab/game-state.svelte";
  import { ADDITIVE_BENEFITS, INGREDIENT_COLORS } from "$lib/blend-lab/benefits";
  import { t, type Lang } from "$lib/i18n/messages";
  import GlassBowl from "../models/GlassBowl.svelte";
  import LiquidHoney from "../models/LiquidHoney.svelte";
  import IngredientCup from "../models/IngredientCup.svelte";
  import WoodenSpoon from "../models/WoodenSpoon.svelte";

  let {
    lang,
    additives,
    oninspect,
  }: {
    lang: Lang;
    additives: AdditiveEntry[];
    oninspect: (inspection: IngredientInspection | null) => void;
  } = $props();

  const game = getBlendsGame();
  const { camera } = useThrelte();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const BOWL_POS = new THREE.Vector3(0, 0, 0);
  const PLANE_Y = 0.35;
  const TAP_PX = 6;
  const BOWL_RADIUS = 0.5;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  interface CupPos {
    x: number;
    z: number;
  }

  let dragging = $state<AdditiveKey | null>(null);
  let draggedPos = $state<CupPos>({ x: 0, z: 0 });
  let startPx = $state<{ x: number; y: number } | null>(null);
  let dragPointerId = $state<number | null>(null);

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLANE_Y);
  const hit = new THREE.Vector3();

  function cupHome(i: number): CupPos {
    const angle = Math.PI + (i / ADDITIVE_KEYS.length) * Math.PI;
    return { x: Math.cos(angle) * 0.95, z: -0.25 + Math.sin(angle) * 0.55 };
  }

  const springs = new Map<AdditiveKey, Spring<CupPos>>(
    ADDITIVE_KEYS.map((key, i): [AdditiveKey, Spring<CupPos>] => [
      key,
      new Spring(cupHome(i), { stiffness: 0.3, damping: 0.5 }),
    ]),
  );

  function posOf(key: AdditiveKey): CupPos {
    if (dragging === key) return draggedPos;
    return springs.get(key)?.current ?? cupHome(ADDITIVE_KEYS.indexOf(key));
  }

  function begin(key: AdditiveKey, e: PointerEvent): void {
    if (game.step !== "prep") return;
    if (dragging) return;
    dragging = key;
    dragPointerId = e.pointerId;
    startPx = { x: e.clientX, y: e.clientY };
    const home = posOf(key);
    draggedPos = { x: home.x, z: home.z };
  }

  function move(e: PointerEvent): void {
    if (!dragging || !startPx || e.pointerId !== dragPointerId) return;
    pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera.current);
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    draggedPos = { x: hit.x, z: hit.z };
  }

  function end(e: PointerEvent): void {
    if (!dragging || !startPx || e.pointerId !== dragPointerId) return;
    const key = dragging;
    const start = startPx;
    const droppedAt = draggedPos;
    dragging = null;
    startPx = null;
    dragPointerId = null;
    const movedPx = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (movedPx < TAP_PX) {
      game.setInspected(game.inspected === key ? null : key);
      return;
    }
    if (Math.hypot(droppedAt.x - BOWL_POS.x, droppedAt.z - BOWL_POS.z) < BOWL_RADIUS) {
      game.addDose(key);
      game.setInspected(null);
    }
    returnCup(key, droppedAt);
  }

  function returnCup(key: AdditiveKey, from: CupPos): void {
    const spring = springs.get(key);
    if (!spring) return;
    spring.set({ x: from.x, z: from.z }, { instant: true });
    void spring.set(cupHome(ADDITIVE_KEYS.indexOf(key)), { instant: reducedMotion });
  }

  function cancelDrag(e: PointerEvent): void {
    if (!dragging || e.pointerId !== dragPointerId) return;
    const key = dragging;
    const droppedAt = draggedPos;
    dragging = null;
    startPx = null;
    dragPointerId = null;
    returnCup(key, droppedAt);
  }

  let spoonAngle = $state(0);
  let lastAngle: number | null = null;

  function stirMove(e: PointerEvent): void {
    if (game.step !== "stir") return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.62;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    if (lastAngle !== null) {
      let d = angle - lastAngle;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      if (e.buttons > 0 || e.pointerType !== "mouse") {
        game.recordStir(d);
        spoonAngle = angle;
      }
    }
    lastAngle = angle;
  }

  function resetAngle(): void {
    lastAngle = null;
  }

  const byKey = $derived(new Map(additives));

  const inspection = $derived.by<IngredientInspection | null>(() => {
    const key = game.inspected;
    if (!key || game.step !== "prep") return null;
    return {
      key,
      title: byKey.get(key)?.label ?? ADDITIVE_LABELS[key][lang],
      body: lang === "ar" ? ADDITIVE_BENEFITS[key].ar : ADDITIVE_BENEFITS[key].en,
    };
  });

  $effect(() => {
    if (game.step !== "prep" && game.inspected) game.setInspected(null);
  });

  $effect(() => {
    oninspect(inspection);
  });
</script>

<svelte:window
  onpointermove={(e) => {
    move(e);
    stirMove(e);
  }}
  onpointerup={(e) => {
    end(e);
    resetAngle();
  }}
  onpointercancel={(e) => {
    cancelDrag(e);
    resetAngle();
  }}
/>

<T.Group>
  <T.Mesh position={[0, 0.4, 0]} receiveShadow>
    <T.BoxGeometry args={[2.6, 0.08, 1.8]} />
    <T.MeshStandardMaterial color="#7a4f21" roughness={0.7} />
  </T.Mesh>
  <T.Group position={[0, 0.44, 0]}>
    <GlassBowl />
    <LiquidHoney />
  </T.Group>

  {#each ADDITIVE_KEYS as key (key)}
    {@const p = posOf(key)}
    <T.Group
      position={[p.x, PLANE_Y, p.z]}
      onpointerdown={(e: PointerEvent) => begin(key, e)}
    >
      <IngredientCup color={INGREDIENT_COLORS[key]} label={key} />
    </T.Group>
  {/each}

  {#if game.step === "stir"}
    <T.Group
      position={[Math.cos(spoonAngle) * 0.42, 0.62, Math.sin(spoonAngle) * 0.42]}
      rotation={[0.9, 0, 0]}
    >
      <WoodenSpoon length={0.85} />
    </T.Group>
  {/if}
</T.Group>
