// POST /api/waitlist  { email, goal, company }
// Validates input, drops bots, rate limits per IP (Upstash when connected),
// stores the signup in Supabase (table: waitlist), sends a confirmation link
// and alerts the team when email is set up.
import { EMAIL, GOALS, allowed, store, guard, clientIp, country, mask } from './_lib/shared.js';
import { baseUrl } from './_lib/http.js';
import { incr } from './_lib/redis.js';
import { alertHtml, firstMail, makeToken, notifyTeam, send, verifyEmail, verifyReady } from './_lib/mail.js';

// Confirmation emails across the whole site per day. Rotating IPs can't use
// the form to send thousands of emails and drain the quota sign-in links need.
export const WAITLIST_MAILS_PER_DAY = 100;
const underDailyCap = async () => {
  try {
    return (await incr(`mail:waitlist-day:${new Date().toISOString().slice(0, 10)}`, 2 * 86400)) <= WAITLIST_MAILS_PER_DAY;
  } catch {
    return false;
  }
};

export default async function handler(req, res) {
  const blocked = guard(req, res);
  if (blocked) return blocked;

  const under = await allowed(clientIp(req), 'waitlist');
  if (!under) return res.status(under === null ? 503 : 429).json({ error: under === null ? 'unavailable' : 'too_many_requests' });

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const email = String(body.email || '').trim().toLowerCase();
  const goal = GOALS.includes(body.goal) ? body.goal : null;

  // Honeypot filled in: pretend success so the bot learns nothing.
  if (body.company) return res.status(200).json({ ok: true, verify: verifyReady });

  if (email.length > 254 || !EMAIL.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  console.log(`waitlist signup: ${mask(email)}`);
  const where = country(req);
  const ok = await store('waitlist', { email, goal, source: 'landing', country: where });
  if (!ok) return res.status(502).json({ error: 'storage_unavailable' });

  // One email per address a day, so the form cannot be used to flood
  // someone's inbox from rotating IPs.
  if (!(await firstMail(`mail:waitlist:${email}`, 86400))) return res.status(200).json({ ok: true, verify: verifyReady });

  let verify = false;
  if (verifyReady && (await underDailyCap())) {
    const link = `${baseUrl(req)}/api/verify?t=${encodeURIComponent(makeToken(email))}`;
    verify = await send({ to: email, subject: 'Confirm your Rollcfluence early access spot', html: verifyEmail(link, goal) });
  }
  await notifyTeam({
    subject: `New early access request${goal ? `: ${goal}` : ''}`,
    html: alertHtml('New early access request', [['Email', email], ['Goal', goal], ['Country', where], ['Status', verify ? 'Waiting for email confirmation' : 'Unverified']]),
    replyTo: email,
  });

  return res.status(200).json({ ok: true, verify });
}
