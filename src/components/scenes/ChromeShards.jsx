import { useScene, toColor } from './useScene';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// A drifting field of thin chrome plates in real depth. Move the cursor through it and the plates scatter away and spin up, then settle back; the camera leans with you so the depth is easy to feel.
const ChromeShards = ({ tint = '#d9d6d2', accent = '#7d1d20', background = '#0d0c0c', count = 90, size = 0.85, roughness = 0.14, speed = 1, mouse = 1, reach = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.55;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.14 });
    const geo = new THREE.BoxGeometry(1, 1.7, 0.05);
    camera.fov = 45;
    camera.position.set(0, 0, 10);
    let mesh = null;
    let n = -1;
    let items = [];
    const dummy = new THREE.Object3D();
    const rnd = (a) => { a = Math.sin(a * 127.1) * 43758.5453; return a - Math.floor(a); };
    const build = (c) => {
      if (mesh) { scene.remove(mesh); mesh.dispose(); }
      mesh = new THREE.InstancedMesh(geo, mat, c);
      items = [];
      for (let i = 0; i < c; i++) {
        items.push({ x: (rnd(i + 1) - 0.5) * 17, y: (rnd(i + 2) - 0.5) * 9.5, z: -7 + rnd(i + 3) * 9, rx: rnd(i + 4) * 6.28, ry: rnd(i + 5) * 6.28, rz: rnd(i + 6) * 6.28, sp: 0.2 + rnd(i + 7) * 0.5, s: 0.4 + rnd(i + 8) * 0.9, acc: rnd(i + 9) > 0.88 });
      }
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
        const lean = (p.mouse ?? 1) * pointer.hover;
        camera.position.x = (pointer.x - 0.5) * 2.2 * lean;
        camera.position.y = (pointer.y - 0.5) * 1.4 * lean;
        camera.lookAt(0, 0, 0);
        const h = 2 * Math.tan((camera.fov * Math.PI) / 360) * 10;
        const wx = (pointer.x - 0.5) * h * camera.aspect;
        const wy = (pointer.y - 0.5) * h;
        const rr = 3.2 * (p.reach ?? 1);
        items.forEach((it, i) => {
          const dx = it.x - wx; const dy = it.y - wy;
          const d2 = dx * dx + dy * dy;
          const push = Math.exp(-d2 / (rr * rr)) * lean;
          const d = Math.sqrt(d2) + 1e-3;
          dummy.position.set(it.x + (dx / d) * push * 2.6, it.y + (dy / d) * push * 2.6 + Math.sin(t * 0.4 + i) * 0.15, it.z + push * 1.4);
          const spin = t * it.sp * 0.6 + push * 2.2;
          dummy.rotation.set(it.rx + spin * 0.7, it.ry + spin, it.rz + spin * 0.4);
          dummy.scale.setScalar(it.s * p.size * (1 + push * 0.35));
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, it.acc ? acc : base);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
      dispose() { env.dispose(); pmrem.dispose(); geo.dispose(); },
    };
  }, []);
  propsRef.current = { tint, accent, background, count, size, roughness, speed, mouse, reach };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default ChromeShards;
