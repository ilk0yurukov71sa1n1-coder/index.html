// POST /api/stripe-webhook  Stripe tells us about payments and subscriptions.
// The body is read raw, because the signature covers the exact bytes.
import { syncSubscription } from './_lib/billing.js';
import { dbReady } from './_lib/db.js';
import { stripeReady, verifyWebhook } from './_lib/stripe.js';

export const config = { api: { bodyParser: false } };

const rawBody = async (req) => {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
};

const HANDLED = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed', 'invoice.paid'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!stripeReady() || !dbReady()) return res.status(503).json({ error: 'billing_unavailable' });
  const raw = await rawBody(req);
  if (raw.length > 512 * 1024 || !verifyWebhook(raw, req.headers['stripe-signature'])) return res.status(400).json({ error: 'bad_signature' });

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'bad_json' });
  }
  if (!HANDLED.includes(event.type)) return res.status(200).json({ received: true });

  const obj = event.data?.object || {};
  const subscriptionId = event.type.startsWith('customer.subscription') ? obj.id : obj.subscription;
  if (!subscriptionId) return res.status(200).json({ received: true });
  try {
    await syncSubscription(String(subscriptionId), event.type === 'checkout.session.completed' ? obj.client_reference_id : null);
  } catch {
    return res.status(500).json({ error: 'sync_failed' }); // Stripe retries
  }
  return res.status(200).json({ received: true });
}
