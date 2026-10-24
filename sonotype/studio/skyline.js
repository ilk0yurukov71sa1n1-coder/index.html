// Contribution Skyline (21st.dev), ported to vanilla JS for this page and
// driven by scroll: the flat year of work rises into a 3D skyline as the
// visitor scrolls through the section, then the camera swings slowly past it.
// The data is real: studio/activity.json, written by scripts/activity.mjs
// from this repository's git history. Nothing is generated or sampled.
import {
  DAY_MS, buildGrid, computeStats, monthLabels, barHeight, riseAt, camera, project,
  easeInOutCubic, smoothstep, lerp, dayMs, mixRGB,
} from './skyline-core.js';
import ACTIVITY from './activity.json';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// The page's own palette: ink on stone, levels rising to the logo's oxblood.
const BG = hex('#e8e8e5');
const FG = hex('#1d1416');
const LEVELS = ['#e2c4c3', '#c27e7d', '#9b3b3d', '#7d1d20'].map(hex);

const WORDS = {
  en: {
    commits: (n) => (n === 1 ? 'change' : 'changes'), none: 'No changes', on: 'on',
    total: 'Changes committed', active: 'Days of work', busiest: 'Busiest day', since: 'Since',
    days: (n) => (n === 1 ? 'day' : 'days'), locale: 'en-GB', updated: 'Updated',
  },
  bg: {
    commits: (n) => (n === 1 ? 'промяна' : 'промени'), none: 'Няма промени', on: 'на',
    total: 'Направени промени', active: 'Работни дни', busiest: 'Най-силен ден', since: 'От',
    days: (n) => (n === 1 ? 'ден' : 'дни'), locale: 'bg-BG', updated: 'Обновено',
  },
};

