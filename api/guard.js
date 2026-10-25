// Bill Guard ingest. A customer's own site (server side) posts its traffic here:
//   POST /api/guard
//   Authorization: Bearer rcg_<project>_<secret>
//   { "events": [{ "route": "/api/search", "ms": 182, "status": 200, "bot": false,
//                  "deploy": "dpl_…", "commit": "a1b2c3d", "sample": 1 }] }
// Answers { ok: true, written, over: [routes past their hourly limit] } so the
// site can turn those routes away until the hour ends.
// Safety: per-project key (only a hash is stored), 120 posts a minute per
// project, 30 failed keys a minute per IP, 32 KB and 100 events per post,
// server-to-server only (no CORS), and only cleaned route patterns are kept.
import { cleanEvent, findSpikes, getProject, keyMatches, MAX_BODY, MAX_EVENTS, overCaps, parseKey, readDeploys, readHours, record } from './_lib/guard.js';
import { clientIp } from './_lib/shared.js';
import { alert } from './_lib/alerts.js';
import { incr, once, peek, RedisDown, redisReady } from './_lib/redis.js';

const POSTS_PER_MIN = 120;
const BAD_KEYS_PER_MIN = 30;
const minute = () => Math.floor(Date.now() / 60000);

const fail = (res, status, error) => res.status(status).json({ error });

// At most every 30 minutes per project: look for routes that jumped and alert
// once per route and deploy (or hour, when no deploy explains it).
const CHECK_EVERY_S = 30 * 60;
export const checkSpikes = async (project, now = Date.now()) => {
  if (!(await once(`bg:chk:${project.id}`, CHECK_EVERY_S))) return 0;
  const [hours, deploys] = await Promise.all([readHours(project.id, 50, now), readDeploys(project.id)]);
  let sent = 0;
  for (const s of findSpikes(hours, deploys, project, now).slice(0, 5)) {
    const tag = s.deploy ? s.deploy.id : `h${Math.floor(now / 3600_000)}`;
    if (!(await once(`bg:al:${project.id}:${tag}:${s.route}`, 2 * 24 * 3600))) continue;
    await alert(project.account_id, 'route_spike', {
      key_id: `${project.id}:${s.route}`,
      project: project.name,
      route: s.route,
      reason: s.kind === 'slower' ? 'Got at least 2x slower' : s.kind === 'both' ? 'At least 2x more requests and 2x slower' : 'At least 2x more requests',
      before: `${s.before.per_hour}/hour, ${s.before.avg_ms} ms`,
      after: `${s.after.per_hour}/hour, ${s.after.avg_ms} ms, ${Math.round(s.after.bot_share * 100)}% bots`,
      deploy: s.deploy ? `${s.deploy.id}${s.deploy.commit ? ` (commit ${s.deploy.commit})` : ''}` : 'No new deploy: likely traffic or bots',
    });
    sent++;
  }
  return sent;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'method_not_allowed');
  }
  // Production needs Upstash: memory counts per instance and would lose data.
  if (process.env.VERCEL_ENV === 'production' && !redisReady()) return fail(res, 503, 'not_configured');
  try {
    const ip = clientIp(req);
    if ((await peek(`bg:bad:${ip}:${minute()}`)) >= BAD_KEYS_PER_MIN) return fail(res, 429, 'too_many_attempts');

    const auth = String(req.headers.authorization || '');
    const parsed = parseKey(auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-shield-guard-key']);
    const project = parsed ? await getProject(parsed.id) : null;
    if (!project || !keyMatches(project, parsed.key)) {
      await incr(`bg:bad:${ip}:${minute()}`, 70);
      return fail(res, 401, 'invalid_key');
    }

    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return fail(res, 415, 'json_only');
    const size = Number(req.headers['content-length']);
    if (Number.isFinite(size) && size > MAX_BODY) return fail(res, 413, 'too_large');
    const body = typeof req.body === 'object' && req.body !== null ? req.body : null;
    if (!body || JSON.stringify(body).length > MAX_BODY) return fail(res, body ? 413 : 400, body ? 'too_large' : 'invalid_json');

    if ((await incr(`bg:rl:${project.id}:${minute()}`, 70)) > POSTS_PER_MIN) return fail(res, 429, 'rate_limited');

    const raw = Array.isArray(body.events) ? body.events : [body];
    if (raw.length > MAX_EVENTS) return fail(res, 413, 'too_many_events');
    const events = raw.map(cleanEvent).filter(Boolean);
    const written = events.length ? await record(project.id, events) : 0;
    await checkSpikes(project).catch(() => 0);
    return res.status(200).json({ ok: true, accepted: events.length, dropped: raw.length - events.length, written, over: await overCaps(project) });
  } catch (e) {
    if (e instanceof RedisDown) return fail(res, 503, 'storage_unavailable');
    console.error('guard ingest failed', e?.message);
    return fail(res, 500, 'server_error');
  }
}
