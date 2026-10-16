// GET /api/verify?t=token  Confirms a signup email from the link we sent.
import { markVerified } from './_lib/shared.js';
import { NOTIFY, alertHtml, readToken, send } from './_lib/mail.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const email = readToken(String(req.query?.t || ''));
  if (!email) return res.redirect(302, '/verified?state=expired');

  const ok = await markVerified(email);
  if (!ok) return res.redirect(302, '/verified?state=error');

  await send({ to: NOTIFY, subject: 'Early access email confirmed', html: alertHtml('Email confirmed', [['Email', email]]), replyTo: email });
  return res.redirect(302, '/verified');
}
