// GET /api/health  Up/down for the status page. Reports only booleans.
// The answer is reused for 30 seconds and callers are limited in memory, so
// hammering this route costs no Supabase or Upstash requests.
import { clientIp, health } from './_lib/shared.js';

const TTL_MS = 30_000;
const PER_MINUTE = 20;
let cached = null; // { at, body }
const seen = new Map(); // ip -> [timestamps]

const tooMany = (ip) => {
  const now = Date.now();
  const recent = (seen.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  seen.set(ip, recent);
  if (seen.size > 5000) seen.clear();
  return recent.length > PER_MINUTE;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (tooMany(clientIp(req))) return res.status(429).json({ error: 'too_many_requests' });
  if (!cached || Date.now() - cached.at > TTL_MS) cached = { at: Date.now(), body: await health() };
  return res.status(200).json(cached.body);
}
