// Bill Guard's pure parts: cleaning what sites send, and reading the hourly
// counts. No Node imports, so the dashboard demo runs the same code.
import { DEFAULT_MEMORY_GB, DEFAULT_REGION, costOf } from './vercel-prices.js';

const HOUR = 3600_000;
const hourOf = (t) => Math.floor(t / HOUR);

// ---------- cleaning ----------
const SAFE = /^[A-Za-z0-9._~-]+$/;
const PATTERN = /^(\[{1,2}(\.\.\.)?[A-Za-z0-9_]{1,40}\]{1,2}|:[A-Za-z0-9_]{1,40})$/; // [id], [[...slug]], :id
const segment = (s) => {
  let v = s;
  try {
    v = decodeURIComponent(s);
  } catch {
    return ':id';
  }
  if (PATTERN.test(v)) return v;
  if (!SAFE.test(v) || v.length > 40) return ':id';
  if (/^\d+$/.test(v)) return ':id';
  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(v)) return ':id';
  if (/^[0-9a-f]{12,}$/i.test(v)) return ':id';
  if (/\d{4,}/.test(v)) return ':id'; // order-12345, phone-like runs
  if (v.length >= 20 && /\d/.test(v) && /[A-Za-z]/.test(v)) return ':id'; // tokens
  return v;
};

// A route pattern safe to store, or null.
export const cleanRoute = (raw) => {
  let p = String(raw ?? '').trim();
  if (!p || p.length > 2000) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      return null;
    }
  }
  p = p.split(/[?#]/)[0];
  const parts = p.split('/').filter(Boolean);
  const out = parts.slice(0, 8).map(segment);
  if (parts.length > 8) out.push('…');
  return ('/' + out.join('/')).slice(0, 120);
};

const DEPLOY_RE = /^dpl_[A-Za-z0-9]{8,40}$/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/i;
const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), max) : 0;
};

// One event from the customer's site, or null. Unknown fields are dropped.
export const cleanEvent = (e) => {
  if (!e || typeof e !== 'object') return null;
  const route = cleanRoute(e.route ?? e.path);
  if (!route) return null;
  const status = num(e.status, 599);
  const sample = Number(e.sample);
  return {
    route,
    ms: num(e.ms, 900_000),
    bot: e.bot === true,
    error: status >= 500,
    weight: Number.isFinite(sample) && sample > 0 && sample < 1 ? Math.min(1000, Math.round(1 / Math.max(sample, 0.001))) : 1,
    deploy: DEPLOY_RE.test(String(e.deploy || '')) ? String(e.deploy) : null,
    commit: COMMIT_RE.test(String(e.commit || '')) ? String(e.commit).slice(0, 12).toLowerCase() : null,
  };
};

// Sums events per route, so one POST is a handful of Redis commands.
export const aggregate = (events) => {
  const routes = new Map();
  const deploys = new Map();
  for (const e of events) {
    const r = routes.get(e.route) || { c: 0, ms: 0, b: 0, e: 0 };
    r.c += e.weight;
    r.ms += e.ms * e.weight;
    if (e.bot) r.b += e.weight;
    if (e.error) r.e += e.weight;
    routes.set(e.route, r);
    if (e.deploy && !deploys.has(e.deploy)) deploys.set(e.deploy, e.commit);
  }
  return { routes, deploys };
};

// Per-route request limits per hour: { "/api/search": 5000 }. Up to 20 routes.
export const MAX_CAPS = 20;
export const cleanCaps = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const [r, v] of Object.entries(raw)) {
    const route = cleanRoute(r);
    const n = Number(v);
    if (!route || !Number.isInteger(n) || n < 1 || n > 10_000_000) return null;
    out[route] = n;
  }
  return Object.keys(out).length <= MAX_CAPS ? out : null;
};

// ---------- analysis ----------
const MIN_REQUESTS = 30; // a jump needs at least this many requests after it
const MIN_AFTER_MS = 20 * 60_000; // and at least 20 minutes of traffic after the deploy

const sumHours = (hours, route) =>
  hours.reduce(
    (a, h) => {
      const r = h.routes[route];
      if (r) for (const f of ['c', 'ms', 'b', 'e']) a[f] += r[f];
      return a;
    },
    { c: 0, ms: 0, b: 0, e: 0 },
  );

