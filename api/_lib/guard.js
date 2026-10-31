// Bill Guard: Shield counts a customer's own site traffic per route, prices it
// with Vercel's published rates and warns when a route jumps after a deploy.
// Works on Vercel Hobby: the customer's site sends small events to
// POST /api/guard (see api/guard.js); nothing here reads Vercel's billing API.
//
// Stored in Redis, never in the request log:
//   bg:p:<id>          project { id, account_id, name, hash, region, memory_gb, created_at }
//   bg:a:<account>     the account's project ids
//   bg:h:<id>:<hour>   hash per hour: c|route, ms|route, b|route (bots), e|route (5xx), 15 days
//   bg:d:<id>          hash deploy id -> "firstSeenMs|commit", 30 days
// Only a cleaned route pattern is kept: no query strings, no hosts, and path
// parts that look like ids, emails or tokens become ":id".
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { exec } from './redis.js';
import { DEFAULT_MEMORY_GB, DEFAULT_REGION, REGIONS } from './vercel-prices.js';
import { aggregate, cleanCaps, cleanRoute } from './guard-math.js';

export * from './guard-math.js';

export const MAX_PROJECTS = 5;
export const MAX_EVENTS = 100; // per POST
export const MAX_BODY = 32 * 1024; // bytes
export const MAX_FIELDS_PER_HOUR = 1200; // about 300 routes; past that new data lands in "(other)"
const HOUR_TTL = 15 * 24 * 3600;
const DEPLOY_TTL = 30 * 24 * 3600;
const PROJECT_TTL = 400 * 24 * 3600;
const HOUR = 3600_000;

