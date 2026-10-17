// Small helpers shared by the dashboard, admin and auth routers.
export const body = (req) => (typeof req.body === 'object' && req.body !== null ? req.body : {});

// Writes from the browser must be JSON and come from our own origin.
export const sameOrigin = (req) => {
  if (req.method === 'GET') return true;
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false; // "null" or garbage
    }
  }
  if (req.method !== 'DELETE' && !String(req.headers['content-type'] || '').startsWith('application/json')) return false;
  return true;
};

export const baseUrl = (req) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return `${proto}://${host}`;
};

export const fail = (res, status, error) => res.status(status).json({ error });

// Dollars from the dashboard to integer micros, or null for "no cap".
export const toMicros = (usd) => {
  if (usd === null || usd === '' || usd === undefined) return null;
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return undefined;
  return Math.round(n * 1_000_000);
};

export const dayStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
export const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
