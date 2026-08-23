<script lang="ts">
  import { T } from "@threlte/core";

  let {
    scale = 1,
    fillLevel = 0.75,
    color = "#e8a020",
  }: { scale?: number; fillLevel?: number; color?: string } = $props();

  const H = 0.62;
  const R = 0.22;
  const innerH = H * 0.85;
</script>

<T.Group {scale}>
  <T.Mesh position={[0, H / 2, 0]} castShadow>
    <T.CylinderGeometry args={[R, R, H, 32]} />
    <T.MeshPhysicalMaterial
      color="#ffffff"
      transmission={0.92}
      roughness={0.08}
      ior={1.5}
      thickness={0.04}
      transparent
      opacity={0.5}
    />
  </T.Mesh>

  <T.Mesh position={[0, 0.02 + (innerH * fillLevel) / 2, 0]}>
    <T.CylinderGeometry args={[R - 0.02, R - 0.02, Math.max(innerH * fillLevel, 0.001), 32]} />
    <T.MeshPhysicalMaterial {color} roughness={0.25} clearcoat={0.6} />
  </T.Mesh>

  <T.Mesh position={[0, H + 0.03, 0]} castShadow>
    <T.CylinderGeometry args={[R + 0.02, R + 0.02, 0.07, 32]} />
    <T.MeshStandardMaterial color="#c9930a" roughness={0.35} metalness={0.7} />
  </T.Mesh>
</T.Group>
