<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import * as THREE from "three";

  let { length = 0.9 }: { length?: number } = $props();

  const createGeometries = (): {
    handleGeo: THREE.CylinderGeometry;
    bowlGeo: THREE.SphereGeometry;
  } => ({
    handleGeo: new THREE.CylinderGeometry(0.03, 0.035, length * 0.7, 16),
    bowlGeo: new THREE.SphereGeometry(0.11, 24, 16),
  });

  const { handleGeo, bowlGeo } = createGeometries();

  onDestroy(() => {
    handleGeo.dispose();
    bowlGeo.dispose();
  });
</script>

<T.Group>
  <T.Mesh
    geometry={handleGeo}
    position={[0, length * 0.35, 0]}
    rotation={[Math.PI / 2, 0, 0]}
    castShadow
  >
    <T.MeshStandardMaterial color="#8b5a2b" roughness={0.65} metalness={0} />
  </T.Mesh>
  <T.Mesh geometry={bowlGeo} scale={[1, 0.45, 1]} castShadow>
    <T.MeshStandardMaterial color="#a06a33" roughness={0.55} />
  </T.Mesh>
</T.Group>
