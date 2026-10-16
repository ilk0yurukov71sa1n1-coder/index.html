import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Free, in-house dotted globe with animated request arcs.
// Replaces the React Bits Pro Globe. Props: `nodes` [{lat, lon}], `arcs` [[fromIndex, toIndex]].
const toVec = (lat, lon, r) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

export default function EdgeGlobe({ nodes, arcs, dotColor = '#d8cfdb', accent = '#e0245e', className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    const globe = new THREE.Group();
    globe.rotation.x = 0.35;
    scene.add(globe);

    // Dots: fibonacci sphere.
    const R = 1.6;
    const COUNT = 2600;
    const pos = new Float32Array(COUNT * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i += 1) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const t = golden * i;
      pos.set([Math.cos(t) * rad * R, y * R, Math.sin(t) * rad * R], i * 3);
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dotMat = new THREE.PointsMaterial({ color: dotColor, size: 0.02, transparent: true, opacity: 0.8 });
    globe.add(new THREE.Points(dotGeo, dotMat));

    // Dark core so back-facing dots fade.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 48, 48),
      new THREE.MeshBasicMaterial({ color: '#0a090c', transparent: true, opacity: 0.8 })
    );
    globe.add(core);

    // Edge nodes.
    const accentColor = new THREE.Color(accent);
    const nodeGeo = new THREE.SphereGeometry(0.028, 12, 12);
    const nodeMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const ringMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const rings = [];
    nodes.forEach((n) => {
      const p = toVec(n.lat, n.lon, R * 1.002);
      const m = new THREE.Mesh(nodeGeo, nodeMat);
      m.position.copy(p);
      globe.add(m);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.038, 32), ringMat.clone());
      ring.position.copy(p);
      ring.lookAt(p.clone().multiplyScalar(2));
      ring.userData.phase = Math.random();
      globe.add(ring);
      rings.push(ring);
    });

    // Arcs.
    const SEG = 64;
    const arcLines = arcs.map(([a, b], i) => {
      const s = toVec(nodes[a].lat, nodes[a].lon, R);
      const e = toVec(nodes[b].lat, nodes[b].lon, R);
      const mid = s.clone().add(e).multiplyScalar(0.5);
      mid.setLength(R + s.distanceTo(e) * 0.45);
      const curve = new THREE.QuadraticBezierCurve3(s, mid, e);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(SEG));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.85 }));
      line.userData = { offset: i * 0.37, speed: 0.22 + (i % 3) * 0.05 };
      globe.add(line);
      return line;
    });

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Drag to spin.
    let dragging = false;
    let lastX = 0;
    let velocity = 0;
    const down = (e) => {
      dragging = true;
      lastX = e.clientX;
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      globe.rotation.y += dx * 0.006;
      velocity = dx * 0.006;
    };
    const up = () => {
      dragging = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    });
    io.observe(el);

    let raf = 0;
    let last = performance.now();
    let t = 0;
    const tick = (now) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (!dragging) {
        globe.rotation.y += reduce ? 0 : dt * 0.12 + velocity;
        velocity *= 0.92;
      }
      arcLines.forEach((line) => {
        const p = ((t * line.userData.speed + line.userData.offset) % 1.4) / 1.4;
        const head = Math.min(1, p * 1.6);
        const tail = Math.max(0, p * 1.6 - 0.6);
        const start = Math.floor(tail * SEG);
        line.geometry.setDrawRange(start, Math.max(2, Math.floor(head * SEG) - start + 1));
      });
      rings.forEach((r) => {
        const k = (t * 0.6 + r.userData.phase) % 1;
        r.scale.setScalar(1 + k * 1.6);
        r.material.opacity = 0.55 * (1 - k);
      });
      renderer.render(scene, camera);
      if (visible) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      scene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [nodes, arcs, dotColor, accent]);

  return <div ref={ref} className={className} style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'pan-y' }} />;
}
