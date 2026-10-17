// POST /api/questions  { email, question, company }
// POST /api/questions  { kind: 'feedback', rating, message, email?, page }
// Questions from the chat helper and feedback from the feedback form.
// Stored in Supabase (tables: questions, feedback) and emailed to the team
// when email is set up.
import { EMAIL, allowed, store, guard, clientIp, country, mask } from './_lib/shared.js';
import { NOTIFY, alertHtml, send } from './_lib/mail.js';

export default async function handler(req, res) {
  const blocked = guard(req, res);
  if (blocked) return blocked;

  if (!(await allowed(clientIp(req), 'questions'))) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  if (body.company) return res.status(200).json({ ok: true });

  const email = String(body.email || '').trim().toLowerCase();

  if (body.kind === 'feedback') {
    const rating = Number(body.rating);
    const message = String(body.message || '').trim();
    const page = String(body.page || '').slice(0, 60) || null;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'invalid_rating' });
    if (message.length > 2000) return res.status(400).json({ error: 'invalid_message' });
    if (email && (email.length > 254 || !EMAIL.test(email))) return res.status(400).json({ error: 'invalid_email' });
    const where = country(req);
    const ok = await store('feedback', { rating, message: message || null, email: email || null, page, country: where });
    if (!ok) return res.status(502).json({ error: 'storage_unavailable' });
    await send({
      to: NOTIFY,
      subject: `Feedback: ${rating}/5`,
      html: alertHtml('New feedback', [['Rating', `${rating}/5`], ['Page', page || '-'], ['From', email || 'anonymous'], ['Country', where], ['Message', message || '-']]),
      ...(email ? { replyTo: email } : {}),
    });
    return res.status(200).json({ ok: true });
  }

  const question = String(body.question || '').trim();

  if (email.length > 254 || !EMAIL.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (question.length < 3 || question.length > 2000) {
    return res.status(400).json({ error: 'invalid_question' });
  }

  console.log(`question from ${mask(email)} (${question.length} chars)`);
  const where = country(req);
  const ok = await store('questions', { email, question, country: where });
  if (!ok) return res.status(502).json({ error: 'storage_unavailable' });

  await send({
    to: NOTIFY,
    subject: 'New question from the website',
    html: alertHtml('New question', [['From', email], ['Country', where], ['Question', question]]),
    replyTo: email,
  });

  return res.status(200).json({ ok: true });
}
