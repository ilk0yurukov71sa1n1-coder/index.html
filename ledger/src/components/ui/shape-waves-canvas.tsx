"use client";

import * as React from "react";

/* Canvas 2D twin of ShapeWaves for browsers or frames without WebGPU.
   Same noise (a port of the component's WGSL Perlin + fbm), same bands,
   same shapes, grid, edge fade and cursor splash ripples (the same wave
   simulation), so the field looks and reacts the same. No bloom pass. */

const NOISE_CELLS = 32;
const TIME_RATE = 0.1;
const SEED = [12.9898, 78.233];
const MAX_DPR = 1.5;
const FPS = 30;
const SIM_STEP = 1 / 60;
const WAVE_SPEED = 0.42, WAVE_FRICTION = 0.94, WAVE_DECAY = 0.972, SETTLED = 0.01;

const mod289 = (x: number) => x - Math.floor(x * (1 / 289)) * 289;
const permute = (x: number) => mod289((x * 34 + 10) * x);
const fract = (x: number) => x - Math.floor(x);
const fadeC = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function grad(h: number): [number, number, number] {
  let gx = h * (1 / 7);
  let gy = fract(Math.floor(gx) * (1 / 7)) - 0.5;
  gx = fract(gx);
  const gz = 0.5 - Math.abs(gx) - Math.abs(gy);
  const sz = gz <= 0 ? 1 : 0;
  gx -= sz * ((gx >= 0 ? 1 : 0) - 0.5);
  gy -= sz * ((gy >= 0 ? 1 : 0) - 0.5);
  const n = 1.79284291400159 - 0.85373472095314 * (gx * gx + gy * gy + gz * gz);
  return [gx * n, gy * n, gz * n];
}

function cnoise(x: number, y: number, z: number) {
  const X0 = Math.floor(x), Y0 = Math.floor(y), Z0 = Math.floor(z);
  const fx = x - X0, fy = y - Y0, fz = z - Z0;
  const x0 = mod289(X0), x1 = mod289(X0 + 1), y0 = mod289(Y0), y1 = mod289(Y0 + 1), z0 = mod289(Z0), z1 = mod289(Z0 + 1);
  const h = (ix: number, iy: number, iz: number) => permute(permute(permute(ix) + iy) + iz);
  const d = (g: [number, number, number], a: number, b: number, c: number) => g[0] * a + g[1] * b + g[2] * c;
  const n000 = d(grad(h(x0, y0, z0)), fx, fy, fz);
  const n100 = d(grad(h(x1, y0, z0)), fx - 1, fy, fz);
  const n010 = d(grad(h(x0, y1, z0)), fx, fy - 1, fz);
  const n110 = d(grad(h(x1, y1, z0)), fx - 1, fy - 1, fz);
  const n001 = d(grad(h(x0, y0, z1)), fx, fy, fz - 1);
  const n101 = d(grad(h(x1, y0, z1)), fx - 1, fy, fz - 1);
  const n011 = d(grad(h(x0, y1, z1)), fx, fy - 1, fz - 1);
  const n111 = d(grad(h(x1, y1, z1)), fx - 1, fy - 1, fz - 1);
  const u = fadeC(fx), v = fadeC(fy), w = fadeC(fz);
  const nx00 = mix(n000, n001, w), nx10 = mix(n100, n101, w), nx01 = mix(n010, n011, w), nx11 = mix(n110, n111, w);
  return 2.2 * mix(mix(nx00, nx10, u), mix(nx01, nx11, u), v);
}
const fbm = (x: number, y: number, z: number) => (cnoise(x, y, z) + 0.5 * cnoise(x * 2, y * 2, z * 2)) / 1.5;

