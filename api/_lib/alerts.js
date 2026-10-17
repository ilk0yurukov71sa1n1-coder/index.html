// Alerts: tell the customer when something happens on their keys, by email,
// Slack, Discord or their own webhook. Webhook URLs are secrets (anyone with
// one can post to the channel), so they are stored encrypted like provider keys.
import { createHmac, randomBytes } from 'node:crypto';
import { decrypt } from './crypto.js';
import { db } from './db.js';
import { send } from './mail.js';
import { once } from './redis.js';
import { EMAIL } from './shared.js';
import { publicHttps } from './url.js';

export const KINDS = ['email', 'slack', 'discord', 'webhook'];
export const EVENTS = {
  cap_warning: 'A key used 80% of its daily or monthly cap',
  cap_reached: 'A key hit its spend cap and was stopped',
  injection_blocked: 'A prompt-injection attempt was blocked',
  key_locked: 'A key was locked automatically',
  access_denied: 'A request came from a blocked IP or country',
  key_expired: 'Someone used an expired key',
};
export const MAX_CHANNELS = 10;
const THROTTLE_S = 15 * 60; // at most one alert per key and event every 15 minutes

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SHAPES = {
  slack: (u) => u.hostname === 'hooks.slack.com' && u.pathname.startsWith('/services/'),
  discord: (u) => ['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'].includes(u.hostname) && u.pathname.startsWith('/api/webhooks/'),
  webhook: () => true,
};

// Checks a new channel's target. Returns { target, hint } or { error }.
export const checkTarget = (kind, value) => {
  const v = String(value || '').trim();
  if (!KINDS.includes(kind)) return { error: 'invalid_kind' };
  if (kind === 'email') {
    if (v.length > 254 || !EMAIL.test(v)) return { error: 'invalid_email' };
    return { target: v.toLowerCase(), hint: v.toLowerCase() };
  }
  if (v.length > 500) return { error: 'invalid_url' };
  const u = publicHttps(v);
  if (!u || !SHAPES[kind](u)) return { error: `invalid_${kind}_url` };
  return { target: u.toString(), hint: `${u.hostname}/…${u.pathname.slice(-4)}` };
};

export const newSigningSecret = () => `whsec_${randomBytes(24).toString('base64url')}`;

const lines = (event, d) => {
  const rows = [
    ['Key', d.key_name],
    ['Model', d.model],
    ['Reason', d.reason],
    ['Spent', d.spent_usd != null ? `$${Number(d.spent_usd).toFixed(2)}` : null],
    ['Cap', d.cap_usd != null ? `$${Number(d.cap_usd).toFixed(2)}` : null],
    ['From', [d.city, d.country].filter(Boolean).join(', ') || null],
    ['User', d.end_user],
  ].filter(([, v]) => v != null && v !== '');
  return { title: event === 'test' ? 'Test alert from Rollcfluence Shield' : EVENTS[event] || event, rows };
};

const post = async (url, payload, headers = {}) => {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Rollcfluence-Shield-Alerts/1', ...headers },
      body: payload,
      redirect: 'manual',
      signal: AbortSignal.timeout(2500),
    });
    return r.status >= 200 && r.status < 300;
  } catch {
    return false;
  }
};

// Sends one alert to one channel. Returns true if the channel accepted it.
export const deliver = async (channel, event, data = {}) => {
  const { title, rows } = lines(event, data);
  const text = `🛡️ ${title}\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`.trim();
  if (channel.kind === 'email') {
    const html = `<h2 style="font-family:sans-serif">${esc(title)}</h2><table style="font-family:sans-serif">${rows
      .map(([k, v]) => `<tr><td style="color:#666;padding-right:12px">${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join('')}</table><p style="font-family:sans-serif;color:#666">Manage alerts in your Rollcfluence Shield dashboard.</p>`;
    return send({ to: channel.target, subject: `Shield: ${title}`, html });
  }
  let url;
  try {
    url = decrypt(channel.target);
  } catch {
    return false;
  }
  if (!publicHttps(url)) return false;
  if (channel.kind === 'slack') return post(url, JSON.stringify({ text }));
  if (channel.kind === 'discord') return post(url, JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }));
  const body = JSON.stringify({ type: event, created_at: new Date().toISOString(), data });
  const ts = Math.floor(Date.now() / 1000);
  let secret = '';
  try {
    secret = channel.secret ? decrypt(channel.secret) : '';
  } catch {
    secret = '';
  }
  const sig = secret ? createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex') : '';
  return post(url, body, { 'X-Shield-Event': event, 'X-Shield-Timestamp': String(ts), ...(sig ? { 'X-Shield-Signature': `sha256=${sig}` } : {}) });
};

// Fans an event out to every channel subscribed to it. Never throws, and
// throttles repeats so a flood of blocked requests is one message, not thousands.
export const alert = async (accountId, event, data = {}) => {
  try {
    if (!(await once(`alert:${accountId}:${event}:${data.key_id || '-'}`, THROTTLE_S))) return 0;
    const channels = (await db.channelsFor(accountId)).filter((c) => (c.events || []).includes(event));
    const results = await Promise.all(channels.map((c) => deliver(c, event, data)));
    await Promise.all(channels.map((c, i) => db.markChannel(c.id, results[i]).catch(() => {})));
    return results.filter(Boolean).length;
  } catch {
    return 0;
  }
};
