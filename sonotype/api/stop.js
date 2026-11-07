// The "stop these emails" link in every Clients-who-return email.
// GET shows a confirm button (mail scanners open links, so a GET never opts
// anyone out); POST from that button stores the opt-out as a hash.
import { businessById } from './_lib/businesses.js';
import { emailHash, readStopToken } from './_lib/returns.js';
import { addOptout, storeReady } from './_lib/store.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const page = (body) => `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Rollcfluence</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f4f1ec;color:#1d1416;max-width:520px;margin:0 auto;padding:48px 20px;line-height:1.6">${body}</body></html>`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const token = req.method === 'POST' ? req.body?.t : req.query?.t;
  const who = readStopToken(process.env.RETURNS_SECRET, token);
  const biz = who && businessById(who.business);
  if (!biz) return res.status(400).send(page('<p>Този линк не е валиден. / This link is not valid.</p>'));
  if (req.method === 'POST') {
    if (!storeReady() || !(await addOptout(biz.id, emailHash(biz.id, who.email)))) {
      return res.status(503).send(page('<p>Нещо се обърка, опитайте отново по-късно. / Something went wrong, please try again later.</p>'));
    }
    return res.status(200).send(page(`<p><b>Готово.</b> Няма да получавате повече имейли от ${esc(biz.name)}.</p><p><b>Done.</b> You won’t get more emails from ${esc(biz.name)}.</p>`));
  }
  if (req.method !== 'GET') return res.status(405).send(page('<p>405</p>'));
  return res.status(200).send(page(`<p>Да спрем ли имейлите от <b>${esc(biz.name)}</b> до ${esc(who.email)}? / Stop emails from <b>${esc(biz.name)}</b> to ${esc(who.email)}?</p>
<form method="post" action="/api/stop"><input type="hidden" name="t" value="${esc(token)}"><button type="submit" style="background:#7d1d20;color:#fff;border:0;padding:12px 20px;border-radius:6px;font-weight:600;font-size:15px">Спрете ги / Stop them</button></form>`));
}
