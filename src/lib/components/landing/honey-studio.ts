import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** Physical product study, using the actual Sidr jar photograph for its label. */
export async function createHoneyStudio(
  container: HTMLElement,
  getProgress: () => number,
  onUnavailable: () => void,
) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x141611, 0);
  // The glass is a transmissive material, so every frame renders a second
  // transmission target. Half resolution is invisible through the jar and
  // keeps the viewport inside a software renderer's budget.
  renderer.transmissionResolutionScale = 0.5;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 50);
  const studio = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, 0.04);
  studio.dispose();
  generator.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.3;
  const textures: THREE.Texture[] = [];
  let frame = 0;
  let observer: IntersectionObserver | undefined;
  let resize: ResizeObserver | undefined;
  let destroyed = false;
  let visible = true;
  let dirty = true;
  let previous = -1;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    cancelAnimationFrame(frame);
    observer?.disconnect();
    resize?.disconnect();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          material.dispose();
      }
    });
    textures.forEach((texture) => texture.dispose());
    environment.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  const contextLost = () => {
    destroy();
    onUnavailable();
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);

  try {
    const jar = new THREE.Group();
    scene.add(jar);
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, y = 0) => {
      const object = new THREE.Mesh(geometry, material);
      object.position.y = y;
      object.castShadow = true;
      object.receiveShadow = true;
      jar.add(object);
      return object;
    };
    const lathe = (points: number[][]) =>
      new THREE.LatheGeometry(
        points.map(([x, y]) => new THREE.Vector2(x, y)),
        96,
      );
    const honeyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x190800,
      roughness: 0.21,
      metalness: 0,
      transmission: 0,
      thickness: 1.5,
      ior: 1.48,
      attenuationColor: new THREE.Color(0x572205),
      attenuationDistance: 0.6,
      clearcoat: 0.35,
      clearcoatRoughness: 0.12,
    });
    mesh(
      lathe([
        [0, -1.24],
        [0.64, -1.24],
        [0.75, -1.2],
        [0.795, -1.1],
        [0.795, 0.57],
        [0.76, 0.69],
        [0.72, 0.72],
        [0, 0.72],
      ]),
      honeyMaterial,
    );
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.055,
      metalness: 0,
      transmission: 1,
      thickness: 0.075,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.055,
      transparent: true,
      opacity: 1,
    });
    mesh(
      lathe([
        [0, -1.34],
        [0.6, -1.34],
        [0.77, -1.3],
        [0.85, -1.2],
        [0.87, -1.06],
        [0.87, 0.56],
        [0.83, 0.76],
        [0.74, 0.91],
        [0.7, 1.06],
        [0.7, 1.13],
        [0.65, 1.13],
        [0.65, 1.0],
        [0.7, 0.86],
        [0.79, 0.59],
        [0.8, -1.12],
        [0.74, -1.23],
        [0, -1.23],
      ]),
      glass,
    );
    const rim = mesh(new THREE.TorusGeometry(0.674, 0.025, 12, 96), glass, 1.06);
    rim.rotation.x = Math.PI / 2;
    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0xeeeae0,
      roughness: 0.35,
      metalness: 0.03,
    });
    mesh(new THREE.CylinderGeometry(0.73, 0.747, 0.34, 96), capMaterial, 1.27);
    const top = mesh(new THREE.CylinderGeometry(0.718, 0.731, 0.045, 96), capMaterial, 1.452);
    top.castShadow = false;
    const ridgeGeometry = new THREE.BoxGeometry(0.009, 0.235, 0.015);
    const ridges = new THREE.InstancedMesh(ridgeGeometry, capMaterial, 112);
    const ridgeTransform = new THREE.Object3D();
    for (let i = 0; i < 112; i++) {
      const angle = (i / 112) * Math.PI * 2;
      ridgeTransform.position.set(Math.sin(angle) * 0.744, 1.275, Math.cos(angle) * 0.744);
      ridgeTransform.rotation.y = angle;
      ridgeTransform.updateMatrix();
      ridges.setMatrixAt(i, ridgeTransform.matrix);
    }
    jar.add(ridges);
    const printedLabel = new THREE.MeshStandardMaterial({
      color: 0xa49468,
      roughness: 0.62,
      metalness: 0.04,
    });
    mesh(
      new THREE.CylinderGeometry(0.883, 0.883, 1.15, 96, 1, true, -1.21, 2.42),
      printedLabel,
      -0.39,
    );
    // The photographed label is the last thing to arrive, never a gate: the
    // studio renders on the plain backing colour and the print fades in when
    // the texture lands. Awaiting it here used to hold the first frame — and
    // the main thread — for as long as the image took.
    void new THREE.TextureLoader()
      .loadAsync("/images/Beeking Etman/برطمان السدر المصرى.jpg")
      .then((label) => {
        textures.push(label);
        if (destroyed) return;
        label.colorSpace = THREE.SRGBColorSpace;
        // UV window isolates the photographed label; source bytes remain unchanged.
        label.repeat.set(485 / 768, 338 / 1024);
        label.offset.set(130 / 768, 1 - (480 + 338) / 1024);
        label.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        printedLabel.map = label;
        printedLabel.color.set(0xffffff);
        printedLabel.needsUpdate = true;
        dirty = true;
      })
      .catch(() => {});

    const key = new THREE.SpotLight(0xfff1d8, 80, 18, 0.65, 0.8, 2);
    key.position.set(-3.5, 5, 5);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.001;
    scene.add(key, key.target);
    const edge = new THREE.SpotLight(0xdedbca, 65, 16, 0.6, 0.8, 2);
    edge.position.set(3, 3, -2);
    edge.target.position.set(0, 0.2, 0);
    scene.add(edge, edge.target);
    const front = new THREE.DirectionalLight(0xfff5df, 1.25);
    front.position.set(0, 1, 5);
    scene.add(front);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.13 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.345;
    floor.receiveShadow = true;
    scene.add(floor);

    const stops = [
      { at: 0, position: [0, 0.75, 8.1], target: [0, 0.05, 0], turn: -0.1 },
      { at: 0.27, position: [3.8, 1.1, 5.2], target: [0, 0.05, 0], turn: 0.06 },
      { at: 0.53, position: [1.9, 1.72, 3.5], target: [0, 0.72, 0], turn: 0.04 },
      { at: 0.78, position: [-0.9, 0.15, 3.65], target: [0, -0.3, 0], turn: -0.08 },
      { at: 1, position: [0, 0.75, 8.1], target: [0, 0.05, 0], turn: -0.1 },
    ];
    const target = new THREE.Vector3();
    observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      dirty = true;
    });
    observer.observe(container);
    resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = width < 650 ? 39 : 31;
      camera.updateProjectionMatrix();
      dirty = true;
    });
    resize.observe(container);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      const p = Math.max(0, Math.min(1, getProgress()));
      if (!dirty && Math.abs(previous - p) < 0.00005) return;
      previous = p;
      dirty = false;
      const index = Math.min(
        stops.length - 2,
        Math.max(
          0,
          stops.findIndex(
            (stop, i) => i < stops.length - 1 && p >= stop.at && p <= stops[i + 1].at,
          ),
        ),
      );
      const a = stops[index],
        b = stops[index + 1];
      const linear = (p - a.at) / (b.at - a.at);
      const mix = linear * linear * (3 - 2 * linear);
      camera.position
        .set(...(a.position as [number, number, number]))
        .lerp(new THREE.Vector3(...(b.position as [number, number, number])), mix);
      target
        .set(...(a.target as [number, number, number]))
        .lerp(new THREE.Vector3(...(b.target as [number, number, number])), mix);
      jar.rotation.y = THREE.MathUtils.lerp(a.turn, b.turn, mix);
      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    draw();
    return { destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}
