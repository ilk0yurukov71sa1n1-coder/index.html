import { useScene, toColor } from './useScene';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// A wall of tall chrome slats in two staggered rows. They sway on their own; as the cursor passes, the slats near it turn to face it and step forward, so a ridge of light follows your hand across the wall.
const ChromeSlats = ({ tint = '#d9d6d2', accent = '#7d1d20', background = '#0d0c0c', count = 30, roughness = 0.16, depth = 1, speed = 1, mouse = 1, reach = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.16 });
    const geo = new THREE.BoxGeometry(0.34, 6.2, 0.5);
    camera.fov = 38;
    camera.position.set(0, 0, 11);
    let mesh = null;
    let n = -1;
    let seeds = [];
    const dummy = new THREE.Object3D();
    const build = (c) => {
      if (mesh) { scene.remove(mesh); mesh.dispose(); }
      mesh = new THREE.InstancedMesh(geo, mat, c * 2);
      seeds = [];
      for (let i = 0; i < c * 2; i++) seeds.push({ r: Math.random(), layer: i < c ? 0 : 1, k: i % c });
      scene.add(mesh);
    };
    return {
      update(t) {
        const p = props.current;
        if (n !== p.count) { n = p.count; build(n); }
        mat.roughness = p.roughness;
        renderer.setClearColor(toColor(THREE, p.background, '#0d0c0c'), 1);
        const base = toColor(THREE, p.tint, '#d9d6d2');
        const acc = toColor(THREE, p.accent, '#7d1d20');
        const h = 2 * Math.tan((camera.fov * Math.PI) / 360) * 11;
        const w = h * camera.aspect * 1.12;
        const step = w / n;
        const lean = (p.mouse ?? 1) * pointer.hover;
        const wx = (pointer.x - 0.5) * (h * camera.aspect);
        const wy = (pointer.y - 0.5) * h;
        const rr = 2.4 * (p.reach ?? 1);
        seeds.forEach((s, i) => {
          const x = -w / 2 + (s.k + 0.5 + (s.layer ? 0.5 : 0)) * step;
          const z0 = s.layer ? -1.1 * p.depth : 0;
          const dx = x - wx;
          const near = Math.exp(-(dx * dx) / (rr * rr)) * lean;
          const sway = Math.sin(t * 0.55 + s.k * 0.38 + s.layer * 1.7) * 0.42;
          const face = Math.max(-1.2, Math.min(1.2, -dx * 0.55)) * near;
          dummy.position.set(x, wy * 0.12 * near, z0 + near * 1.8 * p.depth);
          dummy.rotation.set(0, sway + face, 0);
          dummy.scale.set(1 + near * 0.35, 1, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          const isAcc = ((s.k * 7 + s.layer * 3) % 11) === 0;
          mesh.setColorAt(i, isAcc ? acc : base);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
      dispose() { env.dispose(); pmrem.dispose(); geo.dispose(); },
    };
  }, []);
  propsRef.current = { tint, accent, background, count, roughness, depth, speed, mouse, reach };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default ChromeSlats;
