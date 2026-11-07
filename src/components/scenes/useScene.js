import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Shared base for the calm 3D backgrounds: one canvas that fills its box, pauses when off screen or when the tab is hidden,
// stands still for visitors who ask for reduced motion, and cleans up after itself.
// Pointer: `pointer` is shared with every scene. x/y are 0..1 inside the box (y up), already smoothed; vx/vy is how fast it moves; hover eases 0..1 while the pointer is over the box.
export function useScene(build, deps = []) {
  const hostRef = useRef(null);
  const propsRef = useRef({});
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);
    // finish layer: fine film grain (removes colour banding, reads as printed) and a soft edge falloff
    const finish = document.createElement('div');
    finish.setAttribute('aria-hidden', 'true');
    const grain = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 1.4 -.2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
    finish.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,.38) 100%), ${grain};background-size:100% 100%, 180px 180px;mix-blend-mode:soft-light;opacity:.9`;
    host.appendChild(finish);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, vx: 0, vy: 0, hover: 0, inside: false };
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      const x = (e.clientX - r.left) / Math.max(1, r.width);
      const y = 1 - (e.clientY - r.top) / Math.max(1, r.height);
      pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      if (pointer.inside) { pointer.tx = x; pointer.ty = y; }
    };
    const onLeave = () => { pointer.inside = false; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    const api = build({ THREE, renderer, scene, camera, props: propsRef, reduce, pointer });

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      api.resize?.(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let raf = 0;
    let visible = true;
    let last = performance.now();
    let time = 0;
    const frame = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) time += dt * (propsRef.current.speed ?? 1);
      const k = 1 - Math.exp(-dt * 7);
      const px = pointer.x; const py = pointer.y;
      pointer.x += (pointer.tx - pointer.x) * k;
      pointer.y += (pointer.ty - pointer.y) * k;
      pointer.vx += ((pointer.x - px) / Math.max(dt, 1e-3) * 0.12 - pointer.vx) * k;
      pointer.vy += ((pointer.y - py) / Math.max(dt, 1e-3) * 0.12 - pointer.vy) * k;
      pointer.hover += ((pointer.inside ? 1 : 0) - pointer.hover) * (1 - Math.exp(-dt * 3.5));
      api.update(time, dt, pointer);
      renderer.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) wake();
    });
    io.observe(host);
    document.addEventListener('visibilitychange', wake);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      api.dispose?.();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose?.());
      });
      renderer.dispose();
      renderer.domElement.remove();
      finish.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { hostRef, propsRef };
}

export const toColor = (THREE, value, fallback) => {
  try {
    return new THREE.Color(value);
  } catch {
    return new THREE.Color(fallback);
  }
};

// For hand-written shaders, which write colours straight to the screen: three stores colours in linear light, so convert back.
export const rawColor = (THREE, value, fallback) => toColor(THREE, value, fallback).convertLinearToSRGB();

// A small photo-studio lighting rig for chrome: a dark room with two tall strip lights, a soft top light and one low warm strip.
// Chrome only shows what it reflects, so shaping this rig is what makes metal look expensive rather than flat white.
export const studioEnv = (THREE, renderer, warm = '#8a2226') => {
  const room = new THREE.Scene();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: '#070606', side: THREE.BackSide }));
  room.add(shell);
  const panel = (w, h, pos, color, level) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(level), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(1.2, 22, [-14, 2, 6], '#fff4e6', 7);
  panel(0.8, 22, [15, 1, 3], '#e8f0ff', 5);
  panel(18, 6, [0, 20, 4], '#ffffff', 2.2);
  panel(26, 1.4, [0, -9, 12], new THREE.Color(warm), 5);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(room, 0.02);
  pmrem.dispose();
  room.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  return rt.texture;
};