const hex = (c: string) => {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(c.trim());
  let s = m ? m[1] : "929292";
  if (s.length === 3) s = s.replace(/./g, (ch) => ch + ch);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

export type ShapeWavesCanvasProps = {
  text?: string; fontFamily?: string; fontWeight?: number | string; textSize?: number;
  cellSize?: number; dotSize?: number; color?: string; hoverColor?: string; backgroundColor?: string;
  interactive?: boolean; splashRadius?: number; splashStrength?: number;
  speed?: number; scale?: number; contrast?: number; brightness?: number; fade?: number; className?: string;
};

export default function ShapeWavesCanvas({
  text = "", fontFamily = 'Geist, "Geist Sans", system-ui, sans-serif', fontWeight = 500, textSize = 0.6,
  cellSize = 10, dotSize = 0.75, color = "#929292", hoverColor = "#ffffff", backgroundColor = "#000000",
  interactive = true, splashRadius = 40, splashStrength = 0.4,
  speed = 1, scale = 1, contrast = 1, brightness = 0.4, fade = 0.25, className = "",
}: ShapeWavesCanvasProps) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const [fr, fg, fb] = hex(color), [hr, hg, hb] = hex(hoverColor), [br, bgc, bb] = hex(backgroundColor);
    let heights = new Float32Array(1), prevH = new Float32Array(1), charges = new Float32Array(1);
    let active = false, backlog = 0;
    const pointer = { x: 0, y: 0, at: 0, inside: false };
    let W = 0, H = 0, dpr = 1, cellPx = 10, cols = 0, rows = 0, ox = 0, oy = 0;
    let mask: Uint8Array | null = null;
    let raf = 0, last = 0, time = 0, drawn = 0;

    const buildMask = () => {
      mask = null;
      if (!text.trim()) return;
      const m = document.createElement("canvas");
      m.width = cols; m.height = rows;
      const mc = m.getContext("2d");
      if (!mc) return;
      let size = rows * textSize;
      mc.font = `${fontWeight} ${size}px ${fontFamily}`;
      const w = mc.measureText(text).width;
      if (w > cols * 0.9) { size *= (cols * 0.9) / w; mc.font = `${fontWeight} ${size}px ${fontFamily}`; }
      mc.fillStyle = "#fff"; mc.textAlign = "center"; mc.textBaseline = "middle";
      mc.fillText(text, cols / 2, rows / 2);
      const px = mc.getImageData(0, 0, cols, rows).data;
      mask = new Uint8Array(cols * rows);
      for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] > 127 ? 1 : 0;
    };

    const resize = () => {
      dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(cv.clientWidth * dpr)); H = Math.max(1, Math.round(cv.clientHeight * dpr));
      cv.width = W; cv.height = H;
      cellPx = Math.max(2, cellSize) * dpr;
      cols = Math.ceil(W / cellPx); rows = Math.ceil(H / cellPx);
      ox = (W - cols * cellPx) / 2; oy = (H - rows * cellPx) / 2;
      heights = new Float32Array(cols * rows); prevH = new Float32Array(cols * rows); charges = new Float32Array(cols * rows); active = false;
      buildMask();
      draw();
    };

    const splash = (x: number, y: number, strength: number) => {
      const sigma = Math.max(0.5, ((splashRadius * dpr) / cellPx) * 0.5), reach = Math.ceil(sigma * 2.5);
      const cc = (x * dpr - ox) / cellPx - 0.5, cr = (y * dpr - oy) / cellPx - 0.5;
      for (let r = Math.max(0, Math.floor(cr - reach)); r <= Math.min(rows - 1, Math.ceil(cr + reach)); r++)
        for (let c = Math.max(0, Math.floor(cc - reach)); c <= Math.min(cols - 1, Math.ceil(cc + reach)); c++) {
          const dx = c - cc, dy = r - cr, i = r * cols + c;
          heights[i] = Math.min(1.2, heights[i] + strength * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
        }
      active = true;
    };
    const step = () => {
      let peak = 0;
      for (let r = 0; r < rows; r++) {
        const up = (r === 0 ? r : r - 1) * cols, down = (r === rows - 1 ? r : r + 1) * cols, base = r * cols;
        for (let c = 0; c < cols; c++) {
          const i = base + c, h = heights[i];
          const lap = heights[base + (c === 0 ? c : c - 1)] + heights[base + (c === cols - 1 ? c : c + 1)] + heights[up + c] + heights[down + c] - 4 * h;
          const next = (h + (h - prevH[i]) * WAVE_FRICTION + WAVE_SPEED * lap) * WAVE_DECAY;
          prevH[i] = next;
          const ch = Math.min(1, Math.max(0, next));
          charges[i] = ch;
          if (ch > peak) peak = ch;
        }
      }
      const t = heights; heights = prevH; prevH = t;
      if (peak < SETTLED) { heights.fill(0); prevH.fill(0); charges.fill(0); active = false; }
    };
    const onMove = (e: PointerEvent) => {
      if (!interactive) return;
      const b = cv.getBoundingClientRect(), now = performance.now();
      const x = e.clientX - b.left, y = e.clientY - b.top;
      const inside = x >= 0 && y >= 0 && x <= b.width && y <= b.height;
      if (inside) {
        const elapsed = pointer.inside ? Math.max(8, now - pointer.at) : 16;
        const travelled = pointer.inside ? Math.hypot(x - pointer.x, y - pointer.y) : 0;
        splash(x, y, Math.min(1, 0.22 + (travelled / elapsed) * 1000 * 0.0006) * splashStrength);
      }
      Object.assign(pointer, { x, y, at: now, inside });
    };

    const draw = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, W, H);
      const fieldX = NOISE_CELLS * cellPx * scale;
      const fieldY = 0.5 - (brightness - 0.5) * 0.4, fieldZ = 2.8 * contrast;
      const half = cellPx / 2;
      const buckets: Map<number, Path2D> = new Map();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (mask && mask[r * cols + c]) continue;
          const cx = ox + (c + 0.5) * cellPx, cy = oy + (r + 0.5) * cellPx;
          let level = 1;
          if (fade > 0) {
            const qx = Math.abs((cx / W) * 2 - 1), qy = Math.abs((cy / H) * 2 - 1);
            const rad = Math.pow(Math.pow(qx, 2.5) + Math.pow(qy, 2.5), 1 / 2.5) / Math.pow(2, 1 / 2.5);
            level = 1 - smoothstep(Math.max(0, 1 - fade * 2.2), 1, rad);
            if (level <= 0.01) continue;
          }
          const n = fbm(cx / fieldX + SEED[0], cy / fieldX + SEED[1], time);
          const tone = Math.min(1, Math.max(0, (n * 0.5 + 0.5 - fieldY) * fieldZ + 0.5));
          const band = Math.floor(Math.min(tone, 0.999999) * 3); // 0 dark, 1 mid, 2 bright
          const ch = charges[r * cols + c] || 0;
          const stepped = (band + Math.floor(Math.min(0.999, ch) * 3)) % 3;
          const shape = 2 - stepped; // 0 square, 1 circle, 2 triangle
          const tint = Math.round(smoothstep(0.15, 0.85, ch) * 10);
          const s = dotSize * half;
          const key = (Math.round(level * 20) * 11 + tint) * 4 + shape;
          let p = buckets.get(key);
          if (!p) { p = new Path2D(); buckets.set(key, p); }
          if (shape === 0) p.rect(cx - s, cy - s, 2 * s, 2 * s);
          else if (shape === 1) { p.moveTo(cx + s, cy); p.arc(cx, cy, s, 0, Math.PI * 2); }
          else { p.moveTo(cx, cy - s); p.lineTo(cx + s, cy + s); p.lineTo(cx - s, cy + s); p.closePath(); }
        }
      }
      for (const [key, p] of buckets) {
        const k = Math.floor(key / 4), l = Math.floor(k / 11) / 20, t = (k % 11) / 10;
        const tr = mix(fr, hr, t), tg = mix(fg, hg, t), tb = mix(fb, hb, t);
        ctx.fillStyle = `rgb(${Math.round(mix(br, tr, l))},${Math.round(mix(bgc, tg, l))},${Math.round(mix(bb, tb, l))})`;
        ctx.fill(p);
      }
      drawn++;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) { last = now; return; }
      if (!active && now - last < 1000 / FPS) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (!reduce.matches) time += dt * TIME_RATE * speed;
      if (active) { backlog = Math.min(backlog + dt, SIM_STEP * 4); while (backlog >= SIM_STEP && active) { backlog -= SIM_STEP; step(); } }
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove, { passive: true });
    (cv as HTMLCanvasElement & { __frames?: () => number; __charge?: () => number }).__frames = () => drawn;
    (cv as HTMLCanvasElement & { __charge?: () => number }).__charge = () => { let m = 0; for (const v of charges) if (v > m) m = v; return active ? m : -1; };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("pointermove", onMove); };
  }, [text, fontFamily, fontWeight, textSize, cellSize, dotSize, color, hoverColor, backgroundColor, interactive, splashRadius, splashStrength, speed, scale, contrast, brightness, fade]);

  return <canvas ref={ref} className={className} style={{ display: "block", width: "100%", height: "100%", background: backgroundColor }} aria-hidden="true" />;
}
