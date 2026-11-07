// Turns a Stripe subscription into the plan we enforce. Always re-reads the
// subscription from Stripe, so events that arrive late or twice cannot
// leave an account on the wrong plan.
import { db } from './db.js';
import { PAID } from './plans.js';
import { stripe } from './stripe.js';

const LIVE = ['active', 'trialing', 'past_due']; // past_due keeps the plan while Stripe retries the card

const planFromSub = (sub) => {
  const price = sub.items?.data?.[0]?.price;
  const plan = price?.metadata?.plan || String(price?.lookup_key || '').split('_')[1];
  return PAID.includes(plan) ? plan : null;
};

export const syncSubscription = async (subscriptionId, accountHint) => {
  const sub = await stripe('GET', `subscriptions/${encodeURIComponent(subscriptionId)}`);
  const account =
    (accountHint && (await db.accountById(accountHint))) ||
    (sub.metadata?.account_id && (await db.accountById(sub.metadata.account_id))) ||
    (await db.accountByCustomer(sub.customer));
  if (!account) return null;
  if (account.plan === 'business' && !account.stripe_subscription_id) return account; // arranged by hand
  // An old subscription ending must not undo a newer one.
  if (account.stripe_subscription_id && account.stripe_subscription_id !== sub.id && !LIVE.includes(sub.status)) return account;
  const plan = planFromSub(sub);
  const live = LIVE.includes(sub.status) && plan;
  const before = account.plan;
  const updated = await db.updateAccount(account.id, {
    plan: live ? plan : 'starter',
    stripe_customer_id: sub.customer,
    stripe_subscription_id: live ? sub.id : null,
    plan_status: sub.status,
    plan_renews_at: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    plan_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  });
  const after = live ? plan : 'starter';
  if (before !== after) await db.logAudit({ account_id: account.id, action: 'plan_changed', detail: `${before} → ${after} (${sub.status})` }).catch(() => {});
  return updated;
};
