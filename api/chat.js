// POST /api/chat  { messages: [{ role: 'user'|'assistant', text }], lang }
// The website assistant. Answers from the site's own copy (site.js), in the
// visitor's language. Needs ANTHROPIC_API_KEY (Rollcfluence's own key, set in
// the hosting env vars). Without it, or past the daily limit, it answers
// { ai: false } and the widget falls back to its built-in FAQ answers.
import Anthropic from '@anthropic-ai/sdk';
import * as site from '../src/config/site.js';
import { guard, clientIp } from './_lib/shared.js';
import { incr } from './_lib/redis.js';

const env = process.env;
const MODEL = env.CHAT_MODEL || 'claude-haiku-5-5';
const PER_MINUTE = 6; // per visitor IP
const PER_DAY_IP = 25;
const PER_DAY = Number(env.CHAT_DAILY_LIMIT) || 400; // whole site, keeps the bill bounded
const MAX_TURNS = 12;
const MAX_CHARS = 1500;
const LANGS = { en: 'English', bg: 'Bulgarian', de: 'German', fr: 'French', es: 'Spanish' };

// Everything the site says, as plain "path: text" lines. Built once per instance.
const SKIP = new Set(['ui', 'console_', 'research', 'library', 'history', 'social']);
const lines = [];
const walk = (v, path) => {
  if (typeof v === 'string') {
    if (/[A-Za-z]{2}/.test(v) && !/\.(png|jpe?g|svg|webp|mp4)$/.test(v)) lines.push(`${path}: ${v}`);
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${i}`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['image', 'imageClass', 'icon', 'qr'].includes(k)) walk(x, `${path}.${k}`);
};
for (const [name, v] of Object.entries(site)) if (!SKIP.has(name)) walk(v, name);

const SYSTEM = `You are the website assistant for Rollcfluence Shield, an AI API key firewall for small teams.

How Shield works: a team stores its OpenAI, Anthropic or other OpenAI-compatible provider key in Shield, and their app calls Shield with a Shield key instead. Shield checks each request (spend caps, rate limits, model allow-list, IP allow-list, country blocks, key expiry, auto-lock, prompt-injection and PII filters) and forwards it to the provider. Customers keep paying their AI provider directly; Shield charges a monthly plan for protected requests.

Rules:
- Answer only from the site content below and these rules. If the answer is not there, say you do not know and suggest emailing rollcfluence@gmail.com or leaving an email in this chat so the team can reply.
- Be completely honest. Never promise features, results, certifications, uptime or prices that are not in the content. Features marked "coming next" or "soon" are not available yet; say so.
- Never name the hosting, database, email, payment or other vendors Rollcfluence uses. Say "a certified card processor", "EU-hosted database" and similar.
- Never ask for or accept API keys, passwords or card numbers in chat. If someone pastes a key, tell them to rotate it at their provider now.
- Keep replies short: 1 to 4 sentences, plain text, no markdown headings or tables. Warm and calm.
- Prices are in euros per month, excluding VAT.
- Stay on topic: Shield, AI API security and costs, signing up, plans, privacy. Politely decline anything else.

Site content:
${lines.join('\n')}`;

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ maxRetries: 1, timeout: 25_000 }) : null;

const clean = (raw) => {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: String(m?.text || '').trim().slice(0, MAX_CHARS) }))
    .filter((m) => m.content);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  // The API needs alternating turns; merge any repeats.
  return msgs.reduce((out, m) => {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else out.push({ ...m });
    return out;
  }, []);
};

export default async function handler(req, res) {
  const blocked = guard(req, res);
  if (blocked) return blocked;
  const b = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const messages = clean(b.messages);
  if (!messages) return res.status(400).json({ error: 'invalid_messages' });
  if (!client) return res.status(200).json({ ai: false });

  const ip = clientIp(req);
  const day = new Date().toISOString().slice(0, 10);
  let minute, ipDay, all;
  try {
    [minute, ipDay, all] = await Promise.all([incr(`chat:m:${ip}`, 60), incr(`chat:d:${day}:${ip}`, 86400), incr(`chat:all:${day}`, 86400)]);
  } catch {
    return res.status(200).json({ ai: false, reason: 'busy' }); // limits unavailable: answer from the FAQ
  }
  if (minute > PER_MINUTE || ipDay > PER_DAY_IP) return res.status(429).json({ error: 'too_many_requests' });
  if (all > PER_DAY) return res.status(200).json({ ai: false, reason: 'busy' });

  const lang = LANGS[b.lang] || 'English';
  try {
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Reply in ${lang} unless the visitor clearly writes in another language; then use theirs.` },
      ],
      messages,
    });
    const text = r.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim();
    if (!text || r.stop_reason === 'refusal') return res.status(200).json({ ai: false });
    return res.status(200).json({ ai: true, text });
  } catch (err) {
    console.error(`chat failed: ${err?.status || err?.name || 'error'}`);
    return res.status(200).json({ ai: false });
  }
}
