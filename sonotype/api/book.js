// Bookings for a client's booking page (today: the demo salon at /studio/book/).
//   GET  ?business=demo-salon   the bookable days and the times already taken
//   POST { business, service, day, time, name, phone, email?, note?, consent?, lang, company }
// Stores the request in the studio database, emails the owner, and sends the
// customer a receipt when they gave an email and mail is set up.
import { bookingDays, businessById, freeSlots, readRequest, toTime } from './_lib/booking.js';
import { busyBetween, countSince, insertBooking, storeReady } from './_lib/store.js';
import { send } from './_lib/mail.js';

export const BOOKINGS_PER_PHONE_DAY = 3;
export const BOOKINGS_PER_BUSINESS_DAY = 60;
const OWNER = process.env.NOTIFY_EMAIL || 'rollcfluence@gmail.com';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dmy = (day) => day.split('-').reverse().join('.');

const receipt = ({ biz, svc, row }) => {
  const bg = row.lang === 'bg';
  const when = `${dmy(row.day)}, ${toTime(row.start_min)}`;
  // No free text from the form goes into this email, so it cannot carry someone else's message.
  return {
    subject: bg ? `Заявката ви в ${biz.name} е получена` : `Your request at ${biz.name} is in`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;line-height:1.6;color:#1d1416">
<p>${bg ? 'Здравейте,' : 'Hello,'}</p>
<p>${bg ? 'Получихме заявката ви:' : 'We have your request:'}<br><b>${esc(bg ? svc.bg : svc.en)}</b><br>${esc(when)}</p>
<p>${bg ? 'Ще ви се обадим, за да я потвърдим.' : 'We will call you to confirm it.'}</p>
<p style="color:#8a7f80;font-size:13px">${esc(biz.name)}${bg ? ' е демо бизнес на Rollcfluence.' : ' is a Rollcfluence demo business.'}</p>
</div>`,
  };
};

const ownerAlert = ({ biz, svc, row }) => ({
  to: OWNER,
  subject: `New booking: ${svc.en}, ${dmy(row.day)} ${toTime(row.start_min)}`,
  html: `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.6;color:#1d1416"><h2 style="font-size:18px">New booking at ${esc(biz.name)}</h2>
<table style="font-size:14px">${[
    ['Service', `${svc.en} (${svc.min} min, €${svc.eur})`],
    ['When', `${dmy(row.day)} ${toTime(row.start_min)}`],
    ['Name', row.name],
    ['Phone', row.phone],
    ['Email', row.email],
    ['Emails after the visit', row.email_consent ? 'yes' : 'no'],
    ['Note', row.note],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#685c59;vertical-align:top">${esc(k)}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join('')}</table></div>`,
  ...(row.email ? { replyTo: row.email } : {}),
});

const startOfUtcDay = () => `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!storeReady()) return res.status(503).json({ error: 'storage_unavailable' });

  if (req.method === 'GET') {
    const biz = businessById(req.query?.business);
    if (!biz) return res.status(404).json({ error: 'unknown_business' });
    try {
      const days = bookingDays(biz);
      const busy = await busyBetween(biz.id, days[0].day, days.at(-1).day);
      return res.status(200).json({
        business: { id: biz.id, name: biz.name, step: biz.step, services: biz.services.map(({ id, min, eur, bg, en }) => ({ id, min, eur, bg, en })) },
        days: days.map(({ day, hours }) => ({ day, open: Boolean(hours) })),
        busy,
      });
    } catch {
      return res.status(502).json({ error: 'storage_error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  // Same-site only: the page posts JSON from this origin.
  if (!String(req.headers?.['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'json_only' });

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  // Honeypot filled in: pretend success so the bot learns nothing.
  if (body.company) return res.status(200).json({ ok: true });

  const checked = readRequest(body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const { biz, svc, row } = checked;

  try {
    // Still free? The table's overlap rule catches two people at once; this gives a clean answer first.
    const busy = await busyBetween(biz.id, row.day, row.day);
    if (!freeSlots(biz, { day: row.day, service: svc.id, busy }).includes(toTime(row.start_min))) return res.status(409).json({ error: 'slot_taken' });
    // Limits, so a script cannot fill the calendar or use the form to send mail. They fail closed.
    const since = startOfUtcDay();
    if ((await countSince(biz.id, since, row.phone)) >= BOOKINGS_PER_PHONE_DAY) return res.status(429).json({ error: 'too_many_requests' });
    if ((await countSince(biz.id, since)) >= BOOKINGS_PER_BUSINESS_DAY) return res.status(429).json({ error: 'too_many_requests' });
  } catch {
    return res.status(502).json({ error: 'storage_error' });
  }

  const stored = await insertBooking(row);
  if (stored === 'taken') return res.status(409).json({ error: 'slot_taken' });
  if (stored !== 'ok') return res.status(502).json({ error: 'storage_unavailable' });

  await send(ownerAlert(checked));
  const mailed = row.email ? await send({ to: row.email, ...receipt(checked) }) : false;
  return res.status(200).json({ ok: true, mailed });
}
