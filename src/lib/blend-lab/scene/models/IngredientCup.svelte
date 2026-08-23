<script lang="ts">
  import { T } from "@threlte/core";

  let { color, label }: { color: string; label: string } = $props();
</script>

<T.Group data-label={label}>
  <T.Mesh position={[0, 0.09, 0]} castShadow>
    <T.CylinderGeometry args={[0.13, 0.10, 0.18, 24]} />
    <T.MeshStandardMaterial color="#f5efe2" roughness={0.5} />
  </T.Mesh>
  <T.Mesh position={[0, 0.185, 0]} castShadow>
    <T.SphereGeometry args={[0.115, 20, 12]} />
    <T.MeshStandardMaterial {color} roughness={0.7} />
  </T.Mesh>
</T.Group>