export default function skyline(root) {
  const track = root.querySelector('.skyline__track');
  const stage = root.querySelector('.skyline__canvas-wrap');
  const canvas = root.querySelector('canvas');
  const tip = root.querySelector('.skyline__tip');
  const statsEl = root.querySelector('.skyline__stats');
  if (!track || !stage || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const data = ACTIVITY;
  if (!data?.days?.length) { root.hidden = true; return; } // no data, no chart: never an invented year

  const end = Math.max(dayMs(new Date()), dayMs(data.updated));
  const grid = buildGrid(data.days, end, 1);
  const stats = computeStats(grid.cells);
  const active = grid.cells.filter((c) => c.count > 0).length;
  const { cells, weeks } = grid;
  const n = cells.length;
  const hgt = cells.map((c) => barHeight(c.count, grid.max, 1.05));
  const zs = new Float32Array(n);
  const polys = new Float32Array(n * 24);
  const order = cells.map((_, i) => i);
  const empty = mixRGB(BG, FG, 0.075);
  const colour = (lv) => (lv ? LEVELS[lv - 1] : empty);

  const lang = () => (document.documentElement.lang === 'bg' ? 'bg' : 'en');
  let months = [];
  const renderText = () => {
    const w = WORDS[lang()];
    months = monthLabels(cells, weeks, w.locale);
    const nf = new Intl.NumberFormat(w.locale);
    const df = new Intl.DateTimeFormat(w.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const busy = stats.busiest.date ? df.format(dayMs(stats.busiest.date)) : '';
    const items = [
      [w.total, nf.format(stats.total), w.commits(stats.total), `${w.since} ${df.format(dayMs(data.since))}`],
      [w.active, nf.format(active), w.days(active), `${w.updated} ${df.format(dayMs(data.updated))}`],
      [w.busiest, nf.format(stats.busiest.count), w.commits(stats.busiest.count), busy],
    ];
    statsEl.replaceChildren(...items.map(([label, value, unit, sub]) => {
      const d = document.createElement('div');
      d.className = 'skyline__stat';
      const l = document.createElement('p'); l.className = 'skyline__stat-label'; l.textContent = label;
      const v = document.createElement('p'); v.className = 'skyline__stat-value';
      const b = document.createElement('strong'); b.textContent = value;
      v.append(b, ' ', unit);
      const s = document.createElement('p'); s.className = 'skyline__stat-sub'; s.textContent = sub;
      d.append(l, v, s);
      return d;
    }));
    draw();
  };

  let W = 0, H = 0, dpr = 1, progress = 0, shown = -1, hovered = -1;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const extent = (cam, e) => {
    const w = lerp(0.78, 0.9, e), off = (1 - w) / 2;
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    const add = (x, y, z) => {
      const p = project(cam, x, y, z);
      if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0];
      if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1];
    };
    for (let i = 0; i < n; i++) {
      const x0 = cells[i].week + off, y0 = cells[i].day + off;
      add(x0, y0, hgt[i] * e); add(x0 + w, y0 + w, 0); add(x0 + w, y0, 0); add(x0, y0 + w, 0);
    }
    add(0, 7 + 1.5 * e, 0); add(weeks, 7 + 1.5 * e, 0);
    return { minx, maxx, miny, maxy };
  };

  const resize = () => {
    W = Math.round(stage.clientWidth);
    H = Math.round(stage.clientHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    draw();
  };

  function draw() {
    if (!W || !H) return;
    // 0–0.12 flat map · 0.12–0.62 the bars rise and the camera tilts · then a slow pass
    const t = reduced.matches ? 1 : smoothstep(0.12, 0.62, progress);
    const e = easeInOutCubic(t);
    const pass = reduced.matches ? 0 : smoothstep(0.55, 1, progress);
    const cam = camera(e, lerp(-0.22, 0.24, pass) * e, lerp(0.1, -0.06, pass) * e);
    for (let i = 0; i < n; i++) zs[i] = riseAt(t, cells[i].week, weeks, cells[i].day) * hgt[i];
    const b = extent(cam, e);
    const pad = 16, left = pad, top = pad + 20 * (1 - e);
    const aw = W - left - pad, ah = H - top - pad;
    const s = Math.min(aw / Math.max(1e-6, b.maxx - b.minx), ah / Math.max(1e-6, b.maxy - b.miny));
    const ox = left + (aw - (b.maxx - b.minx) * s) / 2 - b.minx * s;
    const oy = top + (ah - (b.maxy - b.miny) * s) / 2 - b.miny * s;
    const { cs, sn, se, ce } = cam;
    const px = (x, y) => ox + (x * cs - y * sn) * s;
    const py = (x, y, z) => oy + ((x * sn + y * cs) * se - z * ce) * s;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    order.sort((a, c) => (cells[a].week + 0.5) * sn + (cells[a].day + 0.5) * cs - ((cells[c].week + 0.5) * sn + (cells[c].day + 0.5) * cs));
    const w = lerp(0.78, 0.9, e), off = (1 - w) / 2;
    for (const i of order) {
      const x0 = cells[i].week + off, y0 = cells[i].day + off, x1 = x0 + w, y1 = y0 + w;
      const z = zs[i] + (i === hovered ? 0.6 * e : 0);
      const o = i * 24;
      const P = [px(x0, y0), py(x0, y0, z), px(x1, y0), py(x1, y0, z), px(x1, y1), py(x1, y1, z), px(x0, y1), py(x0, y1, z)];
      polys.set(P, o);
      const c = colour(cells[i].level);
      if (z * ce * s > 0.35) {
        ctx.beginPath();
        ctx.moveTo(px(x0, y1), py(x0, y1, 0)); ctx.lineTo(px(x1, y1), py(x1, y1, 0)); ctx.lineTo(P[4], P[5]); ctx.lineTo(P[6], P[7]);
        ctx.closePath(); ctx.fillStyle = rgb(c, 0.84); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px(x1, y0), py(x1, y0, 0)); ctx.lineTo(px(x1, y1), py(x1, y1, 0)); ctx.lineTo(P[4], P[5]); ctx.lineTo(P[2], P[3]);
        ctx.closePath(); ctx.fillStyle = rgb(c, 0.68); ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(P[0], P[1]); ctx.lineTo(P[2], P[3]); ctx.lineTo(P[4], P[5]); ctx.lineTo(P[6], P[7]); ctx.closePath();
      ctx.fillStyle = i === hovered ? rgb(mixRGB(c, FG, 0.18)) : rgb(c);
      ctx.fill();
      if (i === hovered) { ctx.strokeStyle = rgb(FG); ctx.lineWidth = 1.5; ctx.stroke(); }
    }

    // month names: along the top when flat, along the front edge in 3D
    const muted = mixRGB(BG, FG, 0.55);
    ctx.font = '500 11px Manrope, Arial, sans-serif';
    const a2 = 1 - smoothstep(0, 0.4, e), a3 = smoothstep(0.62, 1, e);
    const label = (alpha, x0, y0, base) => {
      if (alpha < 0.004) return;
      ctx.fillStyle = `rgba(${muted.map(Math.round).join(',')},${alpha.toFixed(3)})`;
      ctx.textAlign = 'left'; ctx.textBaseline = base;
      let edge = -Infinity;
      for (const m of months) {
        const x = px(m.week + x0, y0), tw = ctx.measureText(m.label).width;
        if (x < edge || x + tw > W) continue;
        ctx.fillText(m.label, x, py(m.week + x0, y0, 0) + (base === 'top' ? 2 : -3));
        edge = x + tw + 8;
      }
    };
    label(a2, off, -0.3, 'bottom');
    label(a3, 0.5, 7.3, 'top');

    if (hovered >= 0 && tip) {
      const i = hovered, c = cells[i], wd = WORDS[lang()];
      const df = new Intl.DateTimeFormat(wd.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
      tip.textContent = (c.count ? `${c.count} ${wd.commits(c.count)}` : wd.none) + ` ${wd.on} ${df.format(dayMs(c.date))}`;
      const tx = clamp(px(c.week + 0.5, c.day + 0.5), tip.offsetWidth / 2 + 4, W - tip.offsetWidth / 2 - 4);
      const ty = py(c.week + off, c.day + off, zs[i] + 0.6 * e);
      tip.style.transform = `translate(${(tx - tip.offsetWidth / 2).toFixed(1)}px, ${(ty - 10).toFixed(1)}px) translateY(-100%)`;
      tip.style.opacity = '1';
    } else if (tip) tip.style.opacity = '0';
  }

  // hover a day to read it (mouse only; phones just scroll)
  const inQuad = (o, x, y) => {
    let sign = 0;
    for (let k = 0; k < 4; k++) {
      const ax = polys[o + k * 2], ay = polys[o + k * 2 + 1], bx = polys[o + ((k + 1) % 4) * 2], by = polys[o + ((k + 1) % 4) * 2 + 1];
      const cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (Math.abs(cr) < 1e-9) continue;
      const sg = cr > 0 ? 1 : -1;
      if (!sign) sign = sg; else if (sg !== sign) return false;
    }
    return sign !== 0;
  };
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    let hit = -1;
    for (let k = n - 1; k >= 0; k--) if (inQuad(order[k] * 24, x, y)) { hit = order[k]; break; }
    if (hit !== hovered) { hovered = hit; draw(); }
  });
  canvas.addEventListener('pointerleave', () => { if (hovered >= 0) { hovered = -1; draw(); } });

  // scroll position through the tall track → progress 0…1, eased a little
  let target = 0, raf = 0;
  const measure = () => {
    const r = track.getBoundingClientRect();
    const span = Math.max(1, r.height - window.innerHeight);
    target = clamp(-r.top / span, 0, 1);
    if (!raf) raf = requestAnimationFrame(step);
  };
  const step = () => {
    raf = 0;
    progress = reduced.matches ? target : progress + (target - progress) * 0.16;
    if (Math.abs(target - progress) < 0.0005) progress = target;
    if (progress !== shown) { shown = progress; draw(); }
    if (progress !== target) raf = requestAnimationFrame(step);
  };

  new ResizeObserver(resize).observe(stage);
  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure);
  new MutationObserver(renderText).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  renderText();
  resize();
  measure();
}

export { DAY_MS };
