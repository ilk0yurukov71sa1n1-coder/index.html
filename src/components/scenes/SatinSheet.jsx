import { useScene, toColor, studioEnv } from './useScene';

// One large sheet of satin metal, lit from the side. It drifts in slow folds; the cursor presses a soft dent into it and the sheet tilts toward the pointer so the reflections travel across it.
const SatinSheet = ({ tint = '#a8a29a', accent = '#8a2226', background = '#0b0a0a', fold = 1, roughness = 0.28, speed = 1, mouse = 1, reach = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.7;
    const env = studioEnv(THREE, renderer);
    scene.environment = env;
    const geo = new THREE.PlaneGeometry(30, 18, 150, 90);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.28 });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    camera.fov = 36;
    camera.position.set(0, -9, 21);
    const pos = geo.attributes.position;
    const base = pos.array.slice();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    return {
      update(t) {
        const p = props.current;
        mat.roughness = p.roughness;
        mat.color.copy(toColor(THREE, p.tint, '#a8a29a'));
        renderer.setClearColor(toColor(THREE, p.background, '#0b0a0a'), 1);
        const lean = (p.mouse ?? 1) * pointer.hover;
        mesh.rotation.x = (pointer.y - 0.5) * -0.35 * (p.mouse ?? 1);
        mesh.rotation.z = (pointer.x - 0.5) * 0.3 * (p.mouse ?? 1);
        camera.lookAt(0, 0, 0);
        mesh.updateMatrixWorld(); camera.updateMatrixWorld();
        ray.setFromCamera(new THREE.Vector2(pointer.x * 2 - 1, pointer.y * 2 - 1), camera);
        let mx = 99; let my = 99;
        if (ray.ray.intersectPlane(plane, hit)) { mx = hit.x; my = hit.y; }
        const rr = 3.2 * (p.reach ?? 1);
        const a = pos.array; const b = base;
        for (let i = 0; i < pos.count; i++) {
          const x = b[i * 3]; const y = b[i * 3 + 1];
          let z = (Math.sin(x * 0.45 + t * 0.4) * 0.6 + Math.sin(y * 0.7 - t * 0.3 + x * 0.12) * 0.4 + Math.sin((x - y) * 0.28 + t * 0.2) * 0.6) * p.fold;
          z -= 2.2 * Math.exp(-((x - mx) ** 2 + (y - my) ** 2) / (rr * rr)) * lean;
          a[i * 3 + 2] = z;
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      },
      dispose() { env.dispose(); },
    };
  }, []);
  propsRef.current = { tint, accent, background, fold, roughness, speed, mouse, reach };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default SatinSheet;
