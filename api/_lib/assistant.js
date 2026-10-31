// The AI assistant on a client's page (today: the demo salon on /book).
// It answers from the business's own services, prices, hours and rules,
// points people to the booking form, and hands a question to the owner by
// email when it is not sure. It never confirms a booking itself.
// No Node imports, so the page can share the limits and copy rules.
import { PHONE, EMAIL, toTime } from './booking.js';

export const ASSIST_MAX_TURNS = 10;
export const ASSIST_MAX_CHARS = 600;
export const ASSIST_PER_MINUTE = 6; // per visitor IP
export const ASSIST_PER_DAY_IP = 30;
export const HANDOVERS_PER_DAY_IP = 3;
export const HANDOVERS_PER_BUSINESS_DAY = 50;

const DAYS = {
  bg: ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

// "Monday: 09:00 to 19:00" for every day, "closed" when there are no hours.
export const hoursText = (biz, lang = 'en') =>
  [1, 2, 3, 4, 5, 6, 0]
    .map((d) => {
      const h = biz.hours[d];
      const name = DAYS[lang === 'bg' ? 'bg' : 'en'][d];
      return h ? `${name}: ${toTime(h[0])} to ${toTime(h[1])}` : `${name}: ${lang === 'bg' ? 'почивен ден' : 'closed'}`;
    })
    .join('\n');

// The whole brief for one business, in the visitor's language.
export const systemPrompt = (biz, lang = 'bg') => {
  const a = biz.assistant;
  const services = biz.services.map((s) => `- id ${s.id}: ${lang === 'en' ? s.en : s.bg} (${s.bg} / ${s.en}), ${s.min} min, €${s.eur}`).join('\n');
  return `You are the chat assistant on the website of ${biz.name}, ${a.about}.

Services (id, name, length, price):
${services}

Opening hours (${biz.tz}):
${hoursText(biz, 'en')}

Rules of the business:
${a.facts.map((f) => `- ${f}`).join('\n')}

How to answer:
- Answer only from the information above. Never invent prices, services, staff, discounts, free times or anything else. If the answer is not above, say you are not sure and offer to pass the question to the team.
- You cannot see the calendar and you cannot book, change or cancel anything. Never say a time is free or that a booking is made. To book, the visitor uses the booking form on this page.
- When the visitor wants to book a service from the list, end your reply with the tag [[book:SERVICE_ID]] using the id above, once.
- When you are not sure, when the visitor asks for a person, or when they have a complaint or a medical or allergy question, end your reply with the tag [[handover]], once.
- Never ask for or repeat phone numbers, emails or card numbers in chat. The forms on the page collect contact details.
- Keep replies short: 1 to 3 sentences, plain text, no markdown. Warm and calm.
- Reply in ${lang === 'en' ? 'English' : 'Bulgarian'} unless the visitor clearly writes in another language; then use theirs.
- Stay on topic: this business, its services, prices, hours and booking. Politely decline anything else.`;
};

// Pulls the tags out of a reply. Unknown service ids are dropped, so the page
// only ever offers a service that exists.
export const parseReply = (raw, biz) => {
  let text = String(raw || '');
  let book = null;
  let handover = false;
  text = text.replace(/\[\[\s*book\s*:\s*([a-z0-9-]{1,40})\s*\]\]/gi, (_, id) => {
    if (!book && biz.services.some((s) => s.id === id)) book = id;
    return '';
  });
  text = text.replace(/\[\[\s*handover\s*\]\]/gi, () => {
    handover = true;
    return '';
  });
  text = text.replace(/\[\[[^\]]{0,60}\]\]/g, '').replace(/\s+\n/g, '\n').trim();
  return { text, book, handover };
};

// Visitor turns as the API wants them: alternating, last one from the visitor.
export const cleanTurns = (raw) => {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .slice(-ASSIST_MAX_TURNS)
    .map((m) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: String(m?.text || '').trim().slice(0, ASSIST_MAX_CHARS) }))
    .filter((m) => m.content);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  return msgs.reduce((out, m) => {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else out.push({ ...m });
    return out;
  }, []);
};

const clean = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);

// A question passed to the owner. Needs a name and a phone or an email.
export const readHandover = (h) => {
  const name = clean(h?.name, 80);
  if (name.length < 2) return { error: 'invalid_name' };
  const phone = clean(h?.phone, 20);
  const email = clean(h?.email, 254).toLowerCase();
  if (phone && !PHONE.test(phone)) return { error: 'invalid_phone' };
  if (email && !EMAIL.test(email)) return { error: 'invalid_email' };
  if (!phone && !email) return { error: 'need_contact' };
  const question = clean(h?.question, 500);
  if (question.length < 2) return { error: 'invalid_question' };
  const transcript = (Array.isArray(h?.transcript) ? h.transcript : [])
    .slice(-8)
    .map((m) => ({ who: m?.role === 'assistant' ? 'assistant' : 'visitor', text: clean(m?.text, ASSIST_MAX_CHARS) }))
    .filter((m) => m.text);
  return { row: { name, phone: phone || null, email: email || null, question, transcript } };
};

// Spend caps in millionths of a dollar.
export const capsFor = (biz) => ({ day: Math.round(biz.assistant.dailyUsd * 1e6), month: Math.round(biz.assistant.monthlyUsd * 1e6) });
