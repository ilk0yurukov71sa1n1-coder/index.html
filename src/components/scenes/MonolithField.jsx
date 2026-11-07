import { useScene, toColor, studioEnv } from './useScene';

// A field of square chrome columns seen from above and the side. A slow swell moves through them; the cursor lifts a tower under it that falls away smoothly, and the columns it lifts warm to oxblood.
const MonolithField = ({ tint = '#cfcac4', accent = '#8a2226', background = '#0b0a0a', height = 1, roughness = 0.14, speed = 1, mouse = 1, reach = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    const env = studioEnv(THREE, renderer);
    scene.environment = env;
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.95, roughness: 0.2 });
    const key = new THREE.DirectionalLight('#fff1e0', 1.7); key.position.set(-8, -6, 14); scene.add(key);
    const rim = new THREE.DirectionalLight('#8a2226', 1.2); rim.position.set(10, 6, 4); scene.add(rim);
    scene.add(new THREE.AmbientLight('#ffffff', 0.06));
    const geo = new THREE.BoxGeometry(0.78, 0.78, 1);
    geo.translate(0, 0, 0.5);
    const N = 40; const M = 22;
    const mesh = new THREE.InstancedMesh(geo, mat, N * M);
    scene.add(mesh);
    camera.fov = 32;
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
        const base = toColor(THREE, p.tint, '#cfcac4');
        const acc = toColor(THREE, p.accent, '#8a2226');
        const lean = (p.mouse ?? 1) * pointer.hover;
        camera.position.set((pointer.x - 0.5) * 8 * (p.mouse ?? 1), -12 + (pointer.y - 0.5) * 5 * (p.mouse ?? 1), 40);
        camera.lookAt(0, 0, 0.5);
        camera.updateMatrixWorld();
        ray.setFromCamera(new THREE.Vector2(pointer.x * 2 - 1, pointer.y * 2 - 1), camera);
        let mx = 99; let my = 99;
        if (ray.ray.intersectPlane(plane, hit)) { mx = hit.x; my = hit.y; }
        const rr = 3.6 * (p.reach ?? 1);
        let i = 0;
        for (let r = 0; r < M; r++) {
          for (let c = 0; c < N; c++) {
            const x = (c - N / 2 + 0.5) * 1; const y = (r - M / 2 + 0.5) * 1;
            const sw = 0.5 + 0.5 * Math.sin(x * 0.5 + t * 0.7) * Math.cos(y * 0.6 - t * 0.5);
            const g = Math.exp(-((x - mx) ** 2 + (y - my) ** 2) / (rr * rr)) * lean;
            const h = (0.25 + sw * 0.9 + g * 3.2) * p.height;
            dummy.position.set(x, y, 0);
            dummy.scale.set(1, 1, Math.max(0.05, h));
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            col.copy(base).lerp(acc, Math.min(1, g * 1.2));
            mesh.setColorAt(i, col);
            i++;
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
      dispose() { env.dispose(); geo.dispose(); },
    };
  }, []);
  propsRef.current = { tint, accent, background, height, roughness, speed, mouse, reach };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default MonolithField;
