// POST /api/questions  { email, question, company }
// Questions from the chat helper. Stored in Supabase (table: questions).
import { EMAIL, allowed, store, guard, clientIp, country, mask } from './_lib/shared.js';

export default async function handler(req, res) {
  const blocked = guard(req, res);
  if (blocked) return blocked;

  if (!(await allowed(clientIp(req), 'questions'))) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  if (body.company) return res.status(200).json({ ok: true });

  const email = String(body.email || '').trim().toLowerCase();
  const question = String(body.question || '').trim();

  if (email.length > 254 || !EMAIL.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (question.length < 3 || question.length > 2000) {
    return res.status(400).json({ error: 'invalid_question' });
  }

  console.log(`question from ${mask(email)} (${question.length} chars)`);
  const ok = await store('questions', { email, question, country: country(req) });
  if (!ok) return res.status(502).json({ error: 'storage_unavailable' });

  return res.status(200).json({ ok: true });
}