// Finds routes whose requests or average time at least doubled. With a deploy in
// the last 24 hours, "after" is the time since the hour after that deploy and
// "before" the 24 hours before it; otherwise "after" is the last full hour and
// "before" the 24 hours before that. Hourly buckets, so it needs 20 minutes of
// data after the deploy hour before it says anything.
export const findSpikes = (hours, deploys, project, now = Date.now()) => {
  if (!hours.length) return [];
  const cur = hourOf(now);
  const deploy = deploys.find((d) => d.at <= now && now - d.at < 24 * HOUR);
  let afterHours;
  let afterMs;
  let beforeHours;
  if (deploy) {
    const dh = hourOf(deploy.at);
    afterHours = hours.filter((h) => h.hour > dh);
    afterMs = now - (dh + 1) * HOUR;
    beforeHours = hours.filter((h) => h.hour < dh && h.hour >= dh - 24);
  } else {
    afterHours = hours.filter((h) => h.hour === cur - 1);
    afterMs = HOUR;
    beforeHours = hours.filter((h) => h.hour < cur - 1 && h.hour >= cur - 25);
  }
  if (afterMs < MIN_AFTER_MS || !afterHours.length) return [];
  const beforeSpan = beforeHours.filter((h) => Object.keys(h.routes).length).length;
  if (!beforeSpan) return [];
  const routes = new Set(afterHours.flatMap((h) => Object.keys(h.routes)));
  const region = project?.region || DEFAULT_REGION;
  const memoryGb = project?.memory_gb || DEFAULT_MEMORY_GB;
  const spikes = [];
  for (const route of routes) {
    const a = sumHours(afterHours, route);
    const b = sumHours(beforeHours, route);
    if (a.c < MIN_REQUESTS || !b.c) continue;
    const aRate = a.c / (afterMs / HOUR);
    const bRate = b.c / beforeSpan;
    const aAvg = a.ms / a.c;
    const bAvg = b.ms / b.c;
    const aCost = costOf({ requests: aRate, totalMs: aRate * aAvg, memoryGb, region });
    const bCost = costOf({ requests: bRate, totalMs: bRate * bAvg, memoryGb, region });
    const more = aRate >= 2 * bRate;
    const slower = aAvg >= 2 * bAvg && aAvg - bAvg >= 50;
    if (!more && !slower) continue;
    spikes.push({
      route,
      kind: more && slower ? 'both' : more ? 'requests' : 'slower',
      before: { per_hour: Math.round(bRate), avg_ms: Math.round(bAvg), cost_per_hour: bCost },
      after: { per_hour: Math.round(aRate), avg_ms: Math.round(aAvg), cost_per_hour: aCost, bot_share: a.c ? a.b / a.c : 0 },
      deploy: deploy ? { id: deploy.id, commit: deploy.commit, at: new Date(deploy.at).toISOString() } : null,
    });
  }
  return spikes.sort((x, y) => y.after.cost_per_hour - y.before.cost_per_hour - (x.after.cost_per_hour - x.before.cost_per_hour));
};

// The dashboard summary for one project over the last 24 hours.
export const summarize = (hours, deploys, project, now = Date.now()) => {
  const cur = hourOf(now);
  const day = hours.filter((h) => h.hour > cur - 24);
  const region = project.region || DEFAULT_REGION;
  const memoryGb = project.memory_gb || DEFAULT_MEMORY_GB;
  const names = new Set(day.flatMap((h) => Object.keys(h.routes)));
  const routes = [...names]
    .map((route) => {
      const s = sumHours(day, route);
      return {
        route,
        requests: s.c,
        avg_ms: s.c ? Math.round(s.ms / s.c) : 0,
        bot_share: s.c ? s.b / s.c : 0,
        errors: s.e,
        cost_24h: costOf({ requests: s.c, totalMs: s.ms, memoryGb, region }),
      };
    })
    .sort((a, b) => b.cost_24h - a.cost_24h)
    .slice(0, 100);
  const totals = routes.reduce((a, r) => ({ requests: a.requests + r.requests, bots: a.bots + r.bot_share * r.requests, cost_24h: a.cost_24h + r.cost_24h }), { requests: 0, bots: 0, cost_24h: 0 });
  return {
    routes,
    totals: { requests: totals.requests, bot_share: totals.requests ? totals.bots / totals.requests : 0, cost_24h: totals.cost_24h, month_if_same: totals.cost_24h * 30 },
    series: day.map((h) => ({ at: new Date(h.hour * HOUR).toISOString(), requests: Object.values(h.routes).reduce((a, r) => a + r.c, 0) })),
    deploys: deploys.slice(0, 10).map((d) => ({ id: d.id, commit: d.commit, at: new Date(d.at).toISOString() })),
    spikes: findSpikes(hours, deploys, project, now),
  };
};

export const projectView = (p) => ({ id: p.id, name: p.name, prefix: p.prefix, region: p.region, memory_gb: p.memory_gb, caps: p.caps || {}, created_at: p.created_at });
