<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import * as THREE from "three";

  let { radius = 0.55, height = 0.5 }: { radius?: number; height?: number } =
    $props();

  const createGeometry = (): THREE.LatheGeometry => {
    const points: THREE.Vector2[] = [];
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = radius * Math.sin((t * Math.PI) / 2) ** 0.6;
      points.push(new THREE.Vector2(Math.max(r, 0.02), t * height));
    }
    return new THREE.LatheGeometry(points, 48);
  };

  const geometry = createGeometry();

  onDestroy(() => {
    geometry.dispose();
  });
</script>

<T.Mesh {geometry} castShadow receiveShadow>
  <T.MeshPhysicalMaterial
    color="#ffffff"
    transmission={0.95}
    thickness={0.05}
    roughness={0.06}
    ior={1.5}
    transparent
    opacity={0.4}
    side={THREE.DoubleSide}
  />
</T.Mesh>
