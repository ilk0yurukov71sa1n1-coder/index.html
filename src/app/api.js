// Calls the dashboard API with the session cookie. Never throws: returns
// { ok, status, data, error } so every screen can show a plain message.
const MESSAGES = {
  signed_out: 'You were signed out. Sign in again.',
  storage_unavailable: 'The database is not connected yet, so nothing can be saved.',
  storage_error: 'The database did not answer. Try again in a moment.',
  encryption_unavailable: 'Provider keys cannot be saved until ENCRYPTION_KEY is set in Vercel.',
  email_unavailable: 'Email is not set up yet (RESEND_API_KEY), so keys cannot be sent.',
  invalid_provider_key: 'That does not look like a valid key for this provider.',
  invalid_daily_cap_usd: 'The daily cap must be a number of dollars, or empty for no cap.',
  invalid_monthly_cap_usd: 'The monthly cap must be a number of dollars, or empty for no cap.',
  invalid_rpm_limit: 'Requests per minute must be a whole number from 1 to 10,000.',
  invalid_allowed_models: 'Models must be names like gpt-4o-mini, separated by commas.',
  invalid_name: 'Give the key a name of up to 60 characters.',
  too_many_keys: 'You have the maximum of 20 active keys. Revoke one first.',
  nobody_to_approve: 'Nobody to approve: no confirmed signups are waiting.',
  too_many_requests: 'Too many tries. Wait a minute and try again.',
  login_unavailable: 'Sign-in is not switched on yet. Email rollcfluence@gmail.com and we will help.',
  network: 'Could not reach the server. Check your connection.',
};
export const explain = (code) => MESSAGES[code] || 'Something went wrong. Try again.';

export const api = async (r, { method = 'GET', body, query = '' } = {}) => {
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
