// Pure maths from the Contribution Skyline component (21st.dev), compiled from
// its TypeScript source: grid, levels, stats, camera and projection.
const DAY_MS = 864e5;
const clamp01 = (v) => v > 0 ? v < 1 ? v : 1 : 0;
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutCubic = (x) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const easeOutCubic = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const toKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (v) => {
  if (typeof v === "number") return Math.floor(v / DAY_MS) * DAY_MS;
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    v = new Date(v);
  }
  return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
};
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
const generateContributions = (endMs, seed = 7, days = 371) => {
  const r = rng(seed);
  const bursts = Array.from({ length: 4 }, () => ({ at: r(), width: 0.035 + r() * 0.07, gain: 0.6 + r() * 1.1 }));
  const out = [];
  let mood = 0.5;
  for (let i = 0; i < days; i++) {
    const ms = endMs - (days - 1 - i) * DAY_MS;
    const x = i / Math.max(1, days - 1);
    const dow = new Date(ms).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    let heat = 0.2;
    for (const b of bursts) heat += b.gain * Math.exp(-((x - b.at) ** 2) / (2 * b.width ** 2));
    mood = mood * 0.85 + r() * 0.15;
    heat *= 0.55 + mood * 0.9;
    const pActive = Math.min(0.94, (weekend ? 0.22 : 0.5) + heat * 0.4);
    let count = 0;
    if (r() < pActive) count = 1 + Math.floor(-Math.log(1 - r()) * (1.2 + heat * 7) * (weekend ? 0.5 : 1));
    if (r() < 0.01) count += 18 + Math.floor(r() * 24);
    out.push({ date: toKey(ms), count });
  }
  return out;
};
const buildGrid = (data, endMs, weekStart = 0) => {
  const counts = /* @__PURE__ */ new Map();
  for (const d of data) {
    if (!d || typeof d.date !== "string") continue;
    const ms = dayMs(d.date);
    const c = Number(d.count);
    if (!Number.isFinite(ms) || !(c > 0) || !Number.isFinite(c)) continue;
    const k = toKey(ms);
    counts.set(k, (counts.get(k) ?? 0) + c);
  }
  let start = endMs - 364 * DAY_MS;
  start -= (new Date(start).getUTCDay() - weekStart + 7) % 7 * DAY_MS;
  const cells = [];
  for (let ms = start, i = 0; ms <= endMs; ms += DAY_MS, i++) {
    const date = toKey(ms);
    cells.push({ date, count: counts.get(date) ?? 0, level: 0, week: Math.floor(i / 7), day: i % 7 });
  }
  const nz = cells.map((c) => c.count).filter((c) => c > 0).sort((a, b) => a - b);
  const busy = nz.length ? nz[Math.floor(0.95 * (nz.length - 1))] : 0;
  for (const c of cells) c.level = levelOf(c.count, busy);
  return { cells, weeks: cells.length ? cells[cells.length - 1].week + 1 : 0, max: nz.length ? nz[nz.length - 1] : 0 };
};
const levelOf = (count, busy) => count <= 0 ? 0 : busy <= 0 ? 4 : 1 + Math.min(3, Math.floor(count / busy * 4));
const computeStats = (cells) => {
  let total = 0;
  let best = 0;
  let bestDate = null;
  let run = 0;
  let runStart = null;
  let longest = { days: 0, start: null, end: null };
  for (const c of cells) {
    total += c.count;
    if (c.count > best) {
      best = c.count;
      bestDate = c.date;
    }
    if (c.count > 0) {
      if (run === 0) runStart = c.date;
      run++;
      if (run > longest.days) longest = { days: run, start: runStart, end: c.date };
    } else run = 0;
  }
  let j = cells.length - 1;
  if (j >= 0 && cells[j].count === 0) j--;
  const endAt = j;
  while (j >= 0 && cells[j].count > 0) j--;
  const days = endAt - j;
  const current = days > 0 ? { days, start: cells[j + 1].date, end: cells[endAt].date } : { days: 0, start: null, end: null };
  return {
    total,
    first: cells.length ? cells[0].date : null,
    last: cells.length ? cells[cells.length - 1].date : null,
    busiest: { count: best, date: bestDate },
    longest,
    current
  };
};
const monthLabels = (cells, weeks, locale = "en-US") => {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const out = [];
  let prev = -1;
  for (let w = 0; w < weeks; w++) {
    const c = cells[w * 7];
    if (!c) break;
    const m = +c.date.slice(5, 7);
    if (m !== prev) out.push({ week: w, label: fmt.format(dayMs(c.date)) });
    prev = m;
  }
  if (out.length > 1 && out[1].week - out[0].week < 3) out.shift();
  return out;
};
const barHeight = (count, max, scale = 1) => count > 0 && max > 0 ? 0.4 + Math.pow(count / max, 0.85) * 7.2 * scale : 0.2;
const WAVE = 0.42;
const riseAt = (t, week, weeks, day) => {
  const d = (weeks > 1 ? week / (weeks - 1) : 0) * 0.36 + day / 6 * 0.06;
  return easeOutCubic((t - d) / (1 - WAVE));
};
const YAW_3D = Math.PI / 4;
const ELEV_3D = 34 * Math.PI / 180;
const YAW_RANGE = [8 * Math.PI / 180, 82 * Math.PI / 180];
const ELEV_RANGE = [18 * Math.PI / 180, 62 * Math.PI / 180];
const camera = (e, dYaw = 0, dElev = 0) => {
  const yaw = Math.min(YAW_RANGE[1], Math.max(0, lerp(0, YAW_3D + dYaw, e)));
  const elev = lerp(Math.PI / 2, Math.min(ELEV_RANGE[1], Math.max(ELEV_RANGE[0], ELEV_3D + dElev)), e);
  return { cs: Math.cos(yaw), sn: Math.sin(yaw), se: Math.sin(elev), ce: Math.cos(elev) };
};
const project = (c, x, y, z) => [
  x * c.cs - y * c.sn,
  (x * c.sn + y * c.cs) * c.se - z * c.ce
];
const depthOf = (c, x, y) => x * c.sn + y * c.cs;
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const luminance = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const PALETTES = {
  github: { light: ["#c6e48b", "#7bc96f", "#239a3b", "#196127"], dark: ["#0e4429", "#006d32", "#26a641", "#39d353"] },
  halloween: { light: ["#ffee4a", "#ffc501", "#fe9600", "#b33c00"], dark: ["#631c03", "#bd561d", "#fa7a18", "#fddf68"] },
  ocean: { light: ["#b8e3f5", "#6ec3eb", "#2a8fd1", "#0b4f8a"], dark: ["#0c2d4a", "#12508a", "#2a88d8", "#7cc7ff"] },
  ember: { light: ["#fde2c4", "#fbad6e", "#f06b3a", "#b3261e"], dark: ["#4a1a10", "#8f2f16", "#e0572a", "#ffa46b"] },
  grape: { light: ["#e4d4fb", "#b794f4", "#805ad5", "#44337a"], dark: ["#2d1f4f", "#553c9a", "#8b5cf6", "#c4b5fd"] },
  mono: { light: ["#d4d4d4", "#a3a3a3", "#525252", "#171717"], dark: ["#333333", "#5c5c5c", "#a3a3a3", "#fafafa"] }
};
const resolvePalette = (p, dark) => {
  const pick = Array.isArray(p) ? p : typeof p === "object" && p ? dark ? p.dark : p.light : PALETTES[p ?? "github"] ? PALETTES[p][dark ? "dark" : "light"] : PALETTES.github[dark ? "dark" : "light"];
  const base = PALETTES.github[dark ? "dark" : "light"];
  return [0, 1, 2, 3].map((i) => pick[i] ?? pick[pick.length - 1] ?? base[i]);
};
export {
  DAY_MS,
  ELEV_3D,
  ELEV_RANGE,
  PALETTES,
  WAVE,
  YAW_3D,
  YAW_RANGE,
  barHeight,
  buildGrid,
  camera,
  clamp01,
  computeStats,
  dayMs,
  depthOf,
  easeInOutCubic,
  easeOutCubic,
  generateContributions,
  lerp,
  levelOf,
  luminance,
  mixRGB,
  monthLabels,
  project,
  resolvePalette,
  riseAt,
  rng,
  smoothstep,
  toKey
};
