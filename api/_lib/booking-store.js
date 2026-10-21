// Where bookings live: the Supabase table `bookings` (supabase/upgrade-2026-10-21-bookings.sql).
// ROLLC_DB=memory keeps them in this process, for the local tests.
import { supaHeaders } from './shared.js';

const env = process.env;
const URL_ = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const memory = env.ROLLC_DB === 'memory';
export const bookingsReady = () => memory || Boolean(URL_ && KEY);

const mem = [];
export const _memBookings = mem;

const rest = (method, path, body, prefer) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { ...supaHeaders(KEY), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

const live = (b) => b.status !== 'cancelled';

// Taken times between two days: only when, never who.
export const busyBetween = async (business, from, to) => {
  if (memory) return mem.filter((b) => b.business === business && b.day >= from && b.day <= to && live(b)).map(({ day, start_min, duration_min }) => ({ day, start_min, duration_min }));
  const q = new URLSearchParams({ select: 'day,start_min,duration_min', business: `eq.${business}`, status: 'neq.cancelled', order: 'day,start_min', limit: '2000' });
  q.append('day', `gte.${from}`);
  q.append('day', `lte.${to}`);
  const r = await rest('GET', `bookings?${q}`);
  if (!r.ok) throw new Error('db_error');
  return r.json();
};

// Stores a booking. Returns 'ok', 'taken' (that start time was just booked) or 'error'.
export const insertBooking = async (row) => {
  if (memory) {
    if (mem.some((b) => b.business === row.business && b.day === row.day && b.start_min === row.start_min && live(b))) return 'taken';
    mem.push({ id: mem.length + 1, status: 'new', created_at: new Date().toISOString(), ...row });
    return 'ok';
  }
  const r = await rest('POST', 'bookings', row, 'return=minimal').catch(() => ({ ok: false, status: 'timeout' }));
  if (r.status === 409) return 'taken';
  if (!r.ok) console.error(`bookings store failed: ${r.status}`);
  return r.ok ? 'ok' : 'error';
};

// The newest bookings, for the owner console.
export const recentBookings = async (limit = 30) => {
  if (memory) return mem.slice(-limit).reverse();
  const r = await rest('GET', `bookings?select=id,business,service,day,start_min,duration_min,name,phone,email,note,lang,status,created_at&order=created_at.desc&limit=${limit}`);
  if (!r.ok) throw new Error('db_error');
  return r.json();
};
