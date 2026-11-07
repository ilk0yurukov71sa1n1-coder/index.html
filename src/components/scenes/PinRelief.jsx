import { useScene, toColor, studioEnv } from './useScene';

// A bed of chrome pins seen at an angle, like a pin-art relief. A slow wave rolls under them; the cursor presses a dent in and sends one ring outward, and the pins it touches warm to oxblood.
const PinRelief = ({ tint = '#cfcac4', accent = '#8a2226', background = '#0b0a0a', density = 1, relief = 1, roughness = 0.12, speed = 1, mouse = 1, reach = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    const env = studioEnv(THREE, renderer);
    scene.environment = env;
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.12 });
    const geo = new THREE.CapsuleGeometry(0.085, 1.4, 6, 16);
    geo.rotateX(Math.PI / 2);
    camera.fov = 34;
    camera.position.set(0, -9, 13);
    camera.lookAt(0, 1.2, 0);
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    let mesh = null;
    let key = '';
    let pins = [];
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const build = (d) => {
      if (mesh) { scene.remove(mesh); mesh.dispose(); }
      const s = 0.3 / d;
      const cols = Math.round(78 * d);
      const rows = Math.round(46 * d);
      mesh = new THREE.InstancedMesh(geo, mat, cols * rows);
      pins = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          pins.push({ x: (c - cols / 2 + (r % 2 ? 0.5 : 0)) * s, y: (r - rows / 2) * s * 0.866 + 2 });
        }
      }
      scene.add(mesh);
    };
    return {
      update(t) {
        const p = props.current;
        const k = `${p.density}`;
        if (k !== key) { key = k; build(p.density); }
        mat.roughness = p.roughness;
        renderer.setClearColor(toColor(THREE, p.background, '#0b0a0a'), 1);
        const base = toColor(THREE, p.tint, '#cfcac4');
        const acc = toColor(THREE, p.accent, '#8a2226');
        const lean = (p.mouse ?? 1) * pointer.hover;
        camera.updateMatrixWorld();
        ray.setFromCamera(new THREE.Vector2(pointer.x * 2 - 1, pointer.y * 2 - 1), camera);
        let mx = 0; let my = 0;
        if (ray.ray.intersectPlane(plane, hit)) { mx = hit.x; my = hit.y; }
        const rr = 2.6 * (p.reach ?? 1);
        const tt = t * 0.6;
        pins.forEach((pin, i) => {
          const { x, y } = pin;
          let h = 0.34 * Math.sin(x * 0.42 + tt) + 0.3 * Math.sin(y * 0.55 - tt * 0.8) + 0.22 * Math.sin((x + y) * 0.3 + tt * 0.5);
          h *= p.relief;
          const dx = x - mx; const dy = y - my;
          const d2 = dx * dx + dy * dy;
          const g = Math.exp(-d2 / (rr * rr)) * lean;
          const ring = Math.sin(Math.sqrt(d2) * 3.2 - t * 3.4) * Math.exp(-d2 / (rr * rr * 3.2)) * lean;
          h += (-1.25 * g + 0.22 * ring) * p.relief;
          dummy.position.set(x, y, h);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          col.copy(base).lerp(acc, Math.min(1, g * 1.15));
          mesh.setColorAt(i, col);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
      dispose() { env.dispose(); geo.dispose(); },
    };
  }, []);
  propsRef.current = { tint, accent, background, density, relief, roughness, speed, mouse, reach };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default PinRelief;
