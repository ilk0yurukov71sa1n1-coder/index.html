// Stripe over its REST API (no SDK). Needs STRIPE_SECRET_KEY; the webhook
// also needs STRIPE_WEBHOOK_SECRET. Prices are created on first use with a
// lookup key, so nothing has to be set up by hand in the Stripe dashboard.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PLANS } from './plans.js';

const env = process.env;
const API = () => env.STRIPE_API_URL || 'https://api.stripe.com';
export const stripeReady = () => /^(sk|rk)_(test|live)_/.test(String(env.STRIPE_SECRET_KEY || ''));
export const stripeMode = () => (String(env.STRIPE_SECRET_KEY || '').includes('_live_') ? 'live' : 'test');

// Stripe wants nested form fields: a[b][0]=c.
const form = (obj, prefix = '', out = new URLSearchParams()) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, name, out);
    else out.append(name, String(v));
  }
  return out;
};

export const stripe = async (method, path, params) => {
  const qs = method === 'GET' && params ? `?${form(params)}` : '';
  const r = await fetch(`${API()}/v1/${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body: method === 'GET' || !params ? undefined : form(params).toString(),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error(`stripe ${method} ${path.split('/')[0]} failed: ${r.status} ${data?.error?.code || ''}`);
    throw new Error('stripe_error');
  }
  return data;
};

// The monthly price for a plan, created once and found again by lookup key.
export const priceFor = async (plan) => {
  const lookup = `shield_${plan}_monthly_eur`;
  const found = await stripe('GET', 'prices', { lookup_keys: [lookup], active: 'true', limit: 1 });
  if (found.data?.[0]) return found.data[0].id;
  const p = PLANS[plan];
  const price = await stripe('POST', 'prices', {
    currency: 'eur',
    unit_amount: p.cents,
    recurring: { interval: 'month' },
    tax_behavior: 'exclusive',
    lookup_key: lookup,
    product_data: { name: `Rollcfluence Shield ${p.name}`, metadata: { plan } },
    metadata: { plan },
  });
  return price.id;
};

// Checks the Stripe-Signature header against the raw body. Rejects anything older than 5 minutes.
export const verifyWebhook = (raw, header, secret = env.STRIPE_WEBHOOK_SECRET) => {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = String(header).split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex'));
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), expected));
};
