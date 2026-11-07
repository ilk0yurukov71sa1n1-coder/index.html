import { useScene, toColor, studioEnv } from './useScene';

// A tunnel of thin chrome rings receding into the dark. The camera swings with the cursor so the rings slide past each other, and the nearest ring turns to oxblood as the pointer pulls it toward the centre.
const RingTunnel = ({ tint = '#d6d0c8', accent = '#8a2226', background = '#0b0a0a', rings = 22, roughness = 0.12, speed = 1, mouse = 1, reach = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    const env = studioEnv(THREE, renderer);
    scene.environment = env;
    const geo = new THREE.TorusGeometry(4.2, 0.07, 14, 120);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.12 });
    const hot = new THREE.MeshStandardMaterial({ color: '#8a2226', metalness: 0.6, roughness: 0.25, emissive: '#3a0a0c' });
    const group = new THREE.Group();
    scene.add(group);
    camera.fov = 50;
    let list = []; let key = 0;
    const build = (n) => {
      list.forEach((m) => group.remove(m)); list = [];
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, i % 7 === 3 ? hot : mat); group.add(m); list.push(m); }
    };
    return {
      update(t) {
        const p = props.current;
        if (p.rings !== key) { key = p.rings; build(p.rings); }
        mat.roughness = p.roughness;
        mat.color.copy(toColor(THREE, p.tint, '#d6d0c8'));
        renderer.setClearColor(toColor(THREE, p.background, '#0b0a0a'), 1);
        const lean = p.mouse ?? 1;
        const cx = (pointer.x - 0.5) * 5 * lean; const cy = (pointer.y - 0.5) * 3.2 * lean;
        camera.position.set(cx, cy, 6);
        camera.lookAt(-cx * 0.4, -cy * 0.4, -20);
        const n = list.length; const spacing = 2.4;
        list.forEach((m, i) => {
          const zz = -((i * spacing + t * 1.4) % (n * spacing)) + 4;
          m.position.set(Math.sin(zz * 0.12 + t * 0.3) * 0.6, Math.cos(zz * 0.1) * 0.4, zz);
          m.rotation.z = zz * 0.08 + t * 0.15 + (pointer.x - 0.5) * 0.8 * lean * pointer.hover;
          m.scale.setScalar(1 + 0.12 * Math.sin(zz * 0.3 + t));
        });
      },
      dispose() { env.dispose(); geo.dispose(); hot.dispose(); },
    };
  }, []);
  propsRef.current = { tint, accent, background, rings, roughness, speed, mouse, reach };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default RingTunnel;
