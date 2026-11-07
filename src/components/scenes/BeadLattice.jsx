import { useScene, toColor, studioEnv } from './useScene';

// Three layers of chrome beads at different depths. The cursor pushes the near layer apart like a hand through water, the beads swell as it passes, and the camera shifts so the layers slide against each other.
const BeadLattice = ({ tint = '#d6d0c8', accent = '#8a2226', background = '#0b0a0a', size = 1, roughness = 0.1, speed = 1, mouse = 1, reach = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    const env = studioEnv(THREE, renderer);
    scene.environment = env;
    const geo = new THREE.SphereGeometry(0.3, 24, 16);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.1 });
    const L = [0, 1, 2]; const C = 22; const R = 12;
    const mesh = new THREE.InstancedMesh(geo, mat, L.length * C * R);
    scene.add(mesh);
    camera.fov = 40;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    return {
      update(t) {
        const p = props.current;
        mat.roughness = p.roughness;
        renderer.setClearColor(toColor(THREE, p.background, '#0b0a0a'), 1);
        const base = toColor(THREE, p.tint, '#d6d0c8');
        const acc = toColor(THREE, p.accent, '#8a2226');
        const lean = (p.mouse ?? 1) * pointer.hover;
        camera.position.set((pointer.x - 0.5) * 6 * (p.mouse ?? 1), (pointer.y - 0.5) * 4 * (p.mouse ?? 1), 16);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        ray.setFromCamera(new THREE.Vector2(pointer.x * 2 - 1, pointer.y * 2 - 1), camera);
        let mx = 99; let my = 99;
        if (ray.ray.intersectPlane(plane, hit)) { mx = hit.x; my = hit.y; }
        const rr = 3.4 * (p.reach ?? 1);
        let i = 0;
        for (const l of L) {
          const z = -l * 3.2;
          for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
              let x = (c - C / 2 + 0.5 + (r % 2 ? 0.5 : 0) + l * 0.33) * 1.5; let y = (r - R / 2 + 0.5) * 1.3;
              x += Math.sin(t * 0.5 + y * 0.7 + l) * 0.18; y += Math.cos(t * 0.45 + x * 0.6 + l) * 0.18;
              const dx = x - mx; const dy = y - my;
              const d = Math.sqrt(dx * dx + dy * dy) + 1e-3;
              const g = Math.exp(-(d * d) / (rr * rr)) * lean * (l === 0 ? 1 : 0.5);
              x += (dx / d) * g * 1.6; y += (dy / d) * g * 1.6;
              dummy.position.set(x, y, z + g * 1.4);
              dummy.scale.setScalar((0.8 + g * 1.1) * p.size * (1 - l * 0.12));
              dummy.updateMatrix();
              mesh.setMatrixAt(i, dummy.matrix);
              col.copy(base).lerp(acc, Math.min(1, g * 1.3));
              mesh.setColorAt(i, col);
              i++;
            }
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
      dispose() { env.dispose(); geo.dispose(); },
    };
  }, []);
  propsRef.current = { tint, accent, background, size, roughness, speed, mouse, reach };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default BeadLattice;
