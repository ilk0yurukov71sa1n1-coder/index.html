import { useScene, toColor, studioEnv } from './useScene';

// A wall of chrome slats with rounded edges, lit by two strip lights and one warm one. They sway slowly; as the cursor passes, the slats near it turn to face it and step forward, so a line of light follows your hand across the wall.
const ChromeSlats = ({ tint = '#cfcac4', accent = '#7d1d20', background = '#0b0a0a', count = 44, roughness = 0.1, depth = 1, speed = 1, mouse = 1, reach = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    const env = studioEnv(THREE, renderer);
    scene.environment = env;
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.1 });
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 8, 40, 1);
    geo.scale(0.3, 1, 0.14);
    camera.fov = 36;
    camera.position.set(0, 0, 12);
    let mesh = null;
    let n = -1;
    let seeds = [];
    const dummy = new THREE.Object3D();
    const build = (c) => {
      if (mesh) { scene.remove(mesh); mesh.dispose(); }
      mesh = new THREE.InstancedMesh(geo, mat, c * 2);
      seeds = [];
      for (let i = 0; i < c * 2; i++) seeds.push({ layer: i < c ? 0 : 1, k: i % c });
      scene.add(mesh);
    };
    return {
      update(t) {
        const p = props.current;
        if (n !== p.count) { n = p.count; build(n); }
        mat.roughness = p.roughness;
        renderer.setClearColor(toColor(THREE, p.background, '#0b0a0a'), 1);
        const base = toColor(THREE, p.tint, '#cfcac4');
        const acc = toColor(THREE, p.accent, '#7d1d20');
        const h = 2 * Math.tan((camera.fov * Math.PI) / 360) * 12;
        const w = h * camera.aspect * 1.1;
        const step = w / n;
        const lean = (p.mouse ?? 1) * pointer.hover;
        const wx = (pointer.x - 0.5) * (h * camera.aspect);
        const rr = 2.2 * (p.reach ?? 1);
        seeds.forEach((s, i) => {
          const x = -w / 2 + (s.k + 0.5 + (s.layer ? 0.5 : 0)) * step;
          const dx = x - wx;
          const near = Math.exp(-(dx * dx) / (rr * rr)) * lean;
          const sway = Math.sin(t * 0.5 + s.k * 0.31 + s.layer * 1.9) * 0.38 + Math.sin(t * 0.23 + s.k * 0.09) * 0.25;
          const face = Math.max(-1.1, Math.min(1.1, -dx * 0.6)) * near;
          dummy.position.set(x, 0, (s.layer ? -0.9 * p.depth : 0) + near * 1.7 * p.depth);
          dummy.rotation.set(0, sway + face, 0);
          dummy.scale.set(1 + near * 0.6, 1, 1 + near * 0.4);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          const isAcc = ((s.k * 5 + s.layer * 2) % 17) === 3;
          mesh.setColorAt(i, isAcc ? acc : base);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
      dispose() { env.dispose(); geo.dispose(); },
    };
  }, []);
  propsRef.current = { tint, accent, background, count, roughness, depth, speed, mouse, reach };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default ChromeSlats;
