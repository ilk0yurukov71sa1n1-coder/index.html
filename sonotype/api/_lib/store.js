// The studio database (Supabase project rollcfluence-studio-db), over REST
// with the server-only key. STUDIO_DB=memory keeps everything in this
// process, for the tests.
const env = process.env;
// Connecting the Supabase project to this Vercel project fills in the plain names.
const URL_ = env.STUDIO_SUPABASE_URL || env.SUPABASE_URL;
const KEY = env.STUDIO_SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const memory = () => env.STUDIO_DB === 'memory';
export const storeReady = () => memory() || Boolean(URL_ && KEY);

export const mem = { bookings: [], optouts: [] };

// Newer projects use a sb_secret_ key, which goes only in the apikey header.
const headers = () => ({ apikey: KEY, ...(String(KEY).startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}), 'Content-Type': 'application/json' });
const rest = (method, path, body, prefer) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { ...headers(), ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

// Supabase returns at most 1000 rows per request, so long lists are read in pages.
const PAGE = 1000;
const readAll = async (path) => {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { ...headers(), Range: `${from}-${from + PAGE - 1}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('db_error');
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
};

// One business's bookings between two days (inclusive).
export const bookingsBetween = async (business, from, to) => {
  if (memory()) return mem.bookings.filter((b) => b.business === business && b.day >= from && b.day <= to);
  const q = new URLSearchParams({ select: 'id,business,service,day,start_min,name,email,lang,status,email_consent,reminded_at,review_asked_at,winback_at', business: `eq.${business}`, order: 'day,start_min,id' });
  q.append('day', `gte.${from}`);
  q.append('day', `lte.${to}`);
  return readAll(`bookings?${q}`);
};

export const optoutsFor = async (business) => {
  if (memory()) return new Set(mem.optouts.filter((o) => o.business === business).map((o) => o.email_hash));
  const rows = await readAll(`mail_optout?select=email_hash&business=eq.${encodeURIComponent(business)}&order=email_hash`);
  return new Set(rows.map((o) => o.email_hash));
};

const FIELDS = new Set(['reminded_at', 'review_asked_at', 'winback_at']);
// Claims a booking for one email before it is sent: sets the time only if it
// is still empty, and returns true only to the run that set it. Two runs at
// once (Vercel may call a cron twice) can never both send.
export const claim = async (id, field) => {
  if (!FIELDS.has(field)) throw new Error('bad_field');
  const at = new Date().toISOString();
  if (memory()) {
    const b = mem.bookings.find((x) => x.id === id);
    if (!b || b[field]) return false;
    b[field] = at;
    return true;
  }
  const r = await rest('PATCH', `bookings?id=eq.${Number(id)}&${field}=is.null&select=id`, { [field]: at }, 'return=representation');
  if (!r.ok) return false;
  return (await r.json()).length === 1;
};

// Gives a claim back when the email could not be sent, so the next run tries again.
export const unclaim = async (id, field) => {
  if (!FIELDS.has(field)) throw new Error('bad_field');
  if (memory()) {
    const b = mem.bookings.find((x) => x.id === id);
    if (b) b[field] = null;
    return true;
  }
  const r = await rest('PATCH', `bookings?id=eq.${Number(id)}`, { [field]: null }, 'return=minimal');
  return r.ok;
};

export const addOptout = async (business, email_hash) => {
  if (memory()) {
    if (!mem.optouts.some((o) => o.business === business && o.email_hash === email_hash)) mem.optouts.push({ business, email_hash });
    return true;
  }
  const r = await rest('POST', 'mail_optout?on_conflict=business,email_hash', { business, email_hash }, 'resolution=ignore-duplicates,return=minimal');
  return r.ok;
};
