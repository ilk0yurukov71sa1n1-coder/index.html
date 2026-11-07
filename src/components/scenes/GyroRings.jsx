import { useScene, toColor } from './useScene';

const GyroRings = ({ lineColor = '#d8d2c8', accent = '#7d1d20', background = '#0d0c0b', rings = 7, speed = 1, size = 1, tilt = 0.5, opacity = 0.85, mouse = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    const group = new THREE.Group();
    scene.add(group);
    const made = [];
    let count = -1;
    const build = (n) => {
      made.forEach((m) => { group.remove(m.line); m.line.geometry.dispose(); m.line.material.dispose(); });
      made.length = 0;
      for (let i = 0; i < n; i++) {
        const r = 0.6 + (i / Math.max(n - 1, 1)) * 1.9;
        const pts = [];
        for (let k = 0; k <= 256; k++) { const a = (k / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false });
        const line = new THREE.Line(geo, mat);
        const seed = i * 1.713;
        made.push({ line, mat, seed, r, i });
        group.add(line);
      }
    };
    camera.position.set(0, 0, 8);
    return {
      update(t) {
        const p = props.current;
        if (count !== p.rings) { count = p.rings; build(count); }
        renderer.setClearColor(toColor(THREE, p.background, '#0d0c0b'), 1);
        const base = toColor(THREE, p.lineColor, '#d8d2c8');
        const acc = toColor(THREE, p.accent, '#7d1d20');
        group.scale.setScalar(p.size);
        const lean = (p.mouse ?? 1) * pointer.hover;
        group.position.x = (pointer.x - 0.5) * 0.9 * lean;
        group.position.y = (pointer.y - 0.5) * 0.6 * lean;
        made.forEach((m) => {
          const depth = 0.4 + m.i * 0.22; // outer rings follow the pointer more, so the set fans open
          m.line.rotation.x = Math.sin(t * 0.21 + m.seed) * p.tilt * 2 + m.seed * 0.4 - (pointer.y - 0.5) * depth * 1.4 * lean;
          m.line.rotation.y = Math.cos(t * 0.17 + m.seed * 1.3) * p.tilt * 2 + (pointer.x - 0.5) * depth * 1.4 * lean;
          m.line.rotation.z = t * 0.05 * (m.i % 2 ? 1 : -1);
          m.mat.color.copy(m.i === 2 ? acc : base);
          m.mat.opacity = p.opacity * (m.i === 2 ? 1 : 0.55 + 0.35 * Math.sin(m.seed));
        });
      },
    };
  }, []);
  propsRef.current = { lineColor, accent, background, rings, speed, size, tilt, opacity, mouse };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default GyroRings;
