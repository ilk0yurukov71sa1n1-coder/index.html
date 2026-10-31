// Bookings for a client's page (today: the demo salon at /book).
//   GET  ?business=demo-salon   the bookable days and the times already taken
//   POST { business, service, day, time, name, phone, email?, note?, lang, company }
// Stores the request in Supabase (table: bookings), emails the owner, and
// sends the customer a receipt when they gave an email and mail is set up.
import { allowed, clientIp, guard, mask } from './_lib/shared.js';
import { bookingDays, businessById, freeSlots, readRequest, toTime } from './_lib/booking.js';
import { bookingsReady, busyBetween, insertBooking } from './_lib/booking-store.js';
import { incr } from './_lib/redis.js';
import { NOTIFY, alertHtml, firstMail, send } from './_lib/mail.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Limits on top of the 5-a-minute per-IP limit, so a script cannot fill the
// calendar or use the form to send mail. Each counter fails closed.
export const BOOKING_MAILS_PER_DAY = 100; // receipts to customers, whole site
export const BOOKING_ALERTS_PER_DAY = 100; // emails to the owner, separate from the waitlist budget
export const BOOKINGS_PER_PHONE_DAY = 3;
export const BOOKINGS_PER_BUSINESS_DAY = 60;
export const READS_PER_MINUTE = 60;
const today = () => new Date().toISOString().slice(0, 10);
const under = async (key, max, ttl = 2 * 86400) => {
  try {
    return (await incr(key, ttl)) <= max;
  } catch {
    return false;
  }
};

const receipt = ({ biz, svc, row }) => {
  const bg = row.lang === 'bg';
  const [y, m, d] = row.day.split('-');
  const when = `${d}.${m}.${y}, ${toTime(row.start_min)}`;
  const what = bg ? svc.bg : svc.en;
  // No free text from the form goes into this email, so it cannot carry someone else's message.
  return {
    subject: bg ? `Заявката ви в ${biz.name} е получена` : `Your request at ${biz.name} is in`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.6;color:#1d1416">
<p>${bg ? 'Здравейте,' : 'Hello,'}</p>
<p>${bg ? 'Получихме заявката ви:' : 'We have your request:'}<br><b>${esc(what)}</b><br>${esc(when)}</p>
<p>${bg ? 'Ще ви се обадим, за да я потвърдим.' : 'We will call you to confirm it.'}</p>
<p style="color:#8a7f80;font-size:13px">${esc(biz.name)}${bg ? ' е демо бизнес на Rollcfluence.' : ' is a Rollcfluence demo business.'}</p>
</div>`,
  };
};

const listing = async (biz) => {
  const days = bookingDays(biz);
  const busy = await busyBetween(biz.id, days[0].day, days.at(-1).day);
  return {
    business: { id: biz.id, name: biz.name, step: biz.step, services: biz.services },
    days: days.map(({ day, hours }) => ({ day, open: Boolean(hours) })),
    busy,
  };
};

export default async function handler(req, res) {
  if (!bookingsReady()) return res.status(503).json({ error: 'storage_unavailable' });

  if (req.method === 'GET') {
    const biz = businessById(req.query?.business);
    if (!biz) return res.status(404).json({ error: 'unknown_business' });
    // Reads only show taken times, so they get a looser limit than bookings:
    // people on one salon Wi-Fi or mobile network share an IP.
    if (!(await under(`rl:book-read:${clientIp(req)}`, READS_PER_MINUTE, 60))) return res.status(429).json({ error: 'too_many_requests' });
    try {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(await listing(biz));
    } catch {
      return res.status(502).json({ error: 'storage_error' });
    }
  }

  const blocked = guard(req, res);
  if (blocked) return blocked;

  const ok = await allowed(clientIp(req), 'book');
  if (!ok) return res.status(ok === null ? 503 : 429).json({ error: ok === null ? 'unavailable' : 'too_many_requests' });

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  // Honeypot filled in: pretend success so the bot learns nothing.
  if (body.company) return res.status(200).json({ ok: true });

  const checked = readRequest(body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const { biz, svc, row } = checked;


  // Still free? The table's unique start time catches two people at once;
  // this catches a longer booking that overlaps the new one.
  let busy;
  try {
    busy = (await busyBetween(biz.id, row.day, row.day)) || [];
  } catch {
    return res.status(502).json({ error: 'storage_error' });
  }
  if (!freeSlots(biz, { day: row.day, service: svc.id, busy }).includes(toTime(row.start_min))) {
    return res.status(409).json({ error: 'slot_taken' });
  }

  // Counted only for requests that would be stored, so a clash does not use them up.
  if (!(await under(`book:phone:${row.phone.replace(/\D/g, '')}:${today()}`, BOOKINGS_PER_PHONE_DAY))) return res.status(429).json({ error: 'too_many_requests' });
  if (!(await under(`book:biz:${biz.id}:${today()}`, BOOKINGS_PER_BUSINESS_DAY))) return res.status(429).json({ error: 'too_many_requests' });

  const stored = await insertBooking(row);
  if (stored === 'taken') return res.status(409).json({ error: 'slot_taken' });
  if (stored !== 'ok') return res.status(502).json({ error: 'storage_unavailable' });
  console.log(`booking: ${biz.id} ${row.day} ${toTime(row.start_min)}${row.email ? ` ${mask(row.email)}` : ''}`);

  const [y, m, d] = row.day.split('-');
  if (await under(`mail:book-alert:${today()}`, BOOKING_ALERTS_PER_DAY)) {
    await send({
      to: NOTIFY,
      subject: `New booking: ${svc.en}, ${d}.${m} ${toTime(row.start_min)}`,
      html: alertHtml(`New booking at ${biz.name}`, [
        ['Service', `${svc.en} (${svc.min} min, €${svc.eur})`],
        ['When', `${d}.${m}.${y} ${toTime(row.start_min)}`],
        ['Name', row.name],
        ['Phone', row.phone],
        ['Email', row.email],
        ['Note', row.note],
      ]),
      ...(row.email ? { replyTo: row.email } : {}),
    });
  }

  // One receipt per address a day, within the site's daily budget.
  let mailed = false;
  if (row.email && (await firstMail(`mail:book:${row.email}`, 86400)) && (await under(`mail:book-day:${today()}`, BOOKING_MAILS_PER_DAY))) {
    mailed = await send({ to: row.email, ...receipt(checked) });
  }

  return res.status(200).json({ ok: true, mailed });
}
