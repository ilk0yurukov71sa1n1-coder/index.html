import { DEMO, demoAdmin, demoApi } from './demo';

// Calls the dashboard API with the session cookie. Never throws: returns
// { ok, status, data, error } so every screen can show a plain message.
const MESSAGES = {
  signed_out: 'You were signed out. Sign in again.',
  invalid_base_url: 'Use the provider\'s public https base URL, like https://api.mistral.ai/v1.',
  invalid_price: 'Prices must be numbers of dollars per 1M tokens, or empty.',
  invalid_answers: 'Answer every question to see your report.',
  storage_unavailable: 'The database is not connected yet, so nothing can be saved.',
  storage_error: 'The database did not answer. Try again in a moment.',
  encryption_unavailable: 'Saving provider keys is not switched on yet. Try again soon.',
  email_unavailable: 'Email is not switched on yet, so nothing can be emailed.',
  invalid_provider_key: 'That does not look like a valid key for this provider.',
  invalid_daily_cap_usd: 'The daily cap must be a number of dollars, or empty for no cap.',
  invalid_monthly_cap_usd: 'The monthly cap must be a number of dollars, or empty for no cap.',
  invalid_rpm_limit: 'Requests per minute must be a whole number from 1 to 10,000.',
  invalid_allowed_models: 'Models must be names like gpt-4o-mini, separated by commas.',
  invalid_name: 'Give the key a name of up to 60 characters.',
  too_many_keys: 'You have reached the active key limit for your plan. Revoke one, or upgrade in Plan and billing.',
  nobody_to_approve: 'Nobody to approve: no confirmed signups are waiting.',
  too_many_requests: 'Too many tries. Wait a minute and try again.',
  login_unavailable: 'Sign-in is not switched on yet. Email rollcfluence@gmail.com and we will help.',
  invalid_ip_allowlist: 'IP allow-list entries must be addresses like 203.0.113.7 or ranges like 203.0.113.0/24, separated by commas.',
  invalid_blocked_countries: 'Countries must be two-letter codes like RU or KP, separated by commas.',
  invalid_max_tokens: 'Max output tokens must be a whole number from 1 to 1,000,000, or empty.',
  invalid_expires_at: 'The expiry date must be in the future.',
  invalid_events: 'Pick at least one event to be alerted about.',
  invalid_email: 'That does not look like an email address.',
  invalid_url: 'That does not look like a valid https URL.',
  invalid_slack_url: 'Slack URLs start with https://hooks.slack.com/services/',
  invalid_discord_url: 'Discord URLs start with https://discord.com/api/webhooks/',
  invalid_webhook_url: 'Use a public https URL (no IP addresses, ports or local names).',
  too_many_channels: 'You have the maximum of 10 alert channels. Remove one first.',
  alert_failed: 'The channel did not accept the test alert. Check the address or URL.',
  reveal_used: 'That key link was already used, so the key cannot be shown again.',
  not_found: 'That item no longer exists. Refresh the page.',
  invalid_plan: 'That plan cannot be bought online.',
  billing_unavailable: 'Payments are not switched on yet. Email rollcfluence@gmail.com and we will help.',
  billing_error: 'The payment service did not answer. Nothing was charged. Try again in a moment.',
  plan_managed: 'Your plan is arranged with us directly. Email rollcfluence@gmail.com to change it.',
  already_on_plan: 'You are already on that plan.',
  no_billing: 'There is no billing account yet. Upgrade first.',
  network: 'Could not reach the server. Check your connection.',
};
export const explain = (code) => MESSAGES[code] || 'Something went wrong. Try again.';

export const api = async (r, { method = 'GET', body, query = '' } = {}) => {
  if (DEMO) return demoApi(r, { method, body, query });
  try {
    const res = await fetch(`/api/dash?r=${r}${query}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : explain(data.error) };
  } catch {
    return { ok: false, status: 0, data: {}, error: explain('network') };
  }
};

export const adminApi = async (r, opts = {}) => {
  if (DEMO) return demoAdmin(r, opts);
  try {
    const res = await fetch(`/api/admin?r=${r}`, {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data, error: res.ok ? null : explain(data.error) };
  } catch {
    return { ok: false, data: {}, error: explain('network') };
  }
};

export const usd = (n, digits = 2) => (n == null ? 'No cap' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, n && n < 0.01 ? 4 : digits) })}`);
export const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');
