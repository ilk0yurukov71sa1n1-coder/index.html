// Owner console: what is set up, how the business is doing, and milestones.
// Pure functions over data the admin route has already read, so they are
// easy to test and the demo dashboard can reuse them.
import { PAID, PLANS } from './plan-list.js';

const SUPABASE_SQL = 'https://supabase.com/dashboard/project/lzqwaoglouiuutzeucxt/sql/new';
const VERCEL_ENV = 'https://vercel.com/d?to=%2F%5Bteam%5D%2Frollcfluence-shield%2Fsettings%2Fenvironment-variables';
const ADD_ENV = (name, value) => [
  `Open the Vercel environment variables page (button below).`,
  `Click "Add Environment Variable". Key: ${name}. Value: ${value}.`,
  'Tick Production, then Save.',
  'Go to Deployments, open the top one, click the three dots, then Redeploy.',
];
const HEX = 'a random 64-character code. On a Mac, open Terminal and run: openssl rand -hex 32, then copy what it prints';

// Each step: done is true, false, or null when it can only be ticked by hand.
export const setupSteps = ({ health, sqlBilling, sqlOnboarding, stripeMode }) => [
  { id: 'storage', group: 'Basics', title: 'Database connected', done: health.storage, how: ['Already set up when this is ticked. If not, check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'], link: VERCEL_ENV },
  { id: 'rate', group: 'Basics', title: 'Rate limiting connected', done: health.rateLimit, how: ['Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.'], link: VERCEL_ENV },
  {
    id: 'sql_billing',
    group: 'Database',
    title: 'Run the billing update',
    done: sqlBilling,
    how: ['Open the SQL editor (button below).', 'In GitHub, open supabase/upgrade-2026-10-17-billing.sql, click Raw, select all and copy.', 'Paste into the SQL editor and click Run. "Success. No rows returned" means it worked.'],
    link: SUPABASE_SQL,
  },
  {
    id: 'sql_onboarding',
    group: 'Database',
    title: 'Run the sign-up check update',
    done: sqlOnboarding,
    how: ['Open the SQL editor (button below).', 'Copy supabase/upgrade-2026-10-17-onboarding.sql the same way.', 'Paste and click Run.'],
    link: SUPABASE_SQL,
  },
  { id: 'email', group: 'Sign-up', title: 'Email sending (RESEND_API_KEY)', done: health.email, how: ['In Resend, open API Keys and create a key with "Sending access".', ...ADD_ENV('RESEND_API_KEY', 'the key Resend shows you')], link: VERCEL_ENV, extra: 'https://resend.com/api-keys' },
  {
    id: 'domain',
    group: 'Sign-up',
    title: 'Send email from your own domain (MAIL_FROM)',
    done: Boolean(process.env.MAIL_FROM),
    how: ['Until this is done, emails reach only the address your Resend account was opened with, so customers get no sign-in links or keys.', 'In Resend, open Domains, add your domain and copy the DNS records it shows to your domain provider.', ...ADD_ENV('MAIL_FROM', 'Rollcfluence <shield@your-domain>')],
    link: VERCEL_ENV,
    extra: 'https://resend.com/domains',
  },
  { id: 'verify', group: 'Sign-up', title: 'Sign-in links (VERIFY_SECRET)', done: health.verification, how: ADD_ENV('VERIFY_SECRET', HEX), link: VERCEL_ENV },
  { id: 'encryption', group: 'Sign-up', title: 'Provider key encryption (ENCRYPTION_KEY)', done: health.encryption, how: [...ADD_ENV('ENCRYPTION_KEY', `${HEX}. Use a different code from VERIFY_SECRET`), 'Keep a copy somewhere safe: without it, saved provider keys cannot be read.'], link: VERCEL_ENV },
  {
    id: 'payments',
    group: 'Payments',
    title: `Card payments (STRIPE_SECRET_KEY)${health.payments ? `, ${stripeMode} mode` : ''}`,
    done: health.payments,
    how: ['In Stripe, open Developers, then API keys, and reveal the Secret key.', ...ADD_ENV('STRIPE_SECRET_KEY', 'the secret key (starts with sk_test_ while testing)')],
    link: VERCEL_ENV,
    extra: 'https://dashboard.stripe.com/test/apikeys',
  },
  {
    id: 'webhook',
    group: 'Payments',
    title: 'Payment updates (STRIPE_WEBHOOK_SECRET)',
    done: health.paymentWebhook,
    how: ['In Stripe, open Developers, then Webhooks, then Add endpoint.', 'Endpoint URL: https://rollcfluence-shield.vercel.app/api/stripe-webhook', 'Events: checkout.session.completed, customer.subscription.created, .updated, .deleted, invoice.paid, invoice.payment_failed.', ...ADD_ENV('STRIPE_WEBHOOK_SECRET', 'the Signing secret (starts with whsec_)')],
    link: VERCEL_ENV,
    extra: 'https://dashboard.stripe.com/test/webhooks',
  },
  { id: 'portal', group: 'Payments', title: 'Save the Stripe customer portal', done: null, how: ['Open the customer portal settings (button below) and click Save once. Customers can then cancel or change cards themselves.'], link: 'https://dashboard.stripe.com/test/settings/billing/portal' },
  { id: 'live', group: 'Payments', title: 'Switch payments to live mode', done: health.payments ? stripeMode === 'live' : false, how: ['Only after the Terms and Privacy pages have been checked by a lawyer and Stripe Tax is on for EU VAT.', 'Repeat the two Stripe steps above with the live keys (sk_live_, a live webhook).'], link: 'https://dashboard.stripe.com/settings/tax' },
  { id: 'chat', group: 'Website', title: 'AI chat assistant (ANTHROPIC_API_KEY)', done: Boolean(health.chat), how: ['In the Claude Console, open API Keys, then Create Key, and add a monthly spend limit under Limits.', ...ADD_ENV('ANTHROPIC_API_KEY', 'the key (starts with sk-ant-)'), 'Until then the chat answers from the FAQ.'], link: VERCEL_ENV, extra: 'https://console.anthropic.com/settings/keys' },
  { id: 'repo', group: 'Security', title: 'Make the GitHub repository private and turn on 2FA', done: null, how: ['GitHub repository, Settings, scroll to Danger Zone, Change visibility, Private.', 'GitHub, your photo, Settings, Password and authentication, Enable two-factor authentication.'], link: 'https://github.com/ilk0yurukov71sa1n1-coder/index.html/settings' },
  { id: 'firewall', group: 'Security', title: 'Turn on the Vercel Firewall rules', done: null, how: ['Tell Claude "yes, firewall" in the project chat and it sets the rules up with you.'], link: null },
  { id: 'upstash', group: 'Costs', title: 'Move rate limiting to the fixed $10 plan', done: null, how: ['Upstash console, your database, Plan, choose Fixed $10. This is the biggest margin gain.'], link: 'https://console.upstash.com/' },
  { id: 'pro', group: 'Costs', title: 'Move hosting to Vercel Pro before launch', done: null, how: ['Vercel, Settings, Billing, Upgrade to Pro. Hobby does not allow commercial use.'], link: 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fsettings%2Fbilling' },
  { id: 'entity', group: 'Legal', title: 'Send your company details for the imprint', done: null, how: ['Legal name, address, company ID and country, in the project chat. They complete the imprint and the governing-law clause.'], link: null },
  { id: 'lawyer', group: 'Legal', title: 'Have a lawyer check the legal pages', done: null, how: ['Send them /privacy, /terms, /dpa and /acceptable-use.'], link: '/terms' },
];

const ACTIVE = ['active', 'trialing', 'past_due'];

export const metrics = ({ accounts, waitlist, usage }) => {
  const byPlan = Object.fromEntries(Object.keys(PLANS).map((p) => [p, 0]));
  let mrrCents = 0;
  let paying = 0;
  for (const a of accounts) {
    byPlan[a.plan] = (byPlan[a.plan] || 0) + 1;
    // Without the billing columns, count the plan as it stands.
    const live = a.plan_status === undefined || ACTIVE.includes(a.plan_status);
    if (PAID.includes(a.plan) && live) {
      mrrCents += PLANS[a.plan].cents;
      paying += 1;
    }
  }
  const week = Date.now() - 7 * 864e5;
  return {
    accounts: accounts.length,
    newThisWeek: accounts.filter((a) => Date.parse(a.created_at) >= week).length,
    byPlan,
    paying,
    business: byPlan.business,
    mrr: mrrCents / 100,
    waitlist: waitlist.length,
    confirmed: waitlist.filter((w) => w.verified).length,
    letIn: waitlist.filter((w) => w.approved_at).length,
    signupsThisWeek: waitlist.filter((w) => Date.parse(w.created_at) >= week).length,
    ...usage,
  };
};

// Paid invoices from Stripe, newest first, in a small shape for the browser.
export const paymentsFrom = (invoices) =>
  invoices
    .filter((i) => i.amount_paid > 0)
    .map((i) => ({ id: i.id, amount: i.amount_paid / 100, currency: String(i.currency || 'eur').toUpperCase(), email: i.customer_email || null, at: new Date(i.created * 1000).toISOString(), url: i.hosted_invoice_url || null }))
    .sort((a, b) => b.at.localeCompare(a.at));

const nth = (rows, n) => rows[n - 1]?.created_at || null;
const byDate = (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''));

