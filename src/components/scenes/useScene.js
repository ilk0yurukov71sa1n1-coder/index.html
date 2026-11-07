import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Shared base for the calm 3D backgrounds: one canvas that fills its box, pauses when off screen or when the tab is hidden,
// stands still for visitors who ask for reduced motion, and cleans up after itself. No pointer input on purpose.
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

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    const api = build({ THREE, renderer, scene, camera, props: propsRef, reduce });

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
      api.update(time, dt);
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
      api.dispose?.();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose?.());
      });
      renderer.dispose();
      renderer.domElement.remove();
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