// ---------- keys ----------
const KEY_RE = /^rcg_([0-9a-f]{16})_([A-Za-z0-9_-]{32})$/;
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
export const newProjectKey = () => {
  const id = randomBytes(8).toString('hex');
  const key = `rcg_${id}_${randomBytes(24).toString('base64url')}`;
  return { id, key, hash: sha(key) };
};
export const parseKey = (raw) => {
  const m = KEY_RE.exec(String(raw || '').trim());
  return m ? { id: m[1], key: m[0] } : null;
};
export const keyMatches = (project, key) => {
  if (!project?.hash) return false;
  const a = Buffer.from(project.hash, 'hex');
  const b = Buffer.from(sha(key), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};

// ---------- storage ----------
// Through exec, so a configured but unreachable Upstash fails closed instead of
// saving projects in one instance's memory.
const getText = async (key) => (await exec([['GET', key]]))[0];
const setText = (key, value, ttl) => exec([['SET', key, String(value), 'EX', String(ttl)]]);
const hourOf = (t) => Math.floor(t / HOUR);
const hourKey = (id, h) => `bg:h:${id}:${h}`;

export const getProject = async (id) => {
  const raw = await getText(`bg:p:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
const saveProject = (p) => setText(`bg:p:${p.id}`, JSON.stringify(p), PROJECT_TTL);

// The account's project ids are a Redis set, so two creates at once cannot
// drop each other or pass the limit.
const acctKey = (accountId) => `bg:a:${accountId}`;
export const listProjects = async (accountId) => {
  const [ids] = await exec([['SMEMBERS', acctKey(accountId)]]);
  const all = await Promise.all((Array.isArray(ids) ? ids : []).map(getProject));
  return all.filter((p) => p && p.account_id === accountId);
};

export const createProject = async (accountId, { name, region, memory_gb } = {}) => {
  const existing = await listProjects(accountId);
  if (existing.length >= MAX_PROJECTS) return { error: 'too_many_projects' };
  const clean = String(name || '').trim();
  if (!clean || clean.length > 60) return { error: 'invalid_name' };
  const { id, key, hash } = newProjectKey();
  const project = {
    id,
    account_id: accountId,
    name: clean,
    hash,
    prefix: key.slice(0, 12),
    region: REGIONS[region] ? region : DEFAULT_REGION,
    memory_gb: [1, 2, 3, 4].includes(Number(memory_gb)) ? Number(memory_gb) : DEFAULT_MEMORY_GB,
    created_at: new Date().toISOString(),
  };
  await saveProject(project);
  const [, count] = await exec([['SADD', acctKey(accountId), id], ['SCARD', acctKey(accountId)], ['EXPIRE', acctKey(accountId), String(PROJECT_TTL)]]);
  if (Number(count) > MAX_PROJECTS) {
    await exec([['SREM', acctKey(accountId), id], ['DEL', `bg:p:${id}`]]);
    return { error: 'too_many_projects' };
  }
  return { project, key };
};

// Routes already over their limit in the current hour.
export const overCaps = async (project, now = Date.now()) => {
  const routes = Object.keys(project.caps || {});
  if (!routes.length) return [];
  const key = hourKey(project.id, hourOf(now));
  const counts = await exec(routes.map((r) => ['HGET', key, `c|${r}`]));
  return routes.filter((r, i) => (Number(counts[i]) || 0) >= project.caps[r]);
};

export const updateProject = async (accountId, id, patch) => {
  const p = await getProject(id);
  if (!p || p.account_id !== accountId) return null;
  if ('name' in patch) {
    const n = String(patch.name || '').trim();
    if (!n || n.length > 60) return { error: 'invalid_name' };
    p.name = n;
  }
  if ('region' in patch) {
    if (!REGIONS[patch.region]) return { error: 'invalid_region' };
    p.region = patch.region;
  }
  if ('caps' in patch) {
    const caps = cleanCaps(patch.caps);
    if (!caps) return { error: 'invalid_caps' };
    p.caps = caps;
  }
  if ('memory_gb' in patch) {
    if (![1, 2, 3, 4].includes(Number(patch.memory_gb))) return { error: 'invalid_memory' };
    p.memory_gb = Number(patch.memory_gb);
  }
  await saveProject(p);
  return { project: p };
};

export const deleteProject = async (accountId, id) => {
  const projects = await listProjects(accountId);
  if (!projects.some((p) => p.id === id)) return false;
  await exec([['SREM', acctKey(accountId), id], ['DEL', `bg:p:${id}`], ['DEL', `bg:d:${id}`]]);
  return true;
};

// Keeps an active project's record alive: refreshed at most once a day.
export const touchProject = (id) => exec([['EXPIRE', `bg:p:${id}`, String(PROJECT_TTL)]]);

export const MAX_DEPLOYS = 50;
// Writes one POST's events. Returns how many routes were written.
// Once an hour's hash is full, routes it already has (and capped routes) keep
// counting; only new routes go to "(other)", so limits keep working.
export const record = async (projectId, events, now = Date.now(), caps = {}) => {
  const { routes, deploys } = aggregate(events);
  const key = hourKey(projectId, hourOf(now));
  const [len, deployCount] = await exec([['HLEN', key], ['HLEN', `bg:d:${projectId}`]]);
  const full = Number(len) >= MAX_FIELDS_PER_HOUR;
  let known = new Set();
  if (full) {
    const names = [...routes.keys()];
    const there = await exec(names.map((n) => ['HEXISTS', key, `c|${n}`]));
    known = new Set(names.filter((n, i) => Number(there[i]) === 1 || n in caps));
  }
  const merged = new Map();
  for (const [route, r] of routes) {
    const name = full && !known.has(route) ? '(other)' : route;
    const m = merged.get(name) || { c: 0, ms: 0, b: 0, e: 0 };
    for (const f of ['c', 'ms', 'b', 'e']) m[f] += r[f];
    merged.set(name, m);
  }
  const cmds = [];
  for (const [route, r] of merged) for (const f of ['c', 'ms', 'b', 'e']) if (r[f]) cmds.push(['HINCRBY', key, `${f}|${route}`, String(Math.round(r[f]))]);
  cmds.push(['EXPIRE', key, String(HOUR_TTL)]);
  if (Number(deployCount) < MAX_DEPLOYS && deploys.size) {
    for (const [dep, commit] of deploys) cmds.push(['HSETNX', `bg:d:${projectId}`, dep, `${now}|${commit || ''}`]);
    cmds.push(['EXPIRE', `bg:d:${projectId}`, String(DEPLOY_TTL)]);
  }
  await exec(cmds);
  return merged.size;
};

const pairs = (flat) => {
  const out = {};
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  else if (flat && typeof flat === 'object') Object.assign(out, flat);
  return out;
};

// Hourly counts for the last `hours` hours (current one last): [{ hour, routes: { route: {c,ms,b,e} } }].
export const readHours = async (projectId, hours = 26, now = Date.now()) => {
  const last = hourOf(now);
  const list = Array.from({ length: hours }, (_, i) => last - hours + 1 + i);
  const raw = await exec(list.map((h) => ['HGETALL', hourKey(projectId, h)]));
  return list.map((h, i) => {
    const routes = {};
    for (const [field, v] of Object.entries(pairs(raw[i]))) {
      const cut = field.indexOf('|');
      const f = field.slice(0, cut);
      const route = field.slice(cut + 1);
      (routes[route] ||= { c: 0, ms: 0, b: 0, e: 0 })[f] = Number(v) || 0;
    }
    return { hour: h, routes };
  });
};

export const readDeploys = async (projectId) => {
  const [raw] = await exec([['HGETALL', `bg:d:${projectId}`]]);
  return Object.entries(pairs(raw))
    .map(([id, v]) => {
      const [at, commit] = String(v).split('|');
      return { id, at: Number(at) || 0, commit: commit || null };
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 20);
};