export const milestones = ({ waitlist, accounts, firstRequest, firstBlocked, payments, mrr, paying }) => {
  const out = [];
  const add = (group, id, title, value, target, at = null) => out.push({ group, id, title, value: Math.min(value, target), target, reached: value >= target, at: value >= target ? at : null });
  const signups = [...waitlist].sort(byDate);
  for (const n of [1, 10, 25, 50, 100, 250, 500, 1000]) add('Waitlist', `signups-${n}`, n === 1 ? 'First person on the waitlist' : `${n} people on the waitlist`, signups.length, n, nth(signups, n));
  const confirmed = signups.filter((w) => w.verified);
  add('Waitlist', 'confirmed-1', 'First confirmed email', confirmed.length, 1, nth(confirmed, 1));
  const custs = [...accounts].sort(byDate);
  for (const n of [1, 10, 100]) add('Customers', `accounts-${n}`, n === 1 ? 'First customer let in' : `${n} customers`, custs.length, n, nth(custs, n));
  add('Product', 'request-1', 'First protected request', firstRequest ? 1 : 0, 1, firstRequest);
  add('Product', 'blocked-1', 'First attack or overspend stopped', firstBlocked ? 1 : 0, 1, firstBlocked);
  const paid = [...payments].sort((a, b) => a.at.localeCompare(b.at));
  add('Money', 'payment-1', 'First payment', paid.length, 1, paid[0]?.at);
  let sum = 0;
  const crossed = {};
  for (const p of paid) {
    sum += p.amount;
    for (const t of [100, 1000, 10000, 100000]) if (sum >= t && !crossed[t]) crossed[t] = p.at;
  }
  for (const t of [100, 1000, 10000, 100000]) add('Money', `collected-${t}`, `€${t.toLocaleString('en-US')} collected`, sum, t, crossed[t]);
  for (const n of [1, 10, 50, 100]) add('Money', `paying-${n}`, n === 1 ? 'First paying customer' : `${n} paying customers`, paying, n, n === 1 ? paid[0]?.at : null);
  for (const t of [100, 500, 1000, 5000, 10000]) add('Money', `mrr-${t}`, `€${t.toLocaleString('en-US')} a month in plans`, mrr, t);
  return out;
};
