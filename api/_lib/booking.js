// Booking rules shared by the booking page and /api/book: the business,
// its services and opening hours, which times are free, and what a valid
// request looks like. No Node imports here, so the browser can use it too.

// The demo business. A real client gets its own entry with its own details.
export const DEMO = {
  id: 'demo-salon',
  name: 'Salon Aurora',
  tz: 'Europe/Sofia',
  step: 30, // minutes between start times
  leadMin: 120, // earliest booking: 2 hours from now
  days: 21, // how far ahead people can book
  // Minutes from midnight, by weekday (0 = Sunday, closed).
  hours: { 1: [540, 1140], 2: [540, 1140], 3: [540, 1140], 4: [540, 1140], 5: [540, 1140], 6: [600, 960] },
  services: [
    { id: 'cut-women', min: 60, eur: 35, bg: 'Дамско подстригване и оформяне', en: 'Women’s haircut and styling' },
    { id: 'cut-men', min: 30, eur: 18, bg: 'Мъжко подстригване', en: 'Men’s haircut' },
    { id: 'colour', min: 90, eur: 55, bg: 'Боядисване на корени', en: 'Root colour' },
    { id: 'blow-dry', min: 30, eur: 20, bg: 'Сешоар', en: 'Blow-dry' },
    { id: 'manicure', min: 45, eur: 22, bg: 'Маникюр', en: 'Manicure' },
    { id: 'gel-nails', min: 60, eur: 30, bg: 'Гел лак', en: 'Gel nails' },
  ],
};

export const BUSINESSES = { [DEMO.id]: DEMO };
// Own keys only, so "constructor" or "__proto__" never count as a business.
export const businessById = (id) => (Object.hasOwn(BUSINESSES, String(id)) ? BUSINESSES[String(id)] : null);

export const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/;
// No ? & % or quotes, so an address cannot smuggle extra fields into a mailto: link.
export const EMAIL = /^[^\s@?&%<>"',;]+@[^\s@?&%<>"',;]+\.[^\s@?&%<>"',;]{2,}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (n) => String(n).padStart(2, '0');
export const toTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const toMin = (time) => {
  const m = TIME.exec(String(time));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Today's date and the minute of the day in the business's own time zone.
export const nowIn = (tz, now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
};

// Calendar arithmetic on YYYY-MM-DD strings, independent of any time zone.
const asUtc = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const addDays = (day, n) => {
  const t = asUtc(day);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
export const weekday = (day) => asUtc(day).getUTCDay();
const realDay = (day) => DAY.test(day) && asUtc(day).toISOString().slice(0, 10) === day;

// The days people can pick, from today on, with their opening hours.
export const bookingDays = (biz, now = new Date()) => {
  const today = nowIn(biz.tz, now).day;
  return Array.from({ length: biz.days }, (_, i) => {
    const day = addDays(today, i);
    return { day, hours: biz.hours[weekday(day)] || null };
  });
};

// Free start times for one service on one day, given the bookings already
// taken that day ([{ start_min, duration_min }]).
export const freeSlots = (biz, { day, service, busy = [], now = new Date() }) => {
  const svc = biz.services.find((s) => s.id === service);
  const hours = biz.hours[weekday(day)];
  if (!svc || !hours || !realDay(day)) return [];
  const here = nowIn(biz.tz, now);
  const last = addDays(here.day, biz.days - 1);
  if (day < here.day || day > last) return [];
  const earliest = day === here.day ? here.min + biz.leadMin : 0;
  const out = [];
  for (let start = hours[0]; start + svc.min <= hours[1]; start += biz.step) {
    if (start < earliest) continue;
    const clash = busy.some((b) => start < b.start_min + b.duration_min && b.start_min < start + svc.min);
    if (!clash) out.push(toTime(start));
  }
  return out;
};

// Cut by characters, not UTF-16 units, so an emoji is never split in half.
const clean = (v, max) => Array.from(String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).slice(0, max).join('').trim();

// Checks a booking request. Returns { row } ready to store, or { error }.
// Whether the time is still free is checked separately against storage.
export const readRequest = (body, now = new Date()) => {
  const biz = businessById(body?.business);
  if (!biz) return { error: 'unknown_business' };
  const svc = biz.services.find((s) => s.id === body.service);
  if (!svc) return { error: 'unknown_service' };
  const day = String(body.day || '');
  const start = toMin(body.time);
  if (!realDay(day) || start === null) return { error: 'invalid_time' };
  const name = clean(body.name, 80);
  if (name.length < 2) return { error: 'invalid_name' };
  const phone = clean(body.phone, 20);
  if (!PHONE.test(phone)) return { error: 'invalid_phone' };
  const email = clean(body.email, 254).toLowerCase();
  if (email && !EMAIL.test(email)) return { error: 'invalid_email' };
  const note = clean(body.note, 300);
  const lang = body.lang === 'en' ? 'en' : 'bg';
  // The time must be one the page could have offered on an empty day.
  if (!freeSlots(biz, { day, service: svc.id, now }).includes(toTime(start))) return { error: 'invalid_time' };
  return {
    biz,
    svc,
    row: { business: biz.id, service: svc.id, day, start_min: start, duration_min: svc.min, name, phone, email: email || null, note: note || null, lang },
  };
};
