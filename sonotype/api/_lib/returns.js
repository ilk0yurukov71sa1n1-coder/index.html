// "Clients who return": which customers get which email today.
//   reminder  the day before the appointment, to anyone who left an email
//   review    the day after a visit, only with consent and a Google link
//   winback   when a service is due again (e.g. 28 days after a men's cut),
//             only with consent and when nothing new is booked yet
// Pure functions: no network, no clock of their own, so they are easy to test.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const REVIEW_GAP_DAYS = 180; // one review request per customer per half year
export const WINBACK_GAP_DAYS = 60; // one "time for your next visit" per two months
export const CATCH_UP_DAYS = 3; // a missed daily run is made up for this long

const pad = (n) => String(n).padStart(2, '0');
export const toTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// Today's date in the business's own time zone.
export const todayIn = (tz, now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const asUtc = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (day, n) => new Date(asUtc(day) + n * 864e5).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((asUtc(b) - asUtc(a)) / 864e5);
const ageDays = (iso, now) => (now - new Date(iso)) / 864e5;

export const emailHash = (business, email) => createHash('sha256').update(`${business}|${String(email).toLowerCase()}`).digest('hex');

const happened = (b) => b.status === 'new' || b.status === 'confirmed';

// rows: every booking of one business from roughly the last 100 days and the next few.
// optouts: Set of emailHash values. Returns { reminders, reviews, winbacks }, each a list of rows.
export const pickEmails = (biz, rows, optouts, now = new Date()) => {
  const today = todayIn(biz.tz, now);
  const tomorrow = addDays(today, 1);
  const may = (b) => b.email && !optouts.has(emailHash(biz.id, b.email));
  const byEmail = new Map();
  for (const b of rows) {
    if (!b.email) continue;
    const key = b.email.toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key).push(b);
  }
  const recent = (email, field, gap) => (byEmail.get(email.toLowerCase()) || []).some((b) => b[field] && ageDays(b[field], now) < gap);

  const reminders = rows.filter((b) => b.day === tomorrow && happened(b) && !b.reminded_at && may(b));

  const reviews = [];
  if (biz.reviewUrl) {
    const asked = new Set();
    for (const b of rows) {
      const ago = daysBetween(b.day, today);
      if (ago < 1 || ago > CATCH_UP_DAYS || !happened(b) || !b.email_consent || b.review_asked_at || !may(b)) continue;
      const key = b.email.toLowerCase();
      if (asked.has(key) || recent(key, 'review_asked_at', REVIEW_GAP_DAYS)) continue;
      asked.add(key);
      reviews.push(b);
    }
  }

  const winbacks = [];
  for (const [key, list] of byEmail) {
    // Anything booked from today on means they are already coming back.
    if (list.some((b) => b.day >= today && happened(b))) continue;
    const visits = list.filter((b) => b.day < today && happened(b)).sort((x, y) => (x.day < y.day ? 1 : -1));
    const last = visits[0];
    if (!last || !last.email_consent || last.winback_at || !may(last)) continue;
    const due = biz.services[last.service]?.days;
    if (!due) continue;
    const ago = daysBetween(last.day, today);
    if (ago < due || ago > due + CATCH_UP_DAYS) continue;
    if (recent(key, 'winback_at', WINBACK_GAP_DAYS)) continue;
    winbacks.push(last);
  }

  return { reminders, reviews, winbacks };
};

// Link to stop all of these emails from one business. Signed, so nobody can
// opt someone else out by guessing; it carries no expiry on purpose.
const sig = (secret, payload) => createHmac('sha256', secret).update(payload).digest('base64url');
export const stopToken = (secret, business, email) => {
  const payload = Buffer.from(`${business}|${String(email).toLowerCase()}`).toString('base64url');
  return `${payload}.${sig(secret, payload)}`;
};
export const readStopToken = (secret, token) => {
  if (!secret || typeof token !== 'string' || token.length > 600) return null;
  const [payload, s] = token.split('.');
  if (!payload || !s) return null;
  const want = Buffer.from(sig(secret, payload));
  const got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const text = Buffer.from(payload, 'base64url').toString();
  const cut = text.indexOf('|');
  if (cut < 1) return null;
  return { business: text.slice(0, cut), email: text.slice(cut + 1) };
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const firstName = (name) => String(name).trim().split(/\s+/)[0];

const shell = (bg, biz, body, stopUrl) => `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;line-height:1.6;color:#1d1416">
${body}
<p style="color:#8a7f80;font-size:12px;margin-top:28px">${esc(biz.name)}. ${bg ? 'Не искате такива имейли?' : 'Rather not get these emails?'} <a href="${esc(stopUrl)}" style="color:#8a7f80">${bg ? 'Спрете ги тук' : 'Stop them here'}</a>.</p>
</div>`;
const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#7d1d20;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">${esc(label)}</a></p>`;

// Only the stored name, service and time go into an email: never the free-text note.
export const compose = (kind, biz, b, stopUrl) => {
  const bg = b.lang !== 'en';
  const svc = biz.services[b.service];
  const what = svc ? (bg ? svc.bg : svc.en) : b.service;
  const hi = `<p>${bg ? 'Здравейте' : 'Hello'}, ${esc(firstName(b.name))},</p>`;
  if (kind === 'reminder') {
    const [y, m, d] = b.day.split('-');
    return {
      subject: bg ? `Напомняне: утре в ${toTime(b.start_min)} в ${biz.name}` : `Reminder: tomorrow at ${toTime(b.start_min)} at ${biz.name}`,
      html: shell(bg, biz, `${hi}<p>${bg ? 'Очакваме ви утре:' : 'We look forward to seeing you tomorrow:'}<br><b>${esc(what)}</b><br>${d}.${m}.${y}, ${toTime(b.start_min)}</p>
<p>${bg ? 'Ако не можете да дойдете, моля, обадете ни се, за да освободим часа за някой друг.' : 'If you can’t make it, please call us so we can give the time to someone else.'}</p>`, stopUrl),
    };
  }
  if (kind === 'review') {
    return {
      subject: bg ? `Как беше при нас, ${firstName(b.name)}?` : `How was your visit, ${firstName(b.name)}?`,
      html: shell(bg, biz, `${hi}<p>${bg ? `Благодарим, че бяхте при нас за ${esc(what.toLowerCase())}.` : `Thank you for coming in for your ${esc(what.toLowerCase())}.`} ${bg ? 'Ако ви е харесало, един кратък отзив в Google много ни помага да ни намират нови клиенти.' : 'If you liked it, a short Google review really helps new clients find us.'}</p>
${button(biz.reviewUrl, bg ? 'Напишете отзив' : 'Write a review')}
<p>${bg ? 'Ако нещо не е било наред, просто отговорете на този имейл. Искаме да знаем.' : 'If something wasn’t right, just reply to this email. We want to know.'}</p>`, stopUrl),
    };
  }
  return {
    subject: bg ? `Време ли е за следващия час, ${firstName(b.name)}?` : `Time for your next visit, ${firstName(b.name)}?`,
    html: shell(bg, biz, `${hi}<p>${bg ? `Мина малко време от последния ви час за ${esc(what.toLowerCase())}. Ако искате да запазите следващия, ето линк:` : `It has been a little while since your ${esc(what.toLowerCase())}. If you’d like to book the next one, here is the link:`}</p>
${button(biz.bookUrl, bg ? 'Запазете час' : 'Book a time')}`, stopUrl),
  };
};
